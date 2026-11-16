const PHOTO_REFERENCE_PREFIX = 'sqlcipher-photo://v1/';

export const isSqlcipherPhotoReference = (uri) => (
  typeof uri === 'string' && uri.startsWith(PHOTO_REFERENCE_PREFIX)
);

const bytesEqual = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

const requireBytes = (value) => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new Error('Data foto kunjungan tidak dapat dibaca.');
};

const digestFromReference = (reference) => {
  if (!isSqlcipherPhotoReference(reference)) {
    throw new Error('Referensi foto kunjungan terenkripsi tidak valid.');
  }
  const digest = reference.slice(PHOTO_REFERENCE_PREFIX.length);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(digest)) {
    throw new Error('Referensi foto kunjungan terenkripsi tidak valid.');
  }
  return digest;
};

export const createSqlcipherPhotoRepository = ({
  database,
  digestIdentity,
  readSourceBytes,
  writeUploadBytes,
}) => {
  const expectedDigest = async (itemId, photoKey) => {
    const digest = await digestIdentity(itemId, photoKey);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(digest)) {
      throw new Error('Identitas foto kunjungan tidak valid.');
    }
    return digest;
  };

  const readPhoto = async (digest) => {
    const row = await database.getFirstAsync(
      'SELECT photo_bytes FROM secure_offline_photos WHERE photo_id = ?',
      digest
    );
    return row?.photo_bytes == null ? null : requireBytes(row.photo_bytes);
  };

  return {
    async persist(sourceUri, itemId, photoKey) {
      const digest = await expectedDigest(itemId, photoKey);
      const reference = `${PHOTO_REFERENCE_PREFIX}${digest}`;

      if (isSqlcipherPhotoReference(sourceUri)) {
        if (sourceUri !== reference || !(await readPhoto(digest))) {
          throw new Error('Foto antrean terenkripsi tidak sesuai atau tidak ditemukan.');
        }
        return reference;
      }
      if (typeof sourceUri !== 'string' || sourceUri.includes('/offline-visit-photos-encrypted/')) {
        throw new Error('Foto terenkripsi SDK 58 tidak dapat dibaca di staging SDK 54. Data antrean tetap disimpan.');
      }

      const sourceBytes = requireBytes(await readSourceBytes(sourceUri));
      if (sourceBytes.length === 0) throw new Error('Foto antrean kunjungan kosong.');

      await database.runAsync(
        'INSERT OR IGNORE INTO secure_offline_photos (photo_id, photo_bytes) VALUES (?, ?)',
        digest,
        sourceBytes
      );
      const storedBytes = await readPhoto(digest);
      if (!storedBytes || !bytesEqual(storedBytes, sourceBytes)) {
        throw new Error('Verifikasi foto kunjungan terenkripsi gagal.');
      }
      return reference;
    },

    async materialize(reference, itemId, photoKey) {
      const digest = digestFromReference(reference);
      if (digest !== await expectedDigest(itemId, photoKey)) {
        throw new Error('Referensi foto kunjungan tidak sesuai dengan antrean.');
      }
      const bytes = await readPhoto(digest);
      if (!bytes) throw new Error('Foto antrean kunjungan terenkripsi tidak ditemukan.');
      return writeUploadBytes(digest, bytes);
    },

    async remove(reference) {
      const digest = digestFromReference(reference);
      await database.runAsync('DELETE FROM secure_offline_photos WHERE photo_id = ?', digest);
    },
  };
};
