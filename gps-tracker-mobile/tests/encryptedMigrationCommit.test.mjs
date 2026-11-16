import test from 'node:test';
import assert from 'node:assert/strict';
import { commitEncryptedMigration } from '../src/utils/encryptedMigrationCommit.js';

test('migration writes metadata and marker through the already keyed SQLCipher connection', async () => {
  const values = new Map();
  const database = {
    async withExclusiveTransactionAsync() {
      throw new Error('A new SQLCipher connection has no key');
    },
    async withTransactionAsync(task) {
      const before = new Map(values);
      try { await task(); } catch (error) {
        values.clear();
        for (const [key, value] of before) values.set(key, value);
        throw error;
      }
    },
  };
  const write = async (connection, key, value) => {
    assert.equal(connection, database);
    values.set(key, value);
  };

  await commitEncryptedMigration(database, [{ key: 'offlineQueue', value: '[]' }], 'migration', 'done', write);
  assert.deepEqual([...values], [['offlineQueue', '[]'], ['migration', 'done']]);
});
