const FIELDS = [
  'taken_at',
  'latitude',
  'longitude',
  'accuracy',
  'location_recorded_at',
  'is_mock_location',
];

export const createVisitPhotoMetadata = (capturedAt, location) => {
  const metadata = { taken_at: capturedAt };
  const { coords, timestamp, mocked } = location || {};
  if (!Number.isFinite(coords?.latitude) || !Number.isFinite(coords?.longitude)
    || !Number.isFinite(coords?.accuracy) || !Number.isFinite(timestamp)) {
    return metadata;
  }

  return {
    ...metadata,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    location_recorded_at: new Date(timestamp).toISOString(),
    ...(typeof mocked === 'boolean' ? { is_mock_location: mocked } : {}),
  };
};

export const appendVisitPhotoMetadata = (formData, photos) => {
  if (!photos?.length || !photos.every((photo) => photo.metadata?.taken_at)) return false;

  photos.forEach((photo, index) => {
    FIELDS.forEach((field) => {
      const value = photo.metadata[field];
      if (value === undefined || value === null) return;
      formData.append(
        `photo_metadata[${index}][${field}]`,
        typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
      );
    });
  });
  return true;
};
