const coordinate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const radiusFor = (store) => {
  const radius = Number(store?.geofence_radius);
  return Number.isFinite(radius) && radius > 0 ? Math.min(50, Math.max(1, Math.round(radius))) : 50;
};

const distanceMeters = (a, b) => {
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const latA = a.latitude * Math.PI / 180;
  const latB = b.latitude * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
};

export const capturedStoreReference = (store) => {
  const latitude = coordinate(store?.latitude);
  const longitude = coordinate(store?.longitude);
  const hasLocation = latitude !== null && longitude !== null;
  return {
    captured_store_latitude: hasLocation ? latitude : null,
    captured_store_longitude: hasLocation ? longitude : null,
    captured_store_radius: radiusFor(store),
    captured_store_has_location: hasLocation,
  };
};

export const evaluateStartRadius = (store, gps) => {
  const reference = capturedStoreReference(store);
  const accuracy = coordinate(gps?.accuracy);
  if (!reference.captured_store_has_location) {
    return {
      canStart: true,
      status: accuracy !== null && accuracy <= 25 ? 'initial_reference' : 'uncertain',
      radiusMeters: reference.captured_store_radius,
      distanceMeters: null,
      message: accuracy !== null && accuracy <= 25
        ? 'Titik check-in pertama akan menjadi lokasi awal customer.'
        : 'Customer belum memiliki titik lokasi. Visit dapat dilanjutkan, tetapi lokasi awal perlu ditinjau.',
    };
  }

  const distance = distanceMeters(
    { latitude: reference.captured_store_latitude, longitude: reference.captured_store_longitude },
    { latitude: Number(gps.latitude), longitude: Number(gps.longitude) },
  );
  const accurate = accuracy !== null && accuracy <= reference.captured_store_radius;
  const inside = distance <= reference.captured_store_radius;
  return {
    canStart: accurate && inside,
    status: !accurate ? 'uncertain' : inside ? 'inside_radius' : 'outside_radius',
    radiusMeters: reference.captured_store_radius,
    distanceMeters: Math.round(distance),
    message: !accurate
      ? 'GPS belum cukup akurat. Tunggu sinyal membaik lalu ambil ulang lokasi.'
      : inside ? 'Lokasi berada dalam radius customer.'
        : `Jarak ${Math.round(distance)} m dari customer, di luar radius ${reference.captured_store_radius} m. Dekati customer lalu coba lagi.`,
  };
};
