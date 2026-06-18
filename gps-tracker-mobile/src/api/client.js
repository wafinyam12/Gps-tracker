import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import authEvents from '../utils/authEvents';

const DEFAULT_BASE_URL = 'http://192.168.101.29:8000/api/v1';

const resolveBaseUrl = () => {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (!configured) {
    return DEFAULT_BASE_URL;
  }

  const normalized = configured.replace(/\/$/, '');

  if (normalized.endsWith('/api/v1')) {
    return normalized;
  }

  if (normalized.endsWith('/api')) {
    return `${normalized}/v1`;
  }

  return `${normalized}/api/v1`;
};

const BASE_URL = resolveBaseUrl();

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
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
    // Only logout on 401 (unauthenticated). 403 is permission denied, not auth error.
    if (status === 401) {
      console.log('API client detected auth error 401 - logging out');
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
