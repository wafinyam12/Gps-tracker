const secondsLabel = (seconds) => {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return 'Belum tersedia';
  const minutes = Math.round(Number(seconds) / 6) / 10;
  return `${minutes.toLocaleString('id-ID', { maximumFractionDigits: 1 })} menit`;
};

const safeCoordinate = (value, limit) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
};

export const buildCheckoutMapUrl = ({ latitude, longitude } = {}) => {
  const lat = safeCoordinate(latitude, 90);
  const lon = safeCoordinate(longitude, 180);
  return lat === null || lon === null
    ? null
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
};

export const getVisitDurationPresentation = (visit = {}) => {
  const presence = visit?.presence || {};
  const status = presence.status || 'legacy_unverified';
  const unmeasured = Number(presence.unmeasured_seconds || 0);
  const noMeasuredTime = Number(presence.inside_seconds || 0) === 0
    && Number(presence.outside_seconds || 0) === 0 && unmeasured > 0;
  const checkoutStatus = visit.checkout_radius_status;
  const checkoutDistance = Number(visit.checkout_distance);
  const distanceText = Number.isFinite(checkoutDistance) && visit.checkout_distance !== null
    ? ` · ${Math.round(checkoutDistance)} m` : '';

  return {
    durationLabel: visit.duration_minutes === null || visit.duration_minutes === undefined
      ? 'Belum tersedia' : `${visit.duration_minutes} menit`,
    statusLabel: status === 'complete' ? 'Estimasi selesai'
      : status === 'provisional' ? 'Menunggu sinkronisasi lokasi' : 'Belum tersedia',
    insideLabel: status === 'legacy_unverified' || noMeasuredTime
      ? 'Belum tersedia' : secondsLabel(presence.inside_seconds),
    outsideLabel: status === 'legacy_unverified' || noMeasuredTime
      ? 'Belum tersedia' : secondsLabel(presence.outside_seconds),
    unmeasuredLabel: status === 'legacy_unverified'
      ? 'Belum tersedia' : secondsLabel(presence.unmeasured_seconds),
    checkoutLabel: checkoutStatus === 'inside_radius' ? `Di dalam radius${distanceText}`
      : checkoutStatus === 'outside_radius' ? `Di luar radius${distanceText}`
        : checkoutStatus === 'uncertain' ? 'GPS checkout tidak pasti' : 'Belum tersedia',
  };
};
