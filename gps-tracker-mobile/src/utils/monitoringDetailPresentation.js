const coordinate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const validPoint = (point) => {
  const latitude = coordinate(point?.latitude);
  const longitude = coordinate(point?.longitude);
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
};

const radians = (value) => value * Math.PI / 180;

const distanceMeters = (from, to) => {
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
};

const measure = (value, fallback) => value === null || value === undefined || value === '' ? fallback : String(value);

const formatGpsTime = (value) => {
  if (!value) return 'Belum ada data';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return String(value);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  const jakarta = new Date(timestamp + 7 * 60 * 60 * 1000);
  const pad = (number) => String(number).padStart(2, '0');
  return `${pad(jakarta.getUTCDate())}/${pad(jakarta.getUTCMonth() + 1)}/${jakarta.getUTCFullYear()} ${pad(jakarta.getUTCHours())}:${pad(jakarta.getUTCMinutes())} WIB`;
};

export const isMissingSalesLocation = (error) => error?.response?.status === 404
  && error?.response?.data?.message === 'Belum ada data lokasi untuk user ini.';

export const getSalesLocationPresentation = (userData, history) => {
  const location = validPoint(userData?.location);
  const trail = (Array.isArray(history) ? history : []).map(validPoint).filter(Boolean);
  let totalMeters = 0;
  for (let index = 1; index < trail.length; index += 1) {
    totalMeters += distanceMeters(trail[index - 1], trail[index]);
  }

  return {
    status: userData?.is_online ? 'Online' : 'Offline',
    lastSeen: formatGpsTime(userData?.last_seen_at_human || userData?.last_seen_at),
    location,
    trail,
    coordinates: location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'Belum ada data GPS',
    recordedAt: formatGpsTime(userData?.location?.recorded_at || userData?.last_seen_at),
    distance: `${(totalMeters / 1000).toFixed(1).replace('.', ',')} km`,
    speedBattery: `${measure(userData?.location?.speed, '-')} km/jam · ${measure(userData?.location?.battery, '-')}% baterai`,
  };
};

export const getWarningListPresentation = ({ loading, error, warnings, date }) => ({
  state: loading ? 'loading' : error ? 'error' : Array.isArray(warnings) && warnings.length > 0 ? 'ready' : 'empty',
  warnings: Array.isArray(warnings) ? warnings : [],
  date,
});
