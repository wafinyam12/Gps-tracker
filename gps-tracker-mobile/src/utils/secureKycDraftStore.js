import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { migrateLegacyKycDraftEntries } from './kycDraftMigration';

const LEGACY_STORAGE_PREFIX = 'customer_kyc_drafts:';
const DATABASE_KEY_STORAGE_KEY = 'customer_kyc_sqlcipher_key_v1';
const DATABASE_NAME = 'customer-kyc-encrypted.db';

let databasePromise;

const parseDrafts = (raw) => {
  if (!raw) return [];

  try {
    const drafts = JSON.parse(raw);
    return Array.isArray(drafts) ? drafts : [];
  } catch (error) {
    return [];
  }
};

const createDatabaseKey = async () => {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const getDatabaseKey = async () => {
  let key = await SecureStore.getItemAsync(DATABASE_KEY_STORAGE_KEY);

  if (!key) {
    key = await createDatabaseKey();
    await SecureStore.setItemAsync(DATABASE_KEY_STORAGE_KEY, key);
  }

  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error('The KYC database encryption key is invalid.');
  }

  return key;
};

const openEncryptedDatabase = async () => {
  const key = await getDatabaseKey();
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);

  try {
    // The key is generated locally as hexadecimal, so it cannot alter this pragma.
    await database.execAsync(`PRAGMA key = '${key}';`);
    const cipher = await database.getFirstAsync('PRAGMA cipher_version;');

    if (!cipher?.cipher_version) {
      throw new Error('SQLCipher is unavailable; refusing to store KYC drafts unencrypted.');
    }

    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS customer_kyc_drafts (
        user_id TEXT PRIMARY KEY NOT NULL,
        drafts_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
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

const writeDrafts = async (database, userId, drafts) => {
  await database.runAsync(
    `INSERT INTO customer_kyc_drafts (user_id, drafts_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       drafts_json = excluded.drafts_json,
       updated_at = excluded.updated_at`,
    userId,
    JSON.stringify(drafts),
    new Date().toISOString()
  );
};

export const migrateLegacyKycDrafts = async () => {
  const storageKeys = await AsyncStorage.getAllKeys();
  if (!storageKeys.some((key) => key.startsWith(LEGACY_STORAGE_PREFIX))) return;

  const database = await getDatabase();
  await migrateLegacyKycDraftEntries({
    legacyStorage: AsyncStorage,
    encryptedStorage: {
      getItem: async (userId) => {
        const row = await database.getFirstAsync(
          'SELECT drafts_json FROM customer_kyc_drafts WHERE user_id = ?',
          userId
        );
        return row?.drafts_json ?? null;
      },
      setItem: async (userId, value) => writeDrafts(database, userId, JSON.parse(value)),
    },
  });
};

export const getKycDrafts = async (userId) => {
  const normalizedUserId = userId === undefined || userId === null ? '' : String(userId).trim();

  if (!normalizedUserId) {
    throw new Error('A signed-in user is required to access KYC drafts.');
  }

  await migrateLegacyKycDrafts();
  const database = await getDatabase();
  const row = await database.getFirstAsync(
    'SELECT drafts_json FROM customer_kyc_drafts WHERE user_id = ?',
    normalizedUserId
  );

  return parseDrafts(row?.drafts_json);
};

export const saveKycDrafts = async (userId, drafts) => {
  const normalizedUserId = userId === undefined || userId === null ? '' : String(userId).trim();

  if (!normalizedUserId) {
    throw new Error('A signed-in user is required to save KYC drafts.');
  }

  const database = await getDatabase();
  await writeDrafts(database, normalizedUserId, drafts);
  const row = await database.getFirstAsync(
    'SELECT drafts_json FROM customer_kyc_drafts WHERE user_id = ?',
    normalizedUserId
  );
  if (row?.drafts_json !== JSON.stringify(drafts)) {
    throw new Error('Verifikasi draft KYC terenkripsi gagal. Data lama tetap disimpan.');
  }
  await AsyncStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${normalizedUserId}`);
};
