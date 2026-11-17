import assert from 'node:assert/strict';
import test from 'node:test';

const { validateTargetRangeDraft, buildTargetRangePayload } = await import('../src/utils/targetRangePresentation.js').catch(() => ({}));

const sales = [{ id: 4, name: 'Sales A' }, { id: 7, name: 'Sales B' }];
const base = {
  selection: 'selected',
  userIds: [4],
  dateFrom: '2026-11-17',
  dateTo: '2026-11-17',
  targetVisits: '6',
};

test('one date counts one day and one selected Sales', () => {
  assert.deepEqual(validateTargetRangeDraft?.(base, sales), {
    errors: {}, daysCount: 1, salesCount: 1,
  });
});

test('all mode includes the exact 31-day boundary and all eligible Sales', () => {
  assert.deepEqual(validateTargetRangeDraft?.({
    ...base, selection: 'all', userIds: [], dateFrom: '2026-11-01', dateTo: '2026-12-01',
  }, sales), { errors: {}, daysCount: 31, salesCount: 2 });
});

test('reversed and 32-day ranges are rejected', () => {
  assert.ok(validateTargetRangeDraft?.({ ...base, dateFrom: '2026-11-18' }, sales)?.errors?.dateTo);
  assert.ok(validateTargetRangeDraft?.({ ...base, dateFrom: '2026-11-01', dateTo: '2026-12-02' }, sales)?.errors?.dateTo);
});

test('selected mode needs a Sales and must use an eligible ID', () => {
  assert.ok(validateTargetRangeDraft?.({ ...base, userIds: [] }, sales)?.errors?.userIds);
  assert.ok(validateTargetRangeDraft?.({ ...base, userIds: [99] }, sales)?.errors?.userIds);
});

test('targets outside 1 to 100 and malformed dates are rejected', () => {
  assert.ok(validateTargetRangeDraft?.({ ...base, targetVisits: '0' }, sales)?.errors?.targetVisits);
  assert.ok(validateTargetRangeDraft?.({ ...base, targetVisits: '101' }, sales)?.errors?.targetVisits);
  assert.ok(validateTargetRangeDraft?.({ ...base, targetVisits: '1.5' }, sales)?.errors?.targetVisits);
  assert.ok(validateTargetRangeDraft?.({ ...base, dateFrom: '2026-02-30' }, sales)?.errors?.dateFrom);
});

test('request payload uses only approved fields and omits team ID', () => {
  assert.deepEqual(buildTargetRangePayload?.({ ...base, team_id: 999 }), {
    selection: 'selected',
    user_ids: [4],
    date_from: '2026-11-17',
    date_to: '2026-11-17',
    target_visits: 6,
  });
  assert.deepEqual(buildTargetRangePayload?.({ ...base, selection: 'all', userIds: [99] }), {
    selection: 'all',
    date_from: '2026-11-17',
    date_to: '2026-11-17',
    target_visits: 6,
  });
});
