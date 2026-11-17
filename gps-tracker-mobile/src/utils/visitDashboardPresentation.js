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
  const excess = Math.max(unique - target, 0);

  return {
    actionLabel: summary?.open_visit?.visit_log_id ? 'Lanjut kunjungan' : 'Mulai kunjungan',
    progressLabel: `${unique} dari ${target}`,
    progressPercent: percent,
    progressFillPercent: Math.min(100, percent),
    progressStatus: excess > 0 ? `${percent}% · melebihi target ${excess}` : `${percent}% selesai`,
    unique,
    duplicates,
  };
};
