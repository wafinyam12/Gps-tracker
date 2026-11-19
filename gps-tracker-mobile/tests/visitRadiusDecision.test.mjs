import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateStartRadius, capturedStoreReference } from '../src/utils/visitRadiusDecision.js';

test('known customer requires an accurate point inside radius', () => {
  const store = { latitude: -6.2, longitude: 106.8, geofence_radius: 50 };
  assert.equal(evaluateStartRadius(store, { latitude: -6.2, longitude: 106.8, accuracy: 10 }).canStart, true);
  assert.equal(evaluateStartRadius(store, { latitude: -6.1988, longitude: 106.8, accuracy: 10 }).canStart, false);
  assert.equal(evaluateStartRadius(store, { latitude: -6.2, longitude: 106.8, accuracy: 55 }).canStart, false);
});

test('first check-in without customer coordinates remains allowed', () => {
  const store = { latitude: null, longitude: null, geofence_radius: 50 };
  assert.equal(evaluateStartRadius(store, { latitude: -6.2, longitude: 106.8, accuracy: 25 }).canStart, true);
  assert.equal(evaluateStartRadius(store, { latitude: -6.2, longitude: 106.8, accuracy: 26 }).canStart, true);
});

test('offline reference preserves zero coordinates and radius cap', () => {
  assert.deepEqual(capturedStoreReference({ latitude: 0, longitude: 0, geofence_radius: 80 }), {
    captured_store_latitude: 0,
    captured_store_longitude: 0,
    captured_store_radius: 50,
    captured_store_has_location: true,
  });
});
