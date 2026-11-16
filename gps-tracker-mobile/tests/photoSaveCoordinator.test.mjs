import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhotoSaveCoordinator } from '../src/utils/photoSaveCoordinator.js';

test('camera source cleanup waits until the offline save releases the photo', async () => {
  const cleaned = [];
  const coordinator = createPhotoSaveCoordinator(async (uris) => { cleaned.push(...uris); });
  coordinator.begin();
  const cleanup = coordinator.cleanupWhenSafe(['file:///cache/photo.jpg']);

  assert.equal(coordinator.canLeave(), false);
  assert.equal(coordinator.isSaving(), true);
  assert.deepEqual(cleaned, []);

  coordinator.finish();
  await cleanup;
  assert.deepEqual(cleaned, ['file:///cache/photo.jpg']);
  assert.equal(coordinator.canLeave(), true);
});

test('successful save may navigate away but cleanup still waits for save completion', async () => {
  const cleaned = [];
  const coordinator = createPhotoSaveCoordinator(async (uris) => { cleaned.push(...uris); });
  coordinator.begin();
  coordinator.allowLeave();
  const cleanup = coordinator.cleanupWhenSafe(['file:///cache/photo.jpg']);

  assert.equal(coordinator.canLeave(), true);
  assert.deepEqual(cleaned, []);
  coordinator.finish();
  await cleanup;
  assert.deepEqual(cleaned, ['file:///cache/photo.jpg']);
});
