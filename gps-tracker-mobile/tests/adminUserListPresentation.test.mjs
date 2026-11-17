import assert from 'node:assert/strict';
import test from 'node:test';
import { getAdminUserListPresentation } from '../src/utils/adminUserListPresentation.js';

test('a failed user request does not become an empty successful list', () => {
  assert.deepEqual(getAdminUserListPresentation({ loading: false, error: true, shown: 0, total: 0 }), {
    state: 'error', result: '0 user ditampilkan',
  });
});

test('result text distinguishes a truncated page from all filtered results', () => {
  assert.deepEqual(getAdminUserListPresentation({ loading: false, error: false, shown: 100, total: 143 }), {
    state: 'ready', result: '100 dari 143 user ditampilkan',
  });
  assert.deepEqual(getAdminUserListPresentation({ loading: false, error: false, shown: 3, total: 3 }), {
    state: 'ready', result: '3 user ditampilkan',
  });
});

test('loading and empty states remain distinct', () => {
  assert.equal(getAdminUserListPresentation({ loading: true, error: false, shown: 0, total: 0 }).state, 'loading');
  assert.equal(getAdminUserListPresentation({ loading: false, error: false, shown: 0, total: 0 }).state, 'empty');
});
