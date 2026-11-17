const count = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const progress = (value) => Math.max(0, Math.min(100, count(value)));

export const canChooseMonitoringBranch = (roleName) => ['manager', 'admin', 'superadmin'].includes(roleName);

export const getMonitoringSummaryState = ({ loading, loadError, summaryData }) => {
  if (loading) return 'loading';
  if (loadError) return 'error';
  if (!summaryData) return 'empty';
  return 'ready';
};

export const getMonitoringSummaryMetrics = (summaryData) => {
  const overview = summaryData?.overview || {};
  return {
    overview: {
      target: count(overview.target_visits),
      unique: count(overview.unique_visits),
      duplicate: count(overview.duplicate_visits),
      completion: progress(overview.completion_pct),
      warnings: count(summaryData?.team_summary?.warning_count),
    },
    sales: (Array.isArray(summaryData?.sales) ? summaryData.sales : []).map((item) => {
      const summary = item.summary || {};
      return {
        userId: item.user_id,
        name: item.name || 'Sales',
        target: count(summary.target_visits),
        unique: count(summary.unique_visits),
        duplicate: count(summary.duplicate_visits),
        completion: progress(summary.completion_pct),
        mockGps: count(summary.mock_detected),
        invalidCheckins: count(summary.invalid_checkins),
      };
    }),
  };
};
