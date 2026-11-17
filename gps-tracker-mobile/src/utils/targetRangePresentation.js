const DAY_MS = 24 * 60 * 60 * 1000;

const utcDay = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
    ? date.getTime()
    : null;
};

export const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const validateTargetRangeDraft = (draft, eligibleSales = []) => {
  const errors = {};
  const from = utcDay(draft.dateFrom);
  const to = utcDay(draft.dateTo);
  let daysCount = 0;

  if (from === null) errors.dateFrom = 'Pilih tanggal mulai yang valid.';
  if (to === null) errors.dateTo = 'Pilih tanggal selesai yang valid.';
  if (from !== null && to !== null) {
    daysCount = Math.round((to - from) / DAY_MS) + 1;
    if (daysCount < 1) errors.dateTo = 'Tanggal selesai harus sama atau setelah tanggal mulai.';
    else if (daysCount > 31) errors.dateTo = 'Rentang maksimal 31 hari.';
  }

  const target = String(draft.targetVisits ?? '').trim();
  if (!/^\d+$/.test(target) || Number(target) < 1 || Number(target) > 100) {
    errors.targetVisits = 'Isi target dari 1 sampai 100 kunjungan.';
  }

  const allowedIds = new Set(eligibleSales.map((item) => Number(item.id)));
  let salesCount = 0;
  if (draft.selection === 'all') {
    salesCount = eligibleSales.length;
    if (salesCount === 0) errors.userIds = 'Belum ada Sales aktif di cabang ini.';
  } else if (draft.selection === 'selected') {
    const ids = Array.isArray(draft.userIds) ? draft.userIds.map(Number) : [];
    salesCount = ids.length;
    if (ids.length === 0 || ids.length > 100 || new Set(ids).size !== ids.length || ids.some((id) => !allowedIds.has(id))) {
      errors.userIds = 'Pilih 1 sampai 100 Sales aktif dari cabang ini.';
    }
  } else {
    errors.selection = 'Pilih cara memilih Sales.';
  }

  return { errors, daysCount, salesCount };
};

export const buildTargetRangePayload = (draft) => ({
  selection: draft.selection,
  ...(draft.selection === 'selected' ? { user_ids: draft.userIds.map(Number) } : {}),
  date_from: draft.dateFrom,
  date_to: draft.dateTo,
  target_visits: Number(draft.targetVisits),
});
