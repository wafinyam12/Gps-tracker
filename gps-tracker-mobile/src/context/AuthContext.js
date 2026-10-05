import React, { createContext, useState, useEffect, useContext } from 'react';
import { Alert, Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import apiClient, { getPrivacyPolicyUrl, setAccessToken } from '../api/client';
import authEvents from '../utils/authEvents';
import { canTrackLocation } from '../utils/roles';
import { startBackgroundTracking, stopBackgroundTracking } from '../utils/backgroundTracker';
import { logEvent } from '../utils/diagnosticLogger';

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
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] = useState(false);
  const [locationConsentGranted, setLocationConsentGranted] = useState(false);

  useEffect(() => {
    restoreSession();
  }, []);

  // Subscribe to global auth events (e.g., forced logout from API client)
  useEffect(() => {
    const unsub = authEvents.on('logout', async (payload) => {
      logEvent('auth.forced_logout', { status: payload?.status });
      try {
        await stopBackgroundTracking();
        await SecureStore.deleteItemAsync('user_token');
        await SecureStore.deleteItemAsync('user_token_refreshed_at');
        await SecureStore.deleteItemAsync('user_data');
        setBackgroundTrackingEnabled(false);
        setLocationConsentGranted(false);
      } catch (e) {
        logEvent('auth.session_cleanup_failed', { error_code: e?.code });
      }
      setUser(null);
    });
    return () => unsub();
  }, []);

  const consentKeyForUser = (targetUser) => `background_location_consent_${targetUser?.id}`;

  const askBackgroundLocationConsent = async (targetUser) => new Promise((resolve) => {
    Alert.alert(
      'Pelacakan lokasi di latar belakang',
      'Untuk mendukung catatan dan pemantauan visit, Sales Daily mengirim lokasi perangkat secara berkala (lintang, bujur, akurasi, kecepatan, dan waktu) saat aplikasi digunakan maupun berjalan di latar belakang. Pelacakan tetap aktif sampai Anda keluar atau menonaktifkan izin lokasi di Pengaturan Android. Anda dapat menolak dan tetap menggunakan fitur lain yang tidak memerlukan lokasi.',
      [
        {
          text: 'Nanti',
          style: 'cancel',
          onPress: () => {
            SecureStore.setItemAsync(consentKeyForUser(targetUser), 'declined')
              .then(() => {
                setLocationConsentGranted(false);
                resolve(false);
              })
              .catch((error) => {
                logEvent('tracking.consent_save_failed', { error_code: error?.code });
                resolve(false);
              });
          },
        },
        {
          text: 'Kebijakan Privasi',
          onPress: () => {
            Linking.openURL(getPrivacyPolicyUrl())
              .catch((error) => logEvent('privacy_policy.open_failed', { error_code: error?.code }))
              .finally(() => resolve(false));
          },
        },
        {
          text: 'Setuju & lanjutkan',
          onPress: () => {
            SecureStore.setItemAsync(consentKeyForUser(targetUser), 'accepted')
              .then(async () => {
                setLocationConsentGranted(true);
                const started = await startBackgroundTracking();
                setBackgroundTrackingEnabled(started);
                resolve(started);
              })
              .catch((error) => {
                logEvent('tracking.consent_save_failed', { error_code: error?.code });
                Alert.alert('Pengaturan lokasi gagal', 'Persetujuan tidak dapat disimpan dengan aman. Pelacakan tidak dimulai.');
                resolve(false);
              });
          },
        },
      ],
      { cancelable: false },
    );
  });

  const requestBackgroundLocationConsent = async () => {
    if (!canTrackLocation(user)) return false;
    const consent = await SecureStore.getItemAsync(consentKeyForUser(user));
    if (consent === 'accepted') {
      setLocationConsentGranted(true);
      const started = await startBackgroundTracking();
      setBackgroundTrackingEnabled(started);
      return started;
    }
    return askBackgroundLocationConsent(user);
  };

  const disableBackgroundLocationTracking = async () => {
    await SecureStore.deleteItemAsync(consentKeyForUser(user));
    await stopBackgroundTracking();
    setLocationConsentGranted(false);
    setBackgroundTrackingEnabled(false);
  };

  useEffect(() => {
    let active = true;
    const syncTracking = async () => {
      if (!canTrackLocation(user)) {
        await stopBackgroundTracking();
        if (active) {
          setBackgroundTrackingEnabled(false);
          setLocationConsentGranted(false);
        }
        return;
      }

      const consent = await SecureStore.getItemAsync(consentKeyForUser(user));
      if (consent === 'accepted') {
        if (active) setLocationConsentGranted(true);
        const started = await startBackgroundTracking();
        if (active) setBackgroundTrackingEnabled(started);
      } else if (consent !== 'declined') {
        if (active) setLocationConsentGranted(false);
        await stopBackgroundTracking();
        if (active) setBackgroundTrackingEnabled(false);
        await askBackgroundLocationConsent(user);
      } else if (active) {
        setLocationConsentGranted(false);
      }
    };

    syncTracking().catch((error) => logEvent('tracking.sync_failed', { error_code: error?.code }));
    return () => { active = false; };
  }, [user?.id]);

  const clearStoredSession = async () => {
    try {
      await stopBackgroundTracking();
      await Promise.all([
        SecureStore.deleteItemAsync('user_token'),
        SecureStore.deleteItemAsync('user_token_refreshed_at'),
        SecureStore.deleteItemAsync('user_data'),
      ]);
    } catch (e) {
      logEvent('auth.session_cleanup_failed', { error_code: e?.code });
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
          logEvent('auth.stored_user_parse_failed', { error_code: parseError?.code });
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
          logEvent('auth.session_refresh_failed', { status: error.response?.status, error_code: error.code });
        });
    } catch (error) {
      logEvent('auth.session_restore_failed', { status: error.response?.status, error_code: error.code });
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password, deviceName) => {
    try {
      logEvent('auth.login_started');
      const response = await apiClient.post('/auth/login', {
        username,
        password,
        device_name: deviceName,
      });

      const { token, user: userData } = response.data.data;
      await setAccessToken(token);
      await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
      logEvent('auth.login_succeeded');

      setUser(userData);
      return { success: true };
    } catch (error) {
      logEvent('auth.login_failed', { status: error.response?.status, error_code: error.code });

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
      logEvent('auth.logout_request_failed', { status: e.response?.status, error_code: e.code });
    } finally {
      await clearStoredSession();
      setUser(null);
      setBackgroundTrackingEnabled(false);
      setLocationConsentGranted(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      refreshUser,
      updateStoredUser,
      backgroundTrackingEnabled,
      locationConsentGranted,
      requestBackgroundLocationConsent,
      disableBackgroundLocationTracking,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
