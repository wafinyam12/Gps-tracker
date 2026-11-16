import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyKycDraftEntries } from '../src/utils/kycDraftMigration.js';

const makeStores = (legacyJson, encryptedJson = null) => {
  const legacy = new Map([['customer_kyc_drafts:42', legacyJson]]);
  const encrypted = new Map(encryptedJson === null ? [] : [['42', encryptedJson]]);
  return {
    legacy,
    encrypted,
    legacyStorage: {
      getAllKeys: async () => [...legacy.keys()],
      getItem: async (key) => legacy.get(key) ?? null,
      removeItem: async (key) => { legacy.delete(key); },
    },
    encryptedStorage: {
      getItem: async (userId) => encrypted.get(userId) ?? null,
      setItem: async (userId, value) => { encrypted.set(userId, value); },
    },
  };
};

test('valid legacy KYC drafts are verified in encrypted storage before plaintext is removed', async () => {
  const stores = makeStores('[{"id":1}]');
  await migrateLegacyKycDraftEntries(stores);
  assert.equal(stores.encrypted.get('42'), '[{"id":1}]');
  assert.equal(stores.legacy.size, 0);
});

test('malformed legacy KYC drafts remain available for recovery', async () => {
  const stores = makeStores('{bad');
  await assert.rejects(migrateLegacyKycDraftEntries(stores), /tidak valid/i);
  assert.equal(stores.legacy.get('customer_kyc_drafts:42'), '{bad');
  assert.equal(stores.encrypted.size, 0);
});

test('conflicting encrypted KYC drafts do not erase the older source', async () => {
  const stores = makeStores('[{"id":1}]', '[{"id":2}]');
  await assert.rejects(migrateLegacyKycDraftEntries(stores), /berbeda/i);
  assert.equal(stores.legacy.get('customer_kyc_drafts:42'), '[{"id":1}]');
  assert.equal(stores.encrypted.get('42'), '[{"id":2}]');
});

test('an unverified encrypted write keeps the legacy KYC drafts', async () => {
  const stores = makeStores('[{"id":1}]');
  stores.encryptedStorage.getItem = async () => null;
  await assert.rejects(migrateLegacyKycDraftEntries(stores), /verifikasi/i);
  assert.equal(stores.legacy.get('customer_kyc_drafts:42'), '[{"id":1}]');
});
