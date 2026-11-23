import assert from 'node:assert/strict';
import test from 'node:test';

const module = await import('../src/utils/visitStorePresentation.js').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('a store without coordinates explains why route and distance are unavailable', () => {
  assert.equal(typeof module.getStoreDistanceLabel, 'function');
  assert.equal(module.getStoreDistanceLabel(false, null), 'Koordinat belum tersedia');
});

test('a store with coordinates distinguishes missing GPS from a measured distance', () => {
  assert.equal(module.getStoreDistanceLabel(true, null), 'Jarak menunggu GPS');
  assert.equal(module.getStoreDistanceLabel(true, 350), '350 m dari lokasi Anda');
  assert.equal(module.getStoreDistanceLabel(true, 1250), '1,3 km dari lokasi Anda');
});

test('customer card names Area Manager ownership separately from Sales ownership', () => {
  assert.equal(module.getStoreOwnerLabel({ owner_role: 'spv', sales_owner_name: 'AM Utomo' }), 'Area Manager: AM Utomo');
  assert.equal(module.getStoreOwnerLabel({ owner_role: 'sales', sales_owner_name: 'Sales Utomo' }), 'Sales: Sales Utomo');
  assert.equal(module.getStoreOwnerLabel({ sales_owner_name: 'Sales Lama' }), 'Sales: Sales Lama');
});
