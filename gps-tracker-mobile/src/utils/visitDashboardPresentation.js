const nonNegative = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

export const getVisitDashboardPresentation = (summary = {}) => {
  const stats = summary?.stats || {};
  const target = nonNegative(stats.target_visits);
  const unique = nonNegative(stats.unique_visits);
  const duplicates = nonNegative(stats.duplicate_visits);
  const percent = nonNegative(stats.completion_pct);

  return {
    actionLabel: summary?.open_visit?.visit_log_id ? 'Lanjut kunjungan' : 'Mulai kunjungan',
    progressLabel: `${unique} dari ${target}`,
    progressPercent: Math.min(100, percent),
    unique,
    duplicates,
  };
};
