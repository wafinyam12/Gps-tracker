import assert from 'node:assert/strict';
import test from 'node:test';

const module = await import('../src/utils/visitPhotoPresentation.js').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('camera stops accepting photos at the five-photo limit', () => {
  assert.equal(typeof module.canCaptureVisitPhoto, 'function');
  assert.equal(module.canCaptureVisitPhoto(0), true);
  assert.equal(module.canCaptureVisitPhoto(4), true);
  assert.equal(module.canCaptureVisitPhoto(5), false);
});

test('gallery formats valid coordinates and explains missing coordinates', () => {
  assert.equal(module.formatVisitPhotoLocation({ latitude: '-6.2', longitude: '106.8' }), '-6.2000, 106.8000');
  assert.equal(module.formatVisitPhotoLocation({ latitude: null, longitude: 106.8 }), 'Lokasi tidak tersedia');
});
