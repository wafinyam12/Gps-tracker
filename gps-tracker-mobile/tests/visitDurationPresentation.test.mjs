import assert from 'node:assert/strict';
import test from 'node:test';
import { getVisitDurationPresentation, buildCheckoutMapUrl } from '../src/utils/visitDurationPresentation.js';

test('completed presence gives separate estimated and unmeasured time', () => {
  const result = getVisitDurationPresentation({
    duration_minutes: 20,
    presence: { inside_seconds: 600, outside_seconds: 120, unmeasured_seconds: 480, status: 'complete' },
    checkout_radius_status: 'outside_radius', checkout_distance: 133.4,
  });
  assert.equal(result.insideLabel, '10 menit');
  assert.equal(result.outsideLabel, '2 menit');
  assert.equal(result.unmeasuredLabel, '8 menit');
  assert.match(result.checkoutLabel, /Di luar radius/);
  assert.match(result.checkoutLabel, /133 m/);
});

test('legacy visit and offline pending samples never appear as zero presence', () => {
  assert.equal(getVisitDurationPresentation({ duration_minutes: 25 }).insideLabel, 'Belum tersedia');
  assert.equal(getVisitDurationPresentation({ presence: { status: 'provisional', inside_seconds: 0, unmeasured_seconds: 300 } }).statusLabel, 'Menunggu sinkronisasi lokasi');
});

test('checkout map uses valid coordinates including zero and rejects missing values', () => {
  assert.match(buildCheckoutMapUrl({ latitude: 0, longitude: 0 }), /query=0%2C0/);
  assert.equal(buildCheckoutMapUrl({ latitude: null, longitude: 106.8 }), null);
  assert.equal(buildCheckoutMapUrl({ latitude: 91, longitude: 106.8 }), null);
});
