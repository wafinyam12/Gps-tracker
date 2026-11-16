import test from 'node:test';
import assert from 'node:assert/strict';
import { createSqlcipherPhotoRepository } from '../src/utils/sqlcipherPhotoRepository.js';

const makeDatabase = () => {
  const photos = new Map();
  return {
    photos,
    async runAsync(sql, digest, bytes) {
      if (sql.startsWith('INSERT')) {
        if (!photos.has(digest)) photos.set(digest, new Uint8Array(bytes));
      } else if (sql.startsWith('DELETE')) {
        photos.delete(digest);
      } else {
        throw new Error(`Unexpected SQL: ${sql}`);
      }
    },
    async getFirstAsync(sql, digest) {
      if (!sql.startsWith('SELECT')) throw new Error(`Unexpected SQL: ${sql}`);
      const photo_bytes = photos.get(digest);
      return photo_bytes ? { photo_bytes } : null;
    },
  };
};

const makeRepository = (database, uploaded) => createSqlcipherPhotoRepository({
  database,
  digestIdentity: async (itemId, photoKey) => `${itemId}-${photoKey}`,
  readSourceBytes: async (uri) => {
    if (uri !== 'file:///camera/photo.jpg') throw new Error('Unexpected photo source');
    return new Uint8Array([10, 20, 30, 40]);
  },
  writeUploadBytes: async (digest, bytes) => {
    uploaded.set(digest, new Uint8Array(bytes));
    return `file:///cache/${digest}.jpg`;
  },
});

test('an offline photo survives a repository restart and produces its original upload bytes', async () => {
  const database = makeDatabase();
  const uploaded = new Map();
  const firstRun = makeRepository(database, uploaded);
  const reference = await firstRun.persist('file:///camera/photo.jpg', 'queue-1', 'photo-1');

  assert.equal(reference, 'sqlcipher-photo://v1/queue-1-photo-1');
  assert.deepEqual([...database.photos.get('queue-1-photo-1')], [10, 20, 30, 40]);

  const restarted = makeRepository(database, uploaded);
  const uploadUri = await restarted.materialize(reference, 'queue-1', 'photo-1');
  assert.equal(uploadUri, 'file:///cache/queue-1-photo-1.jpg');
  assert.deepEqual([...uploaded.get('queue-1-photo-1')], [10, 20, 30, 40]);
});

test('a photo reference is returned only after its encrypted database value verifies', async () => {
  const database = makeDatabase();
  database.getFirstAsync = async () => ({ photo_bytes: new Uint8Array([99]) });
  const repository = makeRepository(database, new Map());

  await assert.rejects(
    repository.persist('file:///camera/photo.jpg', 'queue-1', 'photo-1'),
    /verifikasi/i
  );
});

test('SDK 58 AES photo files and wrong queue identities cannot be uploaded as images', async () => {
  const database = makeDatabase();
  const repository = makeRepository(database, new Map());

  await assert.rejects(
    repository.persist('file:///documents/offline-visit-photos-encrypted/photo.enc', 'queue-1', 'photo-1'),
    /SDK 58/i
  );
  const reference = await repository.persist('file:///camera/photo.jpg', 'queue-1', 'photo-1');
  await assert.rejects(repository.materialize(reference, 'queue-2', 'photo-1'), /tidak sesuai/i);
  assert.equal(database.photos.size, 1);
});

test('removing a queued photo deletes the encrypted BLOB', async () => {
  const database = makeDatabase();
  const repository = makeRepository(database, new Map());
  const reference = await repository.persist('file:///camera/photo.jpg', 'queue-1', 'photo-1');
  await repository.remove(reference);
  await assert.rejects(repository.materialize(reference, 'queue-1', 'photo-1'), /tidak ditemukan/i);
});
