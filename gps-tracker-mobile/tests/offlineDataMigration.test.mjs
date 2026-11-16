import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_OFFLINE_STORAGE_MIGRATION_KEY,
  isLegacyOfflineStorageKey,
  migrateLegacyOfflineData,
} from '../src/utils/offlineDataMigration.js';

const makeStorage = (initialEntries = {}) => {
  const values = new Map(Object.entries(initialEntries));
  return {
    values,
    async getAllKeys() {
      return [...values.keys()];
    },
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
};

const makeSecureStorage = () => {
  const values = new Map();
  return {
    values,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async commit(entries, markerKey, markerValue) {
      for (const { key, value } of entries) {
        values.set(key, value);
      }
      values.set(markerKey, markerValue);
    },
  };
};

test('only selects legacy visit queue/cache keys for migration', () => {
  assert.equal(isLegacyOfflineStorageKey('offlineQueue'), true);
  assert.equal(isLegacyOfflineStorageKey('offlineVisitServerMap'), true);
  assert.equal(isLegacyOfflineStorageKey('offlineAvailableStores:42'), true);
  assert.equal(isLegacyOfflineStorageKey('offlineSyncSuccessNotice'), true);
  assert.equal(isLegacyOfflineStorageKey('user_data'), false);
  assert.equal(isLegacyOfflineStorageKey('customer_kyc_drafts:42'), false);
});

test('migrates visit queue and metadata before deleting legacy values and photos', async () => {
  const legacyQueue = [{
    id: 'queue-1',
    ownerUserId: '42',
    endpoint: '/visit/photos',
    kind: 'visit_photos',
    data: { photos: [{ uri: 'file:///legacy/visit.jpg', client_uuid: 'photo-1' }] },
  }];
  const legacyStorage = makeStorage({
    offlineQueue: JSON.stringify(legacyQueue),
    offlineVisitServerMap: JSON.stringify({ 'local-1': { visitLogId: 7, ownerUserId: '42' } }),
    'offlineAvailableStores:42': JSON.stringify({ savedAt: '2026-11-14', stores: [{ id: 5 }] }),
    offlineSyncSuccessNotice: JSON.stringify({ ownerUserId: '42', processed: 1 }),
    user_data: JSON.stringify({ id: 42 }),
  });
  const secureStorage = makeSecureStorage();
  const cleanupCalls = [];
  const encryptedCalls = [];

  const result = await migrateLegacyOfflineData({
    legacyStorage,
    secureStorage,
    async encryptPhoto(uri, itemId, photoKey) {
      encryptedCalls.push({ uri, itemId, photoKey });
      return `file:///secure/${itemId}-${photoKey}.enc`;
    },
    async cleanupLegacyPhotoFiles(uris) {
      cleanupCalls.push(uris);
    },
  });

  assert.equal(result.migrated, true);
  assert.deepEqual(encryptedCalls, [{ uri: 'file:///legacy/visit.jpg', itemId: 'queue-1', photoKey: 'photo-1' }]);
  assert.deepEqual(JSON.parse(secureStorage.values.get('offlineQueue'))[0].data.photos[0].uri, 'file:///secure/queue-1-photo-1.enc');
  assert.deepEqual(JSON.parse(secureStorage.values.get('offlineVisitServerMap')), { 'local-1': { visitLogId: 7, ownerUserId: '42' } });
  assert.equal(secureStorage.values.has(LEGACY_OFFLINE_STORAGE_MIGRATION_KEY), true);
  assert.deepEqual(cleanupCalls, [['file:///legacy/visit.jpg']]);
  assert.equal(await legacyStorage.getItem('offlineQueue'), null);
  assert.equal(await legacyStorage.getItem('offlineAvailableStores:42'), null);
  assert.notEqual(await legacyStorage.getItem('user_data'), null);
});

test('keeps legacy keys and source files when encrypted storage commit fails', async () => {
  const legacyStorage = makeStorage({
    offlineQueue: JSON.stringify([]),
  });
  const secureStorage = makeSecureStorage();
  secureStorage.commit = async () => {
    throw new Error('SQLCipher write failed');
  };
  let cleanupCalled = false;

  await assert.rejects(migrateLegacyOfflineData({
    legacyStorage,
    secureStorage,
    async encryptPhoto(uri) {
      return uri;
    },
    async cleanupLegacyPhotoFiles() {
      cleanupCalled = true;
    },
  }), /SQLCipher write failed/);

  assert.notEqual(await legacyStorage.getItem('offlineQueue'), null);
  assert.equal(cleanupCalled, false);
});

test('resumes cleanup without recopying data after a committed migration', async () => {
  const marker = JSON.stringify({ version: 1, photoUris: ['file:///legacy/visit.jpg'] });
  const legacyStorage = makeStorage({ offlineQueue: JSON.stringify([{ id: 'old' }]) });
  const secureStorage = makeSecureStorage();
  secureStorage.values.set(LEGACY_OFFLINE_STORAGE_MIGRATION_KEY, marker);
  let encryptCalled = false;
  const cleanupCalls = [];

  const result = await migrateLegacyOfflineData({
    legacyStorage,
    secureStorage,
    async encryptPhoto() {
      encryptCalled = true;
      return '';
    },
    async cleanupLegacyPhotoFiles(uris) {
      cleanupCalls.push(uris);
    },
  });

  assert.equal(result.migrated, false);
  assert.equal(encryptCalled, false);
  assert.deepEqual(cleanupCalls, [['file:///legacy/visit.jpg']]);
  assert.equal(await legacyStorage.getItem('offlineQueue'), null);
});

test('keeps an already encrypted photo reference during an idempotent migration', async () => {
  const encryptedUri = 'file:///secure/offline-visit-photos-encrypted/photo.enc';
  const legacyStorage = makeStorage({
    offlineQueue: JSON.stringify([{
      id: 'queue-1',
      endpoint: '/visit/photos',
      data: { photos: [{ uri: encryptedUri, client_uuid: 'photo-1' }] },
    }]),
  });
  const secureStorage = makeSecureStorage();
  const cleanupCalls = [];

  await migrateLegacyOfflineData({
    legacyStorage,
    secureStorage,
    async encryptPhoto(uri) {
      return uri;
    },
    async cleanupLegacyPhotoFiles(uris) {
      cleanupCalls.push(uris);
    },
  });

  assert.equal(JSON.parse(secureStorage.values.get('offlineQueue'))[0].data.photos[0].uri, encryptedUri);
  assert.deepEqual(cleanupCalls, [[]]);
});

test('preserves legacy keys when plaintext photo cleanup fails so startup can retry', async () => {
  const legacyStorage = makeStorage({
    offlineQueue: JSON.stringify([{
      id: 'queue-1',
      endpoint: '/visit/photos',
      data: { photos: [{ uri: 'file:///legacy/visit.jpg', client_uuid: 'photo-1' }] },
    }]),
  });
  const secureStorage = makeSecureStorage();
  let attempts = 0;

  await assert.rejects(migrateLegacyOfflineData({
    legacyStorage,
    secureStorage,
    async encryptPhoto() {
      return 'file:///secure/photo.enc';
    },
    async cleanupLegacyPhotoFiles() {
      attempts++;
      throw new Error('file is busy');
    },
  }), /file is busy/);

  assert.equal(attempts, 1);
  assert.notEqual(await legacyStorage.getItem('offlineQueue'), null);
  assert.equal(secureStorage.values.has(LEGACY_OFFLINE_STORAGE_MIGRATION_KEY), true);
});
