import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import apiClient from '../api/client';

const OFFLINE_QUEUE_KEY = 'offlineQueue';
const OFFLINE_VISIT_MAP_KEY = 'offlineVisitServerMap';
const OFFLINE_STORE_CACHE_KEY = 'offlineAvailableStores';
const ALLOWED_PHOTO_TYPES = new Set(['checkin', 'checkout', 'product', 'other']);

let isProcessingQueue = false;

const createUuid = () => {
  const random = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  random[6] = (random[6] & 0x0f) | 0x40;
  random[8] = (random[8] & 0x3f) | 0x80;
  const hex = random.map(value => value.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const readJson = async (key, fallback) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Error reading offline storage ${key}:`, error);
    return fallback;
  }
};

const writeJson = async (key, value) => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

const isReachable = async () => {
  const netInfo = await NetInfo.fetch();
  return Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);
};

const buildRequestPayload = (endpoint, data, headers = {}) => {
  if (endpoint === '/visit/photos' && data && Array.isArray(data.photos)) {
    const formData = new FormData();
    const sanitizedHeaders = Object.fromEntries(
      Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'content-type')
    );

    Object.entries(data).forEach(([key, value]) => {
      if (key === 'photos' || value === undefined || value === null) {
        return;
      }

      if (key === 'type') {
        formData.append(key, ALLOWED_PHOTO_TYPES.has(value) ? value : 'other');
        return;
      }

      formData.append(key, String(value));
    });

    data.photos.forEach((photo, index) => {
      formData.append('photos[]', {
        uri: photo.uri,
        name: photo.name || `photo_${index}.jpg`,
        type: photo.type || 'image/jpeg',
      });
    });

    return { data: formData, headers: sanitizedHeaders };
  }

  return { data, headers };
};

const responseVisitId = (response) => {
  const body = response?.data || {};
  const payload = body.data || body;
  return payload.visit_log_id || payload.visit?.id || null;
};

const resolveVisitId = async (item) => {
  if (!item.localVisitId) {
    return item.data?.visit_log_id || null;
  }

  const visitMap = await readJson(OFFLINE_VISIT_MAP_KEY, {});
  return visitMap[item.localVisitId] || null;
};

const executeItem = async (item) => {
  if (item.kind === 'visit_start') {
    const response = await apiClient({
      method: item.method,
      url: item.endpoint,
      data: item.data,
      headers: item.headers,
    });
    const serverVisitId = responseVisitId(response);
    if (!serverVisitId) {
      throw new Error('Backend tidak mengembalikan ID kunjungan untuk data offline.');
    }

    const visitMap = await readJson(OFFLINE_VISIT_MAP_KEY, {});
    visitMap[item.localVisitId] = serverVisitId;
    await writeJson(OFFLINE_VISIT_MAP_KEY, visitMap);
    return;
  }

  let data = item.data;
  if (item.kind === 'visit_checkout' || item.kind === 'visit_photos') {
    const serverVisitId = await resolveVisitId(item);
    if (!serverVisitId) {
      const dependencyError = new Error('Menunggu check-in offline tersinkron lebih dahulu.');
      dependencyError.isDependencyPending = true;
      throw dependencyError;
    }

    data = { ...item.data, visit_log_id: serverVisitId };
  }

  const payload = buildRequestPayload(item.endpoint, data, item.headers);
  await apiClient({ method: item.method, url: item.endpoint, data: payload.data, headers: payload.headers });
};

export const offlineQueue = {
  createUuid,

  async isReachable() {
    return isReachable();
  },

  async addItem(endpoint, method, data, headers = {}, metadata = {}) {
    const queue = await readJson(OFFLINE_QUEUE_KEY, []);
    queue.push({
      id: createUuid(),
      endpoint,
      method,
      data,
      headers,
      timestamp: new Date().toISOString(),
      retries: 0,
      ...metadata,
    });
    await writeJson(OFFLINE_QUEUE_KEY, queue);
  },

  async enqueueVisitStart(data, localVisitId = createUuid()) {
    const clientUuid = data.client_uuid || createUuid();
    await this.addItem('/visit/start', 'post', {
      ...data,
      client_uuid: clientUuid,
      offline_sync: true,
    }, {}, {
      kind: 'visit_start',
      localVisitId,
      clientUuid,
    });

    return { localVisitId, clientUuid };
  },

  async enqueueVisitCheckout(localVisitId, data) {
    await this.addItem('/visit/checkout', 'post', {
      ...data,
      client_uuid: data.client_uuid || createUuid(),
      offline_sync: true,
    }, {}, {
      kind: 'visit_checkout',
      localVisitId,
    });
  },

  async enqueueVisitPhotos(localVisitId, data) {
    await this.addItem('/visit/photos', 'post', data, {}, {
      kind: 'visit_photos',
      localVisitId,
    });
  },

  async removeVisit(localVisitId) {
    const queue = await readJson(OFFLINE_QUEUE_KEY, []);
    await writeJson(OFFLINE_QUEUE_KEY, queue.filter(item => item.localVisitId !== localVisitId));
  },

  async cacheStores(stores) {
    await writeJson(OFFLINE_STORE_CACHE_KEY, {
      savedAt: new Date().toISOString(),
      stores,
    });
  },

  async cachedStores() {
    return readJson(OFFLINE_STORE_CACHE_KEY, { savedAt: null, stores: [] });
  },

  async processQueue({ silent = false } = {}) {
    if (isProcessingQueue || !await isReachable()) {
      return { processed: 0, pending: await this.getQueueSize() };
    }

    isProcessingQueue = true;
    let processed = 0;
    try {
      const queue = await readJson(OFFLINE_QUEUE_KEY, []);

      for (let index = 0; index < queue.length; index++) {
        const item = queue[index];
        try {
          await executeItem(item);
          queue.splice(index, 1);
          index--;
          processed++;
          await writeJson(OFFLINE_QUEUE_KEY, queue);
        } catch (error) {
          if (error.isDependencyPending) {
            break;
          }

          item.retries = (item.retries || 0) + 1;
          item.lastError = String(error?.response?.data?.message || error?.message || 'Sinkronisasi gagal');
          item.lastAttemptAt = new Date().toISOString();
          await writeJson(OFFLINE_QUEUE_KEY, queue);
          console.error(`Failed to sync ${item.method} ${item.endpoint}:`, error);

          if (!silent) {
            Alert.alert('Sync Gagal', 'Data tetap aman di perangkat dan akan dicoba lagi saat koneksi tersedia.');
          }
          break;
        }
      }

      const pending = queue.length;
      if (!silent && processed > 0 && pending === 0) {
        Alert.alert('Sinkronisasi Berhasil', 'Semua data offline berhasil dikirim.');
      }
      return { processed, pending };
    } finally {
      isProcessingQueue = false;
    }
  },

  async getQueueSize() {
    const queue = await readJson(OFFLINE_QUEUE_KEY, []);
    return queue.length;
  },

  async clearQueue() {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    await AsyncStorage.removeItem(OFFLINE_VISIT_MAP_KEY);
  },
};
