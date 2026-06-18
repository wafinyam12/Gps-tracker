import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import authEvents from '../utils/authEvents';
import { canVisitStores } from '../utils/roles';
import { startBackgroundTracking, stopBackgroundTracking } from '../utils/backgroundTracker';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
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

  const loadStoredData = async () => {
    try {
      const storedUser = await SecureStore.getItemAsync('user_data');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.log('Error loading auth data', e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, deviceName) => {
    try {
      console.log('LOGIN: attempting', email, deviceName);
      const response = await apiClient.post('/auth/login', {
        email,
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
      console.log('LOGIN: error', error.response?.status, error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Login gagal, periksa koneksi Anda.',
      };
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      console.log('Logout error', e);
    } finally {
      await stopBackgroundTracking();
      await SecureStore.deleteItemAsync('user_token');
      await SecureStore.deleteItemAsync('user_data');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
