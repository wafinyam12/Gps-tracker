const hasCoordinate = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));

export const buildVisitLocationAuditRows = ({ visit = {}, store = {}, checkinDistance = null, checkinRadius = null }) => {
  const distance = checkinDistance === null ? 'Belum diketahui' : `${Math.round(checkinDistance)} m`;
  const radius = checkinRadius === null ? '' : ` · Radius: ${checkinRadius} m`;
  const rows = [`Jarak: ${distance}${radius}`];

  if (hasCoordinate(visit.checkin_accuracy)) {
    rows.push(`Akurasi GPS: ±${Math.round(Number(visit.checkin_accuracy))} m`);
  }
  if (hasCoordinate(visit.checkin_latitude) && hasCoordinate(visit.checkin_longitude)) {
    rows.push(`Titik check-in: ${Number(visit.checkin_latitude).toFixed(6)}, ${Number(visit.checkin_longitude).toFixed(6)}`);
  }
  if (hasCoordinate(store.latitude) && hasCoordinate(store.longitude)) {
    rows.push(`Koordinat toko tersimpan: ${Number(store.latitude).toFixed(6)}, ${Number(store.longitude).toFixed(6)}`);
  }
  rows.push(`Dihitung ke target: ${visit.counted_as_target ? 'Ya' : 'Tidak'}`);
  return rows;
};
