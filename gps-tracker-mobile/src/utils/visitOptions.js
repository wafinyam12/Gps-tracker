export const VISIT_RESULTS = [
  { label: 'Ada Order', value: 'order_taken' },
  { label: 'Tidak Ada Order', value: 'no_order' },
  { label: 'Toko Tutup', value: 'closed' },
  { label: 'Tidak Ditemukan', value: 'not_found' },
  { label: 'Ditunda', value: 'postponed' },
];

export const ACTIVITY_TYPES = [
  { label: 'Sosialisasi Produk', value: 'sosialisasi_produk' },
  { label: 'Kirim Penawaran', value: 'kirim_penawaran' },
  { label: 'Kirim Contoh', value: 'kirim_contoh' },
  { label: 'Proses Purchase Order (PO)', value: 'proses_po' },
  { label: 'Proses Tagihan', value: 'proses_tagihan' },
  { label: 'Dll', value: 'dll' },
];

const getOptionLabel = (options, value, fallback = '-') => (
  options.find((item) => item.value === value)?.label || value || fallback
);

export const getVisitResultLabel = (value) => getOptionLabel(VISIT_RESULTS, value, 'belum disubmit');

export const getActivityTypeLabel = (value) => getOptionLabel(ACTIVITY_TYPES, value, '-');
