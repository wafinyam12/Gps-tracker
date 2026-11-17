export const canCaptureVisitPhoto = (count) => Number.isFinite(count) && count < 5;

export const formatVisitPhotoLocation = (location) => {
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return 'Lokasi tidak tersedia';
  }
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return 'Lokasi tidak tersedia';
  }
  return `${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`;
};
