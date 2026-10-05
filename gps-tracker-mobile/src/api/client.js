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
const TOKEN_REFRESHED_AT_KEY = 'user_token_refreshed_at';
const TOKEN_REFRESH_INTERVAL_MS = 20 * 24 * 60 * 60 * 1000;
let tokenRefreshPromise = null;

export const getPrivacyPolicyUrl = () => `${BASE_URL.replace(/\/api\/v1\/?$/, '')}/privacy-policy`;

export const setAccessToken = async (token) => {
  await SecureStore.setItemAsync('user_token', token);
  await SecureStore.setItemAsync(TOKEN_REFRESHED_AT_KEY, String(Date.now()));
};

const getUsableToken = async (url) => {
  const token = await SecureStore.getItemAsync('user_token');
  if (!token || /\/auth\/(login|refresh)(\?|$)/.test(url || '')) return token;

  const refreshedAt = await SecureStore.getItemAsync(TOKEN_REFRESHED_AT_KEY);
  const refreshedAtNumber = Number(refreshedAt);
  if (!Number.isFinite(refreshedAtNumber)) {
    await SecureStore.setItemAsync(TOKEN_REFRESHED_AT_KEY, String(Date.now()));
    return token;
  }
  if (Date.now() - refreshedAtNumber < TOKEN_REFRESH_INTERVAL_MS) return token;

  if (!tokenRefreshPromise) {
    tokenRefreshPromise = axios.post(`${BASE_URL}/auth/refresh`, {}, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).then(async (response) => {
      const freshToken = response.data?.data?.token;
      if (typeof freshToken !== 'string' || freshToken.length < 20) {
        throw new Error('Token refresh response is invalid.');
      }
      await setAccessToken(freshToken);
      logEvent('auth.token_refreshed');
      return freshToken;
    }).catch(async (error) => {
      if (error.response?.status === 401 || error.response?.status === 403) {
        await Promise.all([
          SecureStore.deleteItemAsync('user_token'),
          SecureStore.deleteItemAsync(TOKEN_REFRESHED_AT_KEY),
          SecureStore.deleteItemAsync('user_data'),
        ]);
        authEvents.emit('logout', { status: error.response.status });
      }
      if (!error.response || error.response.status >= 500) return token;
      throw error;
    }).finally(() => {
      tokenRefreshPromise = null;
    });
  }

  return tokenRefreshPromise;
};

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Accept': 'application/json',
  },
});

// Interceptor untuk menyisipkan token secara otomatis
apiClient.interceptors.request.use(async (config) => {
  if (config.offlineOwnerUserId !== undefined && config.offlineOwnerUserId !== null) {
    const storedUser = await SecureStore.getItemAsync('user_data');
    let activeUserId = null;
    try {
      activeUserId = storedUser ? JSON.parse(storedUser)?.id : null;
    } catch (error) {
      activeUserId = null;
    }

    if (activeUserId === null || String(activeUserId) !== String(config.offlineOwnerUserId)) {
      const ownerError = new Error('Data offline ini dibuat oleh akun lain. Masuk dengan akun pemilik data untuk menyinkronkannya.');
      ownerError.code = 'OFFLINE_OWNER_MISMATCH';
      return Promise.reject(ownerError);
    }
  }

  config.headers = config.headers || {};
  const existingRequestId = typeof config.headers.get === 'function'
    ? config.headers.get('X-Request-ID')
    : (config.headers['X-Request-ID'] || config.headers['x-request-id']);
  const requestId = typeof existingRequestId === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(existingRequestId)
    ? existingRequestId
    : createRequestId();
  config.__diagnostic = { requestId, startedAt: Date.now() };
  if (typeof config.headers.set === 'function') {
    config.headers.set('X-Request-ID', requestId);
  } else {
    config.headers['X-Request-ID'] = requestId;
  }

  const token = await getUsableToken(config.url);
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
        await SecureStore.deleteItemAsync(TOKEN_REFRESHED_AT_KEY);
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
