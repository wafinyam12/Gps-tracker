import assert from 'node:assert/strict';
import test from 'node:test';

const module = await import('../src/utils/visitLocationAudit.js').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('location audit keeps check-in distance, accuracy, coordinates, and target status available', () => {
  assert.equal(typeof module.buildVisitLocationAuditRows, 'function');
  const rows = module.buildVisitLocationAuditRows({
    visit: {
      checkin_accuracy: 12.5,
      checkin_latitude: -6.2,
      checkin_longitude: 106.8,
      counted_as_target: true,
    },
    store: { latitude: -6.201, longitude: 106.801 },
    checkinDistance: 42,
    checkinRadius: 100,
  });
  assert.deepEqual(rows, [
    'Jarak: 42 m · Radius: 100 m',
    'Akurasi GPS: ±13 m',
    'Titik check-in: -6.200000, 106.800000',
    'Koordinat toko tersimpan: -6.201000, 106.801000',
    'Dihitung ke target: Ya',
  ]);
});

test('missing location fields are explained without printing invalid coordinates', () => {
  const rows = module.buildVisitLocationAuditRows({ visit: { counted_as_target: false }, store: {}, checkinDistance: null, checkinRadius: null });
  assert.deepEqual(rows, ['Jarak: Belum diketahui', 'Dihitung ke target: Tidak']);
});
