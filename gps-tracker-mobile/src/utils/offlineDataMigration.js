export const OFFLINE_QUEUE_KEY = 'offlineQueue';
export const OFFLINE_VISIT_MAP_KEY = 'offlineVisitServerMap';
export const OFFLINE_STORE_CACHE_KEY = 'offlineAvailableStores';
export const OFFLINE_SYNC_NOTICE_KEY = 'offlineSyncSuccessNotice';
export const LEGACY_OFFLINE_STORAGE_MIGRATION_KEY = 'offlineVisitStorageMigrationV1';

const LEGACY_OFFLINE_STORAGE_KEYS = new Set([
  OFFLINE_QUEUE_KEY,
  OFFLINE_VISIT_MAP_KEY,
  OFFLINE_STORE_CACHE_KEY,
  OFFLINE_SYNC_NOTICE_KEY,
]);

const parseQueue = (raw) => {
  let queue;
  try {
    queue = JSON.parse(raw);
  } catch (error) {
    throw new Error('Data antrean offline lama tidak dapat dibaca. Data lama tetap disimpan.');
  }

  if (!Array.isArray(queue)) {
    throw new Error('Format antrean offline lama tidak valid. Data lama tetap disimpan.');
  }

  return queue;
};

const unique = (values) => [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];

export const isLegacyOfflineStorageKey = (key) => (
  typeof key === 'string'
  && (LEGACY_OFFLINE_STORAGE_KEYS.has(key) || key.startsWith(`${OFFLINE_STORE_CACHE_KEY}:`))
);

const readMigrationMarker = (raw) => {
  if (!raw) return null;

  try {
    const marker = JSON.parse(raw);
    if (marker?.version !== 1 || !Array.isArray(marker.photoUris)) {
      throw new Error('Versi migrasi antrean offline tidak didukung.');
    }
    return marker;
  } catch (error) {
    throw new Error('Status migrasi antrean offline tidak dapat dibaca. Data lama tetap disimpan.');
  }
};

const removeLegacyKeys = async (legacyStorage, keys) => {
  for (const key of keys) {
    await legacyStorage.removeItem(key);
  }
};

export const migrateLegacyOfflineData = async ({
  legacyStorage,
  secureStorage,
  encryptPhoto,
  cleanupLegacyPhotoFiles,
}) => {
  const legacyKeys = (await legacyStorage.getAllKeys()).filter(isLegacyOfflineStorageKey);
  const markerRaw = await secureStorage.getItem(LEGACY_OFFLINE_STORAGE_MIGRATION_KEY);
  const existingMarker = readMigrationMarker(markerRaw);

  if (existingMarker) {
    await cleanupLegacyPhotoFiles(unique(existingMarker.photoUris));
    await removeLegacyKeys(legacyStorage, legacyKeys);
    return { migrated: false, keys: legacyKeys.length, photos: existingMarker.photoUris.length };
  }

  const entries = [];
  const photoUris = [];

  for (const key of legacyKeys) {
    const raw = await legacyStorage.getItem(key);
    if (raw === null) continue;

    let value = raw;
    if (key === OFFLINE_QUEUE_KEY) {
      const queue = parseQueue(raw);
      const migratedQueue = [];

      for (const item of queue) {
        if (item?.endpoint !== '/visit/photos' || !Array.isArray(item?.data?.photos)) {
          migratedQueue.push(item);
          continue;
        }

        const photos = [];
        for (const [index, photo] of item.data.photos.entries()) {
          if (!photo?.uri) {
            photos.push(photo);
            continue;
          }

          const photoKey = photo.client_uuid || String(index);
          const encryptedUri = await encryptPhoto(photo.uri, item.id || 'legacy', photoKey);
          if (typeof encryptedUri !== 'string' || !encryptedUri) {
            throw new Error('Foto antrean offline lama belum berhasil dienkripsi. Data lama tetap disimpan.');
          }

          if (encryptedUri !== photo.uri) {
            photoUris.push(photo.uri);
          }
          photos.push({ ...photo, uri: encryptedUri });
        }

        migratedQueue.push({ ...item, data: { ...item.data, photos } });
      }

      value = JSON.stringify(migratedQueue);
    }

    entries.push({ key, value });
  }

  const photoUrisToClean = unique(photoUris);
  const markerValue = JSON.stringify({ version: 1, photoUris: photoUrisToClean });
  await secureStorage.commit(entries, LEGACY_OFFLINE_STORAGE_MIGRATION_KEY, markerValue);

  if (await secureStorage.getItem(LEGACY_OFFLINE_STORAGE_MIGRATION_KEY) !== markerValue) {
    throw new Error('Verifikasi penanda migrasi antrean offline gagal. Data lama tetap disimpan.');
  }

  for (const entry of entries) {
    if (await secureStorage.getItem(entry.key) !== entry.value) {
      throw new Error('Verifikasi data antrean offline terenkripsi gagal. Data lama tetap disimpan.');
    }
  }

  await cleanupLegacyPhotoFiles(photoUrisToClean);
  await removeLegacyKeys(legacyStorage, legacyKeys);

  return { migrated: entries.length > 0, keys: entries.length, photos: photoUrisToClean.length };
};
