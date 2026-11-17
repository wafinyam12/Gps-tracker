import assert from 'node:assert/strict';
import test from 'node:test';
import { canChooseMonitoringBranch, getMonitoringSummaryMetrics, getMonitoringSummaryState } from '../src/utils/monitoringSummaryPresentation.js';

test('missing summary remains a truthful zero state', () => {
  assert.deepEqual(getMonitoringSummaryMetrics(null), {
    overview: { target: 0, unique: 0, duplicate: 0, completion: 0, fill: 0, excess: 0, warnings: 0 },
    sales: [],
  });
});

test('all existing visit and audit counts remain available', () => {
  assert.deepEqual(getMonitoringSummaryMetrics({
    overview: { target_visits: 5, unique_visits: 3, duplicate_visits: 1, completion_pct: 60 },
    team_summary: { warning_count: 2 },
    sales: [{
      user_id: 9,
      name: 'Sales Satu',
      summary: { target_visits: 5, unique_visits: 3, duplicate_visits: 1, completion_pct: 60, mock_detected: 2, invalid_checkins: 1 },
    }],
  }), {
    overview: { target: 5, unique: 3, duplicate: 1, completion: 60, fill: 60, excess: 0, warnings: 2 },
    sales: [{ userId: 9, name: 'Sales Satu', target: 5, unique: 3, duplicate: 1, completion: 60, fill: 60, excess: 0, mockGps: 2, invalidCheckins: 1 }],
  });
});

test('a lowered target keeps all completed visits and shows overachievement', () => {
  const metrics = getMonitoringSummaryMetrics({
    overview: { target_visits: 5, unique_visits: 7, completion_pct: 140 },
    sales: [{ user_id: 9, summary: { target_visits: 5, unique_visits: 7, completion_pct: 140 } }],
  });
  assert.equal(metrics.overview.completion, 140);
  assert.equal(metrics.overview.fill, 100);
  assert.equal(metrics.overview.excess, 2);
  assert.equal(metrics.sales[0].completion, 140);
  assert.equal(metrics.sales[0].fill, 100);
  assert.equal(metrics.sales[0].excess, 2);
});

test('Area Manager has a fixed branch while admin and manager retain picker', () => {
  assert.equal(canChooseMonitoringBranch('spv'), false);
  assert.equal(canChooseMonitoringBranch('sales'), false);
  assert.equal(canChooseMonitoringBranch(undefined), false);
  assert.equal(canChooseMonitoringBranch('admin'), true);
  assert.equal(canChooseMonitoringBranch('superadmin'), true);
  assert.equal(canChooseMonitoringBranch('manager'), true);
});

test('failed summary fetch does not masquerade as an empty success', () => {
  assert.equal(getMonitoringSummaryState({ loading: true, loadError: false, summaryData: null }), 'loading');
  assert.equal(getMonitoringSummaryState({ loading: false, loadError: true, summaryData: null }), 'error');
  assert.equal(getMonitoringSummaryState({ loading: false, loadError: false, summaryData: null }), 'empty');
  assert.equal(getMonitoringSummaryState({ loading: false, loadError: false, summaryData: { sales: [] } }), 'ready');
});
