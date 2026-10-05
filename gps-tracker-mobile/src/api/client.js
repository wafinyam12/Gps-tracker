import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import authEvents from '../utils/authEvents';
import { createRequestId, logApiOutcome, logEvent } from '../utils/diagnosticLogger';

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

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Accept': 'application/json',
  },
});

// Interceptor untuk menyisipkan token secara otomatis
apiClient.interceptors.request.use(async (config) => {
  config.__diagnostic = { requestId: createRequestId(), startedAt: Date.now() };
  config.headers = config.headers || {};
  if (typeof config.headers.set === 'function') {
    config.headers.set('X-Request-ID', config.__diagnostic.requestId);
  } else {
    config.headers['X-Request-ID'] = config.__diagnostic.requestId;
  }

  const token = await SecureStore.getItemAsync('user_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to catch auth errors globally
apiClient.interceptors.response.use(
  response => {
    const config = response.config || {};
    const requestId = config.__diagnostic?.requestId;
    const serverRequestId = response.headers?.['x-request-id'];
    logApiOutcome({
      request_id: requestId,
      request_id_mismatch: Boolean(serverRequestId && requestId && serverRequestId !== requestId),
      method: config.method?.toUpperCase(),
      path: config.url,
      status: response.status,
      duration_ms: config.__diagnostic?.startedAt ? Date.now() - config.__diagnostic.startedAt : undefined,
      action: config.diagnosticAction,
    });
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const config = error.config || {};
    const requestId = config.__diagnostic?.requestId;
    const serverRequestId = error.response?.headers?.['x-request-id'];
    logApiOutcome({
      request_id: requestId,
      request_id_mismatch: Boolean(serverRequestId && requestId && serverRequestId !== requestId),
      method: config.method?.toUpperCase(),
      path: config.url,
      status,
      duration_ms: config.__diagnostic?.startedAt ? Date.now() - config.__diagnostic.startedAt : undefined,
      error_code: error.code,
      action: config.diagnosticAction,
    });
    const message = String(data?.message || '').toLowerCase();
    const isInactiveAccount = message.includes('akun tidak aktif');

    // Logout on 401 (unauthenticated) and on inactive accounts so stale sessions do not linger.
    if (status === 401 || (status === 403 && isInactiveAccount)) {
      logEvent('api.auth_rejected', { status });
      try {
        await SecureStore.deleteItemAsync('user_token');
        await SecureStore.deleteItemAsync('user_data');
      } catch (e) {
        logEvent('api.auth_cleanup_failed', { error_code: e?.code });
      }
      // notify app to force logout UI-wise
      try { authEvents.emit('logout', { status }); } catch (e) { }
    } else if (status === 403) {
      logEvent('api.permission_denied', { status });
    }
    return Promise.reject(error);
  }
);

export default apiClient;
