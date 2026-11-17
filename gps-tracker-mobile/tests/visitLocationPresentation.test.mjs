import assert from 'node:assert/strict';
import test from 'node:test';

const module = await import('../src/utils/visitLocationPresentation.js').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('location status distinguishes loading, denied access, and a fresh fix', () => {
  assert.equal(typeof module.getLocationPresentation, 'function');
  assert.deepEqual(module.getLocationPresentation({ loading: true }), {
    statusLabel: 'Mencari GPS',
    tone: 'neutral',
    accuracyLabel: 'Akurasi belum tersedia',
    updatedLabel: 'Waktu pembaruan belum tersedia',
  });
  assert.equal(module.getLocationPresentation({ errorMsg: 'Izin lokasi diperlukan.' }).statusLabel, 'GPS belum tersedia');
  const fresh = module.getLocationPresentation({
    location: { coords: { latitude: -6.2, longitude: 106.8, accuracy: 12.4 }, timestamp: Date.UTC(2026, 10, 17, 2, 42) },
  });
  assert.equal(fresh.statusLabel, 'GPS siap');
  assert.equal(fresh.accuracyLabel, 'Akurasi 12 m');
  assert.equal(fresh.updatedLabel, 'Diperbarui 09.42');
});

test('missing GPS accuracy is not displayed as zero meters', () => {
  const result = module.getLocationPresentation({ location: { coords: { latitude: -6.2, longitude: 106.8, accuracy: null } } });
  assert.equal(result.accuracyLabel, 'Akurasi belum tersedia');
});
