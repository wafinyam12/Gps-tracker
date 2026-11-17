import assert from 'node:assert/strict';
import test from 'node:test';
import { getSalesLocationPresentation, getWarningListPresentation, isMissingSalesLocation } from '../src/utils/monitoringDetailPresentation.js';

test('missing GPS stays missing without a fabricated map location', () => {
  const result = getSalesLocationPresentation({ name: 'Sales Uji', is_online: false }, []);
  assert.equal(result.status, 'Offline');
  assert.equal(result.location, null);
  assert.equal(result.coordinates, 'Belum ada data GPS');
  assert.equal(result.lastSeen, 'Belum ada data');
  assert.equal(result.distance, '0,0 km');
});

test('zero speed and battery remain values, and valid trail distance is calculated', () => {
  const result = getSalesLocationPresentation({
    is_online: true,
    last_seen_at_human: '2 menit lalu',
    location: { latitude: -6.2, longitude: 106.8, speed: 0, battery: 0, recorded_at: '2026-11-17 10:00' },
  }, [{ latitude: -6.2, longitude: 106.8 }, { latitude: -6.201, longitude: 106.8 }]);
  assert.equal(result.status, 'Online');
  assert.equal(result.lastSeen, '2 menit lalu');
  assert.equal(result.speedBattery, '0 km/jam · 0% baterai');
  assert.equal(result.coordinates, '-6.200000, 106.800000');
  assert.equal(result.trail.length, 2);
  assert.notEqual(result.distance, '0,0 km');
});

test('server UTC timestamps are shown as readable Jakarta time', () => {
  const result = getSalesLocationPresentation({
    last_seen_at: '2026-11-16T08:01:50.000000Z',
    location: { latitude: -6.2, longitude: 106.8, recorded_at: '2026-11-16T08:00:53.000000Z' },
  }, []);
  assert.equal(result.lastSeen, '16/11/2026 15:01 WIB');
  assert.equal(result.recordedAt, '16/11/2026 15:00 WIB');
});

test('invalid coordinates are excluded from trail and map marker', () => {
  const result = getSalesLocationPresentation({ location: { latitude: null, longitude: 106.8 } }, [
    { latitude: -6.2, longitude: 106.8 },
    { latitude: 'invalid', longitude: 106.8 },
  ]);
  assert.equal(result.location, null);
  assert.equal(result.trail.length, 1);
});

test('only the backend no-location response becomes a GPS empty state', () => {
  assert.equal(isMissingSalesLocation({ response: { status: 404, data: { message: 'Belum ada data lokasi untuk user ini.' } } }), true);
  assert.equal(isMissingSalesLocation({ response: { status: 404, data: { message: 'User tidak ditemukan' } } }), false);
  assert.equal(isMissingSalesLocation({ response: { status: 403, data: { message: 'Belum ada data lokasi untuk user ini.' } } }), false);
});

test('warning fetch error and empty success are distinct', () => {
  assert.equal(getWarningListPresentation({ loading: true, error: false, warnings: [], date: '2026-11-16' }).state, 'loading');
  assert.equal(getWarningListPresentation({ loading: false, error: true, warnings: [], date: '2026-11-16' }).state, 'error');
  assert.equal(getWarningListPresentation({ loading: false, error: false, warnings: [], date: '2026-11-16' }).state, 'empty');
  assert.equal(getWarningListPresentation({ loading: false, error: false, warnings: [{ user_id: 1 }], date: '2026-11-16' }).state, 'ready');
});
