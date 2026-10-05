import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import apiClient from '../api/client';
import { logEvent } from './diagnosticLogger';

const OFFLINE_QUEUE_KEY = 'offlineQueue';
const OFFLINE_VISIT_MAP_KEY = 'offlineVisitServerMap';
const OFFLINE_STORE_CACHE_KEY = 'offlineAvailableStores';
const OFFLINE_SYNC_NOTICE_KEY = 'offlineSyncSuccessNotice';
const ALLOWED_PHOTO_TYPES = new Set(['checkin', 'checkout', 'product', 'other']);

let queueProcessingPromise = null;
let processAgainRequested = false;
let processAgainSilent = true;
let queueMutation = Promise.resolve();
const cancelledVisitIds = new Set();

const withQueueMutation = (operation) => {
  const next = queueMutation.then(operation, operation);
  queueMutation = next.catch(() => {});
  return next;
};

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
    logEvent('offline.storage_read_failed', { error_code: error?.code });
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

const currentUserId = async () => {
  try {
    const raw = await SecureStore.getItemAsync('user_data');
    const user = raw ? JSON.parse(raw) : null;
    return user?.id === undefined || user?.id === null ? null : String(user.id);
  } catch (error) {
    return null;
  }
};

const persistQueuedPhotos = async (endpoint, data, itemId) => {
  if (endpoint !== '/visit/photos' || !Array.isArray(data?.photos)) {
    return { data, copiedUris: [] };
  }

  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) {
    throw new Error('Penyimpanan lokal foto offline tidak tersedia.');
  }

  const destinationDirectory = `${documentDirectory}offline-visit-photos/${itemId}/`;
  await FileSystem.makeDirectoryAsync(destinationDirectory, { intermediates: true });
  const copiedUris = [];
  const persistedPhotos = [];

  try {
    for (const [index, photo] of data.photos.entries()) {
      if (!photo.uri || photo.uri.startsWith(documentDirectory)) {
        persistedPhotos.push(photo);
        continue;
      }

      const fileKey = photo.client_uuid || String(index);
      const destinationUri = `${destinationDirectory}${fileKey}.jpg`;
      await FileSystem.copyAsync({ from: photo.uri, to: destinationUri });
      copiedUris.push(destinationUri);
      persistedPhotos.push({ ...photo, uri: destinationUri });
    }
  } catch (error) {
    await Promise.all(copiedUris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})));
    await FileSystem.deleteAsync(destinationDirectory, { idempotent: true }).catch(() => {});
    throw error;
  }

  return { data: { ...data, photos: persistedPhotos }, copiedUris };
};

const deleteLocalPhotoFiles = async (uris) => {
  let cleanupFailed = false;
  const appDirectories = [FileSystem.cacheDirectory, FileSystem.documentDirectory].filter(Boolean);
  for (const uri of new Set(uris)) {
    if (!uri || !appDirectories.some((directory) => uri.startsWith(directory))) {
      continue;
    }

    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (error) {
      cleanupFailed = true;
    }
  }

  return cleanupFailed;
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
      if (photo.client_uuid) {
        formData.append('photo_client_uuids[]', photo.client_uuid);
      }
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
  const mapping = visitMap[item.localVisitId];
  return typeof mapping === 'object' ? mapping?.visitLogId || null : mapping || null;
};

const executeItem = async (item) => {
  const requestConfig = { offlineOwnerUserId: item.ownerUserId };
  if (item.kind === 'visit_start') {
    const response = await apiClient({
      method: item.method,
      url: item.endpoint,
      data: item.data,
      headers: item.headers,
      ...requestConfig,
    });
    const serverVisitId = responseVisitId(response);
    if (!serverVisitId) {
      throw new Error('Backend tidak mengembalikan ID kunjungan untuk data offline.');
    }

    const visitWasCancelled = await withQueueMutation(async () => {
      const queue = await readJson(OFFLINE_QUEUE_KEY, []);
      if (cancelledVisitIds.has(String(item.localVisitId)) || !queue.some((queuedItem) => queuedItem.id === item.id)) {
        return true;
      }

      const visitMap = await readJson(OFFLINE_VISIT_MAP_KEY, {});
      visitMap[item.localVisitId] = {
        visitLogId: serverVisitId,
        ownerUserId: item.ownerUserId,
      };
      await writeJson(OFFLINE_VISIT_MAP_KEY, visitMap);
      return false;
    });

    if (visitWasCancelled) {
      return { cancelled: true, serverVisitId };
    }

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
  await apiClient({
    method: item.method,
    url: item.endpoint,
    data: payload.data,
    headers: payload.headers,
    ...requestConfig,
  });
};

const updateQueuedItem = async (itemId, updater) => withQueueMutation(async () => {
  const queue = await readJson(OFFLINE_QUEUE_KEY, []);
  const itemIndex = queue.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) {
    return null;
  }

  queue[itemIndex] = updater(queue[itemIndex]);
  await writeJson(OFFLINE_QUEUE_KEY, queue);
  return queue[itemIndex];
});

const removeQueuedItem = async (itemId) => {
  const photoUris = await withQueueMutation(async () => {
    const queue = await readJson(OFFLINE_QUEUE_KEY, []);
    const removedItem = queue.find((item) => item.id === itemId);
    await writeJson(OFFLINE_QUEUE_KEY, queue.filter((item) => item.id !== itemId));
    return Array.isArray(removedItem?.data?.photos)
      ? removedItem.data.photos.map((photo) => photo.uri)
      : [];
  });

  return deleteLocalPhotoFiles(photoUris);
};

export const offlineQueue = {
  createUuid,

  async isReachable() {
    return isReachable();
  },

  async addItem(endpoint, method, data, headers = {}, metadata = {}) {
    const item = await withQueueMutation(async () => {
      const id = createUuid();
      const [queue, ownerUserId, persistedPayload] = await Promise.all([
        readJson(OFFLINE_QUEUE_KEY, []),
        currentUserId(),
        persistQueuedPhotos(endpoint, data, id),
      ]);
      const item = {
        id,
        endpoint,
        method,
        data: persistedPayload.data,
        headers,
        timestamp: new Date().toISOString(),
        retries: 0,
        ownerUserId,
        ...metadata,
      };
      queue.push(item);
      try {
        await writeJson(OFFLINE_QUEUE_KEY, queue);
      } catch (error) {
        await Promise.all(persistedPayload.copiedUris.map((uri) => (
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
        )));
        throw error;
      }
      return item;
    });
    if (queueProcessingPromise) {
      processAgainRequested = true;
      processAgainSilent = false;
    } else if (await isReachable()) {
      this.processQueue({ silent: false }).catch((error) => {
        console.error('Unable to start offline queue sync after enqueue:', error);
      });
    }

    return item;
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
    logEvent('offline.visit_start_queued', { queue_size: await this.getQueueSize() });

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
    logEvent('offline.visit_checkout_queued', { queue_size: await this.getQueueSize() });
  },

  async enqueueVisitPhotos(localVisitId, data) {
    await this.addItem('/visit/photos', 'post', data, {}, {
      kind: 'visit_photos',
      localVisitId,
    });
    logEvent('offline.visit_photos_queued', { queue_size: await this.getQueueSize() });
  },

  async removeVisit(localVisitId) {
    cancelledVisitIds.add(String(localVisitId));
    const removal = await withQueueMutation(async () => {
      const queue = await readJson(OFFLINE_QUEUE_KEY, []);
      const removedItems = queue.filter((item) => item.localVisitId === localVisitId);
      const remainingItems = queue.filter((item) => item.localVisitId !== localVisitId);
      const photoUris = removedItems.flatMap((item) => (
        Array.isArray(item.data?.photos) ? item.data.photos.map((photo) => photo.uri) : []
      ));
      const visitMap = await readJson(OFFLINE_VISIT_MAP_KEY, {});
      const mapping = visitMap[localVisitId];
      const serverVisitId = typeof mapping === 'object' ? mapping?.visitLogId : mapping;
      const ownerUserId = typeof mapping === 'object'
        ? mapping?.ownerUserId
        : removedItems.find((item) => item.ownerUserId)?.ownerUserId;
      delete visitMap[localVisitId];

      let cancellationQueued = false;
      if (serverVisitId && ownerUserId) {
        remainingItems.push({
          id: createUuid(),
          endpoint: `/visits/${serverVisitId}`,
          method: 'delete',
          data: {},
          headers: {},
          timestamp: new Date().toISOString(),
          retries: 0,
          ownerUserId: String(ownerUserId),
          kind: 'visit_cancel',
        });
        cancellationQueued = true;
      }

      await writeJson(OFFLINE_QUEUE_KEY, remainingItems);
      await writeJson(OFFLINE_VISIT_MAP_KEY, visitMap);
      return { photoUris, cancellationQueued };
    });

    if (removal.cancellationQueued && queueProcessingPromise) {
      processAgainRequested = true;
      processAgainSilent = false;
    } else if (removal.cancellationQueued && await isReachable()) {
      this.processQueue({ silent: false }).catch((error) => {
        console.error('Unable to sync cancelled visit:', error);
      });
    }

    const cleanupFailed = await deleteLocalPhotoFiles(removal.photoUris);

    return { removed: true, cleanupFailed, cancellationQueued: removal.cancellationQueued };
  },

  async claimUnownedItems(ownerUserId) {
    if (ownerUserId === undefined || ownerUserId === null) {
      return 0;
    }

    return withQueueMutation(async () => {
      const queue = await readJson(OFFLINE_QUEUE_KEY, []);
      let claimed = 0;
      const updatedQueue = queue.map((item) => {
        if (item.ownerUserId) {
          return item;
        }

        claimed++;
        return { ...item, ownerUserId: String(ownerUserId) };
      });
      await writeJson(OFFLINE_QUEUE_KEY, updatedQueue);
      return claimed;
    });
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
    if (queueProcessingPromise) {
      return queueProcessingPromise;
    }

    if (!await isReachable()) {
      return { processed: 0, pending: await this.getQueueSize() };
    }

    if (queueProcessingPromise) {
      return queueProcessingPromise;
    }

    const processing = this.processQueueNow({ silent });
    queueProcessingPromise = processing;
    try {
      return await processing;
    } finally {
      if (queueProcessingPromise === processing) {
        queueProcessingPromise = null;
      }
      if (processAgainRequested) {
        const silentRerun = processAgainSilent;
        processAgainRequested = false;
        processAgainSilent = true;
        Promise.resolve().then(() => this.processQueue({ silent: silentRerun })).catch((error) => {
          console.error('Unable to continue offline queue sync:', error);
        });
      }
    }
  },

  async processQueueNow({ silent = false } = {}) {
    let processed = 0;
    const issues = [];
    const queue = await withQueueMutation(() => readJson(OFFLINE_QUEUE_KEY, []));
    const activeUserId = await currentUserId();

    for (const snapshotItem of queue) {
      let item = snapshotItem;
      if (item.localVisitId && cancelledVisitIds.has(String(item.localVisitId))) {
        continue;
      }
      if (item.status === 'blocked') {
        issues.push({ id: item.id, message: item.lastError || 'Item antrean perlu diperiksa.' });
        continue;
      }

      if (!item.ownerUserId) {
        issues.push({
          id: item.id,
          canClaim: Boolean(activeUserId),
          message: 'Item offline lama belum terikat ke akun. Konfirmasikan akun yang akan memilikinya sebelum sinkronisasi.',
        });
        continue;
      }

      if (!activeUserId || String(item.ownerUserId) !== activeUserId) {
        issues.push({
          id: item.id,
          message: !activeUserId
            ? 'Masuk dengan akun pemilik data untuk melanjutkan sinkronisasi.'
            : 'Data offline ini dibuat oleh akun lain. Masuk dengan akun tersebut untuk menyinkronkannya.',
        });
        continue;
      }

      try {
        const executionResult = await executeItem(item);
        if (executionResult?.cancelled && executionResult.serverVisitId) {
          await this.addItem(`/visits/${executionResult.serverVisitId}`, 'delete', {}, {}, {
            kind: 'visit_cancel',
            ownerUserId: item.ownerUserId,
          });
          continue;
        }
        await removeQueuedItem(item.id);
        processed++;
      } catch (error) {
        if (error.code === 'OFFLINE_OWNER_MISMATCH') {
          issues.push({ id: item.id, message: error.message });
          continue;
        }

        if (error.isDependencyPending) {
          continue;
        }

        const message = String(error?.response?.data?.message || error?.message || 'Sinkronisasi gagal');
        const status = error?.response?.status;
        const permanentRejection = status >= 400
          && status < 500
          && status !== 401
          && status !== 408
          && status !== 429;
        await updateQueuedItem(item.id, (current) => ({
          ...current,
          retries: (current.retries || 0) + 1,
          lastError: message,
          lastAttemptAt: new Date().toISOString(),
          ...(permanentRejection ? { status: 'blocked' } : {}),
        }));
        console.error(`Failed to sync ${item.method} ${item.endpoint}:`, error);

        if (permanentRejection) {
          issues.push({ id: item.id, message });
        } else {
          const retryMessage = 'Sinkronisasi belum berhasil. Data tetap tersimpan di perangkat dan akan dicoba lagi saat koneksi tersedia.';
          issues.push({ id: item.id, message: retryMessage });
        }
      }
    }

    const pending = await this.getQueueSize();
    if (!silent && issues.length > 0) {
      Alert.alert('Sinkronisasi Perlu Perhatian', issues[0].message);
    }
    if (processed > 0 && pending === 0 && issues.length === 0) {
      if (silent) {
        await writeJson(OFFLINE_SYNC_NOTICE_KEY, {
          ownerUserId: activeUserId,
          processed,
          completedAt: new Date().toISOString(),
        });
      } else {
        Alert.alert('Sinkronisasi Berhasil', 'Semua data offline berhasil dikirim.');
      }
    }
    return { processed, pending, issues };
  },

  async consumeSyncSuccessNotice(ownerUserId) {
    return withQueueMutation(async () => {
      const notice = await readJson(OFFLINE_SYNC_NOTICE_KEY, null);
      if (!notice || String(notice.ownerUserId) !== String(ownerUserId)) {
        return null;
      }

      await AsyncStorage.removeItem(OFFLINE_SYNC_NOTICE_KEY);
      return notice;
    });
  },

  async getQueueSize() {
    const queue = await readJson(OFFLINE_QUEUE_KEY, []);
    return queue.length;
  },

  async clearQueue() {
    const photoUris = await withQueueMutation(async () => {
      const queue = await readJson(OFFLINE_QUEUE_KEY, []);
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
      await AsyncStorage.removeItem(OFFLINE_VISIT_MAP_KEY);
      await AsyncStorage.removeItem(OFFLINE_SYNC_NOTICE_KEY);
      return queue.flatMap((item) => (
        Array.isArray(item.data?.photos) ? item.data.photos.map((photo) => photo.uri) : []
      ));
    });
    return { cleanupFailed: await deleteLocalPhotoFiles(photoUris) };
  },
};
