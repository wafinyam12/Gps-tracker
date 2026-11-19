import assert from 'node:assert/strict';
import test from 'node:test';
import { appendVisitPhotoMetadata, createVisitPhotoMetadata } from '../src/utils/visitPhotoMetadata.js';

class FormDataRecorder {
  entries = [];

  append(key, value) {
    this.entries.push([key, value]);
  }
}

test('photo metadata keeps the GPS fix measured for that shutter press', () => {
  const metadata = createVisitPhotoMetadata('2026-11-19T13:51:00.000Z', {
    coords: { latitude: -7.973899, longitude: 112.748395, accuracy: 12 },
    timestamp: Date.parse('2026-11-19T13:51:03.000Z'),
    mocked: false,
  });

  assert.deepEqual(metadata, {
    taken_at: '2026-11-19T13:51:00.000Z',
    latitude: -7.973899,
    longitude: 112.748395,
    accuracy: 12,
    location_recorded_at: '2026-11-19T13:51:03.000Z',
    is_mock_location: false,
  });
});

test('photo remains uploadable when fresh GPS is unavailable', () => {
  const metadata = createVisitPhotoMetadata('2026-11-19T13:51:00.000Z', null);
  assert.deepEqual(metadata, { taken_at: '2026-11-19T13:51:00.000Z' });

  const form = new FormDataRecorder();
  assert.equal(appendVisitPhotoMetadata(form, [{ metadata }]), true);
  assert.deepEqual(form.entries, [['photo_metadata[0][taken_at]', '2026-11-19T13:51:00.000Z']]);
});

test('two photos serialize separate points instead of one shared geotag', () => {
  const first = createVisitPhotoMetadata('2026-11-19T13:51:00.000Z', {
    coords: { latitude: -7.973899, longitude: 112.748395, accuracy: 12 },
    timestamp: Date.parse('2026-11-19T13:51:01.000Z'),
    mocked: false,
  });
  const second = createVisitPhotoMetadata('2026-11-19T13:52:00.000Z', {
    coords: { latitude: -7.973910, longitude: 112.748410, accuracy: 19 },
    timestamp: Date.parse('2026-11-19T13:52:02.000Z'),
    mocked: false,
  });
  const form = new FormDataRecorder();

  assert.equal(appendVisitPhotoMetadata(form, [{ metadata: first }, { metadata: second }]), true);
  assert.ok(form.entries.some(([key, value]) => key === 'photo_metadata[0][latitude]' && value === '-7.973899'));
  assert.ok(form.entries.some(([key, value]) => key === 'photo_metadata[1][latitude]' && value === '-7.97391'));
  assert.ok(form.entries.some(([key, value]) => key === 'photo_metadata[1][accuracy]' && value === '19'));
});

test('offline retry uses saved metadata even when encrypted photo URI changes', () => {
  const queued = JSON.parse(JSON.stringify({
    uri: 'encrypted://photo-1',
    metadata: createVisitPhotoMetadata('2026-11-19T13:51:00.000Z', {
      coords: { latitude: -7.973899, longitude: 112.748395, accuracy: 12 },
      timestamp: Date.parse('2026-11-19T13:51:03.000Z'),
      mocked: false,
    }),
  }));
  const form = new FormDataRecorder();

  assert.equal(appendVisitPhotoMetadata(form, [{ ...queued, uri: 'file:///temporary-upload.jpg' }]), true);
  assert.ok(form.entries.some(([key, value]) => key === 'photo_metadata[0][location_recorded_at]'
    && value === '2026-11-19T13:51:03.000Z'));
  assert.ok(form.entries.some(([key, value]) => key === 'photo_metadata[0][is_mock_location]' && value === '0'));
});

test('legacy queued photos omit indexed metadata entirely', () => {
  const form = new FormDataRecorder();
  assert.equal(appendVisitPhotoMetadata(form, [{ uri: 'encrypted://old-photo' }]), false);
  assert.deepEqual(form.entries, []);
});
