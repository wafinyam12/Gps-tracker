import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import authEvents from '../utils/authEvents';

const DEFAULT_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:8000/api/v1',
  ios: 'http://localhost:8000/api/v1',
  web: 'http://localhost:8000/api/v1',
  default: 'http://localhost:8000/api/v1',
});

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

const getExpoDevHost = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.hostUri;

  if (!hostUri) {
    return null;
  }

  const withoutScheme = hostUri.replace(/^[a-zA-Z]+:\/\//, '');
  const hostPort = withoutScheme.split('/')[0];
  const host = hostPort.split(':')[0];

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  return host;
};

const resolveBaseUrl = () => {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (!configured) {
    const devHost = getExpoDevHost();
    if (devHost) {
      return `http://${devHost}:8000/api/v1`;
    }

    return DEFAULT_BASE_URL;
  }

  return normalizeApiBaseUrl(configured);
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
