const LEGACY_STORAGE_PREFIX = 'customer_kyc_drafts:';

const parseDraftsStrict = (raw) => {
  try {
    const drafts = JSON.parse(raw);
    if (Array.isArray(drafts)) return drafts;
  } catch (error) {
    // Preserve the source below.
  }
  throw new Error('Format draft KYC lama tidak valid. Data lama tetap disimpan.');
};

export const migrateLegacyKycDraftEntries = async ({ legacyStorage, encryptedStorage }) => {
  const storageKeys = await legacyStorage.getAllKeys();
  for (const storageKey of storageKeys.filter((key) => key.startsWith(LEGACY_STORAGE_PREFIX))) {
    const userId = storageKey.slice(LEGACY_STORAGE_PREFIX.length);
    if (!userId) throw new Error('Pemilik draft KYC lama tidak valid. Data lama tetap disimpan.');

    const raw = await legacyStorage.getItem(storageKey);
    if (raw === null) continue;
    const normalized = JSON.stringify(parseDraftsStrict(raw));
    const existing = await encryptedStorage.getItem(userId);
    if (existing !== null && JSON.stringify(parseDraftsStrict(existing)) !== normalized) {
      throw new Error('Draft KYC lama dan terenkripsi berbeda. Keduanya tetap disimpan.');
    }
    if (existing === null) await encryptedStorage.setItem(userId, normalized);

    const verified = await encryptedStorage.getItem(userId);
    if (verified === null || JSON.stringify(parseDraftsStrict(verified)) !== normalized) {
      throw new Error('Verifikasi draft KYC terenkripsi gagal. Data lama tetap disimpan.');
    }
    await legacyStorage.removeItem(storageKey);
  }
};
