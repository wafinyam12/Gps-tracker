export const getStoreDistanceLabel = (hasCoordinates, distanceMeters) => {
  if (!hasCoordinates) return 'Koordinat belum tersedia';
  if (!Number.isFinite(distanceMeters)) return 'Jarak menunggu GPS';
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m dari lokasi Anda`;
  return `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} km dari lokasi Anda`;
};
