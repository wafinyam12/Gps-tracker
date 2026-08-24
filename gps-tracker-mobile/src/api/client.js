import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import authEvents from '../utils/authEvents';

// Standalone builds must never silently fall back to a developer machine.
// Local development can still override this explicitly through EXPO_PUBLIC_API_BASE_URL.
const STAGING_BASE_URL = 'https://crm-sales.utomo-dev.xyz/api/v1';

const normalizeApiBaseUrl = (value) => {
  const normalized = value.trim().replace(/\/$/, '');

  if (normalized.endsWith('/api/v1')) {
    return normalized;
  }

  if (normalized.endsWith('/api')) {
    return `${normalized}/v1`;
  }

  return `${normalized}/api/v1`;
};

const resolveBaseUrl = () => {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  return normalizeApiBaseUrl(configured || STAGING_BASE_URL);
};

const BASE_URL = resolveBaseUrl();
console.log('[apiClient] Base URL:', BASE_URL);

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Accept': 'application/json',
  },
});

// Interceptor untuk menyisipkan token secara otomatis
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('user_token');
  console.log('API REQUEST', config.method?.toUpperCase(), config.url, 'TOKEN:', token ? `${token.substring(0, 20)}...` : 'NO_TOKEN');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to catch auth errors globally
apiClient.interceptors.response.use(
  response => response,
  async (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const message = String(data?.message || '').toLowerCase();
    const isInactiveAccount = message.includes('akun tidak aktif');

    // Logout on 401 (unauthenticated) and on inactive accounts so stale sessions do not linger.
    if (status === 401 || (status === 403 && isInactiveAccount)) {
      console.log('API client detected auth error - logging out');
      try {
        await SecureStore.deleteItemAsync('user_token');
        await SecureStore.deleteItemAsync('user_data');
      } catch (e) {
        console.log('Failed clearing token on auth error', e);
      }
      // notify app to force logout UI-wise
      try { authEvents.emit('logout', { status, data }); } catch (e) { }
    } else if (status === 403) {
      console.log('API client detected 403 Forbidden - permission denied');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
