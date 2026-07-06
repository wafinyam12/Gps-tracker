const VISIT_MAX_ACCURACY_METERS = 300;
const VISIT_MAX_LOCATION_AGE_MS = 5 * 60 * 1000;
const VISIT_MAX_FUTURE_SKEW_MS = 60 * 1000;

const toNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const toIsoTimestamp = (timestamp) => {
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) {
    return undefined;
  }

  return new Date(timestampMs).toISOString();
};

export const buildVisitLocationPayload = (location) => {
  const latitude = toNumber(location?.coords?.latitude);
  const longitude = toNumber(location?.coords?.longitude);
  const accuracy = toNumber(location?.coords?.accuracy);

  return {
    latitude,
    longitude,
    accuracy,
    is_mock_location: Boolean(location?.mocked),
    location_recorded_at: toIsoTimestamp(location?.timestamp),
  };
};

export const evaluateVisitLocation = (location) => {
  const payload = buildVisitLocationPayload(location);

  if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
    return {
      isValid: false,
      reason: 'missing_location',
      title: 'Lokasi Belum Tersedia',
      message: 'Aplikasi belum mendapatkan titik GPS. Pastikan GPS aktif lalu coba lagi.',
      payload,
    };
  }

  if (payload.is_mock_location) {
    return {
      isValid: false,
      reason: 'mock_location',
      title: 'Fake GPS Terdeteksi',
      message: 'Matikan mock location/fake GPS, lalu ambil ulang lokasi sebelum melanjutkan visit.',
      payload,
    };
  }

  const timestampMs = Number(location?.timestamp);
  if (Number.isFinite(timestampMs)) {
    const ageMs = Date.now() - timestampMs;

    if (ageMs > VISIT_MAX_LOCATION_AGE_MS) {
      return {
        isValid: false,
        reason: 'stale_location',
        title: 'Lokasi Terlalu Lama',
        message: 'Titik GPS sudah terlalu lama. Ambil ulang lokasi sebelum melanjutkan visit.',
        payload,
      };
    }

    if (ageMs < -VISIT_MAX_FUTURE_SKEW_MS) {
      return {
        isValid: false,
        reason: 'future_location',
        title: 'Waktu Perangkat Tidak Valid',
        message: 'Waktu lokasi terlihat tidak valid. Periksa jam perangkat lalu coba lagi.',
        payload,
      };
    }
  }

  if (
    Number.isFinite(payload.accuracy)
    && payload.accuracy > VISIT_MAX_ACCURACY_METERS
  ) {
    return {
      isValid: false,
      reason: 'low_accuracy',
      title: 'GPS Belum Presisi',
      message: 'Lokasi belum cukup akurat. Aktifkan GPS presisi, tunggu beberapa detik, lalu coba lagi.',
      payload,
    };
  }

  return {
    isValid: true,
    reason: null,
    title: '',
    message: '',
    payload,
  };
};
