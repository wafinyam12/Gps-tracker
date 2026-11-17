export const getLocationPresentation = ({ location = null, loading = false, errorMsg = null } = {}) => {
  const rawAccuracy = location?.coords?.accuracy;
  const accuracy = Number(rawAccuracy);
  const updatedAt = Number(location?.timestamp);
  const validTime = Number.isFinite(updatedAt) && updatedAt > 0;

  return {
    statusLabel: loading ? 'Mencari GPS' : errorMsg || !location?.coords ? 'GPS belum tersedia' : 'GPS siap',
    tone: loading ? 'neutral' : errorMsg || !location?.coords ? 'warning' : 'success',
    accuracyLabel: location?.coords && rawAccuracy !== null && rawAccuracy !== undefined && Number.isFinite(accuracy)
      ? `Akurasi ${Math.round(accuracy)} m`
      : 'Akurasi belum tersedia',
    updatedLabel: validTime
      ? `Diperbarui ${new Date(updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' })}`
      : 'Waktu pembaruan belum tersedia',
  };
};
