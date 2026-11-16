import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import { logEvent } from './diagnosticLogger';
import {
  LEGACY_OFFLINE_STORAGE_MIGRATION_KEY,
  migrateLegacyOfflineData,
} from './offlineDataMigration';
import { createSqlcipherPhotoRepository, isSqlcipherPhotoReference } from './sqlcipherPhotoRepository';

const DATABASE_NAME = 'offline-visits-encrypted.db';
const DATABASE_KEY_STORAGE_KEY = 'offline_visits_sqlcipher_key_v1';
const PENDING_TEMP_PHOTO_CLEANUP_KEY = 'offlineVisitPendingPlaintextPhotoCleanup';
const LEGACY_PHOTO_DIRECTORY = new Directory(Paths.document, 'offline-visit-photos');
const UPLOAD_TEMP_DIRECTORY = new Directory(Paths.cache, 'offline-visit-upload-temp');

let databasePromise;
let readyPromise;
let temporaryPhotoCleanupPromise = Promise.resolve();

const toHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const getDatabaseKey = async () => {
  let key = await SecureStore.getItemAsync(DATABASE_KEY_STORAGE_KEY);
  if (!key) {
    key = toHex(await Crypto.getRandomBytesAsync(32));
    await SecureStore.setItemAsync(DATABASE_KEY_STORAGE_KEY, key);
  }

  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error('Kunci database kunjungan terenkripsi tidak valid.');
  }

  return key;
};

const openEncryptedDatabase = async () => {
  const key = await getDatabaseKey();
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);

  try {
    await database.execAsync(`PRAGMA key = '${key}';`);
    const cipher = await database.getFirstAsync('PRAGMA cipher_version;');
    if (!cipher?.cipher_version) {
      throw new Error('SQLCipher tidak tersedia. Data kunjungan offline tidak disimpan.');
    }

    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS secure_offline_values (
        storage_key TEXT PRIMARY KEY NOT NULL,
        storage_value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS secure_offline_photos (
        photo_id TEXT PRIMARY KEY NOT NULL,
        photo_bytes BLOB NOT NULL
      );
    `);

    return database;
  } catch (error) {
    await database.closeAsync().catch(() => {});
    throw error;
  }
};

const getDatabase = async () => {
  if (!databasePromise) {
    databasePromise = openEncryptedDatabase();
  }

  try {
    return await databasePromise;
  } catch (error) {
    databasePromise = undefined;
    throw error;
  }
};

const getRawValue = async (database, key) => {
  const row = await database.getFirstAsync(
    'SELECT storage_value FROM secure_offline_values WHERE storage_key = ?',
    key
  );
  return row?.storage_value ?? null;
};

const setRawValue = async (database, key, value) => {
  await database.runAsync(
    `INSERT INTO secure_offline_values (storage_key, storage_value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(storage_key) DO UPDATE SET
       storage_value = excluded.storage_value,
       updated_at = excluded.updated_at`,
    key,
    value,
    new Date().toISOString()
  );
};

const commitMigration = async (database, entries, markerKey, markerValue) => {
  await database.withExclusiveTransactionAsync(async (transaction) => {
    for (const entry of entries) {
      await setRawValue(transaction, entry.key, entry.value);
    }
    await setRawValue(transaction, markerKey, markerValue);
  });
};

const hashPhotoIdentity = async (itemId, photoKey) => Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  `${String(itemId)}|${String(photoKey)}`
);

const isWithin = (uri, directory) => {
  const prefix = directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
  return typeof uri === 'string' && uri.startsWith(prefix);
};

const getPhotoRepository = async () => createSqlcipherPhotoRepository({
  database: await getDatabase(),
  digestIdentity: hashPhotoIdentity,
  readSourceBytes: async (uri) => {
    const source = new File(uri);
    if (!source.exists) throw new Error('Foto antrean kunjungan tidak ditemukan di perangkat.');
    return source.bytes();
  },
  writeUploadBytes: async (digest, bytes) => {
    UPLOAD_TEMP_DIRECTORY.create({ intermediates: true, idempotent: true });
    const temporaryFile = new File(UPLOAD_TEMP_DIRECTORY, `${digest}.jpg`);
    temporaryFile.create({ intermediates: true, overwrite: true });
    await temporaryFile.write(bytes);
    return temporaryFile.uri;
  },
});

const encryptPhoto = async (sourceUri, itemId, photoKey) => (
  (await getPhotoRepository()).persist(sourceUri, itemId, photoKey)
);

const deleteFileIfExists = (uri, allowedDirectories) => {
  if (!allowedDirectories.some((directory) => isWithin(uri, directory))) {
    return false;
  }

  const file = new File(uri);
  if (file.exists) file.delete();
  return true;
};

const cleanupLegacyPhotoFiles = async (photoUris = []) => {
  try {
    for (const uri of photoUris) {
      if (!deleteFileIfExists(uri, [Paths.cache, LEGACY_PHOTO_DIRECTORY])) {
        throw new Error('Foto lama berada di luar direktori yang dapat dibersihkan.');
      }
    }

    if (LEGACY_PHOTO_DIRECTORY.exists) {
      LEGACY_PHOTO_DIRECTORY.delete();
    }
  } catch (error) {
    logEvent('offline.legacy_photo_cleanup_failed', { error_code: error?.code });
    throw new Error('Foto offline lama belum bisa dibersihkan. Data terenkripsi tetap dipertahankan.');
  }
};

const cleanupTemporaryPhotoUris = async (photoUris, database) => {
  const pendingRaw = await getRawValue(database, PENDING_TEMP_PHOTO_CLEANUP_KEY);
  let pending = [];
  if (pendingRaw) {
    try {
      const parsed = JSON.parse(pendingRaw);
      if (!Array.isArray(parsed) || parsed.some((uri) => typeof uri !== 'string')) {
        throw new Error('Daftar pembersihan foto offline tidak valid.');
      }
      pending = parsed;
    } catch (error) {
      throw new Error('Daftar pembersihan foto offline tidak dapat dibaca.');
    }
  }

  const remaining = new Set(pending);
  for (const uri of photoUris) {
    if (typeof uri === 'string' && uri.length > 0) remaining.add(uri);
  }

  for (const uri of [...remaining]) {
    try {
      if (deleteFileIfExists(uri, [Paths.cache])) {
        remaining.delete(uri);
      }
    } catch (error) {
      // Keep the encrypted cleanup pointer and retry it on the next launch.
    }
  }

  if (remaining.size > 0) {
    await setRawValue(database, PENDING_TEMP_PHOTO_CLEANUP_KEY, JSON.stringify([...remaining]));
  } else {
    await database.runAsync(
      'DELETE FROM secure_offline_values WHERE storage_key = ?',
      PENDING_TEMP_PHOTO_CLEANUP_KEY
    );
  }

  return remaining.size > 0;
};

const cleanupUploadTempFiles = async () => {
  if (UPLOAD_TEMP_DIRECTORY.exists) {
    UPLOAD_TEMP_DIRECTORY.delete();
  }
};

const initialize = async () => {
  const database = await getDatabase();
  await migrateLegacyOfflineData({
    legacyStorage: AsyncStorage,
    secureStorage: {
      getItem: (key) => getRawValue(database, key),
      commit: (entries, markerKey, markerValue) => commitMigration(database, entries, markerKey, markerValue),
    },
    encryptPhoto,
    cleanupLegacyPhotoFiles,
  });
  await cleanupUploadTempFiles();
  await cleanupTemporaryPhotoUris([], database);
};

const ensureReady = async () => {
  if (!readyPromise) {
    readyPromise = initialize();
  }

  try {
    return await readyPromise;
  } catch (error) {
    readyPromise = undefined;
    throw error;
  }
};

const materializePhotoForUpload = async (encryptedUri, itemId, photoKey) => {
  await ensureReady();
  return (await getPhotoRepository()).materialize(encryptedUri, itemId, photoKey);
};

export const secureOfflineVisitStorage = {
  async getItem(key) {
    await ensureReady();
    return getRawValue(await getDatabase(), key);
  },

  async setItem(key, value) {
    await ensureReady();
    await setRawValue(await getDatabase(), key, value);
  },

  async removeItem(key) {
    await ensureReady();
    await (await getDatabase()).runAsync(
      'DELETE FROM secure_offline_values WHERE storage_key = ?',
      key
    );
  },

  async getAllKeys() {
    await ensureReady();
    const rows = await (await getDatabase()).getAllAsync(
      'SELECT storage_key FROM secure_offline_values WHERE storage_key != ?',
      LEGACY_OFFLINE_STORAGE_MIGRATION_KEY
    );
    return rows.map((row) => row.storage_key);
  },

  async persistPhoto(sourceUri, itemId, photoKey) {
    await ensureReady();
    return encryptPhoto(sourceUri, itemId, photoKey);
  },

  async materializePhotoForUpload(encryptedUri, itemId, photoKey) {
    return materializePhotoForUpload(encryptedUri, itemId, photoKey);
  },

  async deletePhotoFiles(uris) {
    let cleanupFailed = false;
    const repository = await getPhotoRepository();
    for (const uri of new Set(uris)) {
      try {
        if (!isSqlcipherPhotoReference(uri)) {
          cleanupFailed = true;
          continue;
        }
        await repository.remove(uri);
      } catch (error) {
        cleanupFailed = true;
      }
    }
    return cleanupFailed;
  },

  async deleteTemporaryPhotoFiles(uris) {
    await ensureReady();
    const database = await getDatabase();
    const operation = () => cleanupTemporaryPhotoUris(uris, database);
    const cleanup = temporaryPhotoCleanupPromise.then(operation, operation);
    temporaryPhotoCleanupPromise = cleanup.catch(() => {});
    return cleanup;
  },

  async deleteUploadTempFile(uri) {
    try {
      deleteFileIfExists(uri, [UPLOAD_TEMP_DIRECTORY]);
      return false;
    } catch (error) {
      return true;
    }
  },
};
