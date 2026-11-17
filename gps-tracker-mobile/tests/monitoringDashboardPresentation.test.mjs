import assert from 'node:assert/strict';
import test from 'node:test';
import { getMonitoringDashboardActions } from '../src/utils/monitoringDashboardPresentation.js';

test('Area Manager sees monitoring and own visits without admin setup', () => {
  assert.deepEqual(getMonitoringDashboardActions('spv'), [
    'LiveMap', 'TeamSummary', 'Home', 'Profile',
  ]);
  assert.deepEqual(getMonitoringDashboardActions('manager'), [
    'LiveMap', 'TeamSummary', 'Home', 'Profile',
  ]);
});

test('admin roles retain user and branch setup without personal visit', () => {
  for (const role of ['admin', 'superadmin']) {
    assert.deepEqual(getMonitoringDashboardActions(role), [
      'LiveMap', 'UserList', 'TeamList', 'TeamSummary', 'Profile',
    ]);
  }
});

test('Sales and unknown roles receive no monitoring-dashboard routes', () => {
  assert.deepEqual(getMonitoringDashboardActions('sales'), []);
  assert.deepEqual(getMonitoringDashboardActions(undefined), []);
});
