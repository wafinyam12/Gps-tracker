import assert from 'node:assert/strict';
import test from 'node:test';
const module = await import('../src/utils/userSapCode.js').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('Sales requires a code while Area Manager may keep an own SAP code', () => {
  assert.equal(typeof module.requiresSapCode, 'function');
  assert.equal(module.requiresSapCode('sales'), true);
  assert.equal(module.requiresSapCode('spv'), false);
  assert.equal(module.acceptsSapCode('spv'), true);
  assert.equal(module.sapCodeForPayload('spv', ' 50 '), '50');
  assert.equal(module.sapCodeForPayload('sales', ' 47 '), '47');
});

test('unrelated roles do not send an old SAP code', () => {
  assert.equal(module.acceptsSapCode('manager'), false);
  assert.equal(module.sapCodeForPayload('manager', '50'), null);
  assert.equal(module.sapCodeForPayload('spv', '  '), null);
});
