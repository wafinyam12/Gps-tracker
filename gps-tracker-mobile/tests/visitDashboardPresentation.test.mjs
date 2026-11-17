import assert from 'node:assert/strict';
import test from 'node:test';

const module = await import('../src/utils/visitDashboardPresentation.js').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('an open visit makes the primary action continue that visit', () => {
  assert.equal(typeof module.getVisitDashboardPresentation, 'function');
  const result = module.getVisitDashboardPresentation({
    open_visit: { visit_log_id: 17 },
    stats: { target_visits: 5, unique_visits: 2, duplicate_visits: 1, completion_pct: 40 },
  });
  assert.equal(result.actionLabel, 'Lanjut kunjungan');
  assert.equal(result.progressLabel, '2 dari 5');
  assert.equal(result.progressPercent, 40);
  assert.equal(result.progressFillPercent, 40);
  assert.equal(result.progressStatus, '40% selesai');
});

test('empty and excessive progress data remain usable', () => {
  const empty = module.getVisitDashboardPresentation({});
  assert.equal(empty.actionLabel, 'Mulai kunjungan');
  assert.equal(empty.progressLabel, '0 dari 0');
  assert.equal(empty.progressPercent, 0);
  assert.equal(empty.progressFillPercent, 0);

  const excessive = module.getVisitDashboardPresentation({ stats: { target_visits: 2, unique_visits: 3, completion_pct: 150 } });
  assert.equal(excessive.progressPercent, 150);
  assert.equal(excessive.progressFillPercent, 100);
  assert.equal(excessive.progressLabel, '3 dari 2');
  assert.equal(excessive.progressStatus, '150% · melebihi target 1');
});
