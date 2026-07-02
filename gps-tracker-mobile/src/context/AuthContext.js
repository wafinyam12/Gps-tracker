import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import authEvents from '../utils/authEvents';
import { canVisitStores } from '../utils/roles';
import { startBackgroundTracking, stopBackgroundTracking } from '../utils/backgroundTracker';

const AuthContext = createContext();

const parseRetryAfterSeconds = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.ceil(value));
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  const numericValue = Number(normalized);
  if (Number.isFinite(numericValue)) {
    return Math.max(0, Math.ceil(numericValue));
  }

  const retryDate = Date.parse(normalized);
  if (!Number.isNaN(retryDate)) {
    return Math.max(0, Math.ceil((retryDate - Date.now()) / 1000));
  }

  return null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  // Subscribe to global auth events (e.g., forced logout from API client)
  useEffect(() => {
    const unsub = authEvents.on('logout', async (payload) => {
      console.log('AuthContext received logout event', payload);
      try {
        await stopBackgroundTracking();
        await SecureStore.deleteItemAsync('user_token');
        await SecureStore.deleteItemAsync('user_data');
      } catch (e) {
        console.log('Error clearing secure storage on forced logout', e);
      }
      setUser(null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const syncTracking = async () => {
      try {
        if (canVisitStores(user)) {
          await startBackgroundTracking();
        } else {
          await stopBackgroundTracking();
        }
      } catch (e) {
        console.log('Failed to sync background tracking', e);
      }
    };

    syncTracking();
  }, [user]);

  const clearStoredSession = async () => {
    try {
      await stopBackgroundTracking();
      await Promise.all([
        SecureStore.deleteItemAsync('user_token'),
        SecureStore.deleteItemAsync('user_data'),
      ]);
    } catch (e) {
      console.log('Error clearing stored auth data', e);
    }
  };

  const restoreSession = async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        SecureStore.getItemAsync('user_token'),
        SecureStore.getItemAsync('user_data'),
      ]);

      if (!storedToken) {
        if (storedUser) {
          await clearStoredSession();
        }
        return;
      }

      let parsedUser = null;

      if (storedUser) {
        try {
          parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (parseError) {
          console.log('Error parsing stored auth data', parseError);
          await SecureStore.deleteItemAsync('user_data');
        }
      }

      if (!parsedUser) {
        const response = await apiClient.get('/auth/me');
        const freshUser = response.data?.data?.user;

        if (freshUser) {
          await SecureStore.setItemAsync('user_data', JSON.stringify(freshUser));
          setUser(freshUser);
        }
        return;
      }

      apiClient.get('/auth/me')
        .then(async (response) => {
          const freshUser = response.data?.data?.user;

          if (freshUser) {
            await SecureStore.setItemAsync('user_data', JSON.stringify(freshUser));
            setUser(freshUser);
          }
        })
        .catch((error) => {
          console.log('Background auth refresh failed', error.response?.status || error.message);
        });
    } catch (error) {
      console.log('Error restoring auth data', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password, deviceName) => {
    try {
      console.log('LOGIN: attempting', username, deviceName);
      const response = await apiClient.post('/auth/login', {
        username,
        password,
        device_name: deviceName,
      });

      const { token, user: userData } = response.data.data;
      console.log('LOGIN: success, token:', token.substring(0, 20) + '...');

      await SecureStore.setItemAsync('user_token', token);
      await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
      console.log('LOGIN: stored in SecureStore');

      setUser(userData);
      return { success: true };
    } catch (error) {
      console.log('LOGIN: error', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        baseURL: apiClient.defaults.baseURL,
      });

      if (!error.response) {
        return {
          success: false,
          message: `Tidak bisa terhubung ke server API di ${apiClient.defaults.baseURL}. Cek backend, IP tujuan, atau EXPO_PUBLIC_API_BASE_URL.`,
        };
      }

      const retryAfterSeconds = parseRetryAfterSeconds(
        error.response?.data?.retry_after_seconds ??
        error.response?.data?.retry_after ??
        error.response?.data?.errors?.retry_after_seconds?.[0] ??
        error.response?.headers?.['retry-after']
      );

      const validationMessage =
        error.response?.data?.errors?.username?.[0] ||
        error.response?.data?.errors?.email?.[0] ||
        error.response?.data?.errors?.password?.[0];

      if (error.response?.status === 429) {
        const waitMessage = retryAfterSeconds && retryAfterSeconds > 0
          ? ` Coba lagi dalam ${retryAfterSeconds} detik.`
          : ' Coba lagi sebentar lagi.';

        return {
          success: false,
          message: `${error.response?.data?.message || 'Terlalu banyak percobaan login.'}${waitMessage}`,
          retryAfterSeconds,
          status: 429,
        };
      }

      return {
        success: false,
        message: validationMessage || error.response?.data?.message || 'Login gagal, periksa kredensial Anda.',
        retryAfterSeconds,
        status: error.response?.status,
      };
    }
  };

  const updateStoredUser = async (userData) => {
    if (!userData) {
      return;
    }

    await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
    setUser(userData);
  };

  const refreshUser = async () => {
    const response = await apiClient.get('/auth/me');
    const freshUser = response.data?.data?.user;

    if (freshUser) {
      await updateStoredUser(freshUser);
    }

    return freshUser;
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      console.log('Logout error', e);
    } finally {
      await clearStoredSession();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, updateStoredUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
