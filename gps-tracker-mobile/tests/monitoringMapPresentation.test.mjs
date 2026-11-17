import assert from 'node:assert/strict';
import test from 'node:test';
import { findSelectedMonitoringBranch, getMonitoringMapDataState, getMonitoringMapOverlayOffsets, getMonitoringMapScope, getSalesOnlineLabel } from '../src/utils/monitoringMapPresentation.js';

test('map controls clear the device status and navigation bars', () => {
  assert.deepEqual(getMonitoringMapOverlayOffsets({ top: 24, bottom: 20 }), { top: 32, bottom: 28 });
  assert.deepEqual(getMonitoringMapOverlayOffsets({ top: 0, bottom: 0 }), { top: 8, bottom: 8 });
});

test('scoped Area Manager cannot return to all branches', () => {
  assert.deepEqual(getMonitoringMapScope({
    scopeTeamId: 7,
    selectedTeamId: null,
    selectedBranchName: 'Cabang Surabaya',
    canAccessAllBranches: false,
  }), { label: 'Cabang Surabaya', canReturnToGlobal: false });
});

test('global admin can drill into one branch and return to all branches', () => {
  assert.deepEqual(getMonitoringMapScope({
    scopeTeamId: null,
    selectedTeamId: 7,
    selectedBranchName: 'Cabang Surabaya',
    canAccessAllBranches: true,
  }), { label: 'Cabang Surabaya', canReturnToGlobal: true });
  assert.deepEqual(getMonitoringMapScope({
    scopeTeamId: null,
    selectedTeamId: null,
    selectedBranchName: null,
    canAccessAllBranches: true,
  }), { label: 'Semua cabang', canReturnToGlobal: false });
});

test('unknown scope does not imply global access', () => {
  assert.deepEqual(getMonitoringMapScope({
    scopeTeamId: null,
    selectedTeamId: null,
    selectedBranchName: null,
    canAccessAllBranches: false,
  }), { label: 'Cakupan cabang belum tersedia', canReturnToGlobal: false });
});

test('failed location loading is distinct from a successful empty map', () => {
  assert.equal(getMonitoringMapDataState({ loadError: true, hasLocations: false }), 'error');
  assert.equal(getMonitoringMapDataState({ loadError: false, hasLocations: false }), 'empty');
  assert.equal(getMonitoringMapDataState({ loadError: false, hasLocations: true }), 'ready');
});

test('Sales location chips identify online state with text', () => {
  assert.equal(getSalesOnlineLabel(true), 'Online');
  assert.equal(getSalesOnlineLabel(false), 'Offline');
});

test('branch scope label resolves when API IDs use a different numeric type', () => {
  const branch = { id: '7', name: 'Cabang Surabaya' };
  assert.equal(findSelectedMonitoringBranch([branch], 7), branch);
  assert.equal(findSelectedMonitoringBranch([branch], null), undefined);
});
