import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Picker } from '@react-native-picker/picker';
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, ChevronDown, ChevronUp, MapPin, Navigation, Save } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { visitService } from '../api/services/visitService';
import PhotoPreviewModal from '../components/PhotoPreviewModal';
import { normalizePhoneNumber } from '../utils/phone';
import { canOpenRoute, openGoogleMapsRoute } from '../utils/maps';
import { evaluateVisitLocation } from '../utils/locationIntegrity';

const VISIT_RESULTS = [
  { label: 'Ada Order', value: 'order_taken' },
  { label: 'Tidak Ada Order', value: 'no_order' },
  { label: 'Toko Tutup', value: 'closed' },
  { label: 'Tidak Ditemukan', value: 'not_found' },
  { label: 'Ditunda', value: 'postponed' },
];

const ACTIVITY_TYPES = [
  { label: 'Sosialisasi Produk', value: 'sosialisasi_produk' },
  { label: 'Kirim Penawaran', value: 'kirim_penawaran' },
  { label: 'Kirim Contoh', value: 'kirim_contoh' },
  { label: 'Proses Purchase Order (PO)', value: 'proses_po' },
  { label: 'Proses Tagihan', value: 'proses_tagihan' },
  { label: 'Dll', value: 'dll' },
];

const EMPTY_FORM = {
  visitResult: 'order_taken',
  activityType: 'sosialisasi_produk',
  picName: '',
  customerResponse: '',
  notes: '',
};

const INVOICE_PREVIEW_LIMIT = 3;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return String(value);
  }

  return `Rp ${amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
};

const formatDateOnly = (value) => {
  if (!value) {
    return '-';
  }

  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return text;
  }

  const [, year, month, day] = match;
  const monthName = MONTH_NAMES[Number(month) - 1] || month;

  return `${day} ${monthName} ${year}`;
};

const getInvoiceReference = (invoice) => invoice?.invoice_no || invoice?.doc_num || invoice?.doc_entry || '-';
const getInvoiceType = (invoice) => invoice?.document_type || 'Invoice';

function VisitFormScreen({ route, navigation }) {
  const { user } = useAuth();
  const { visitLogId: routeVisitLogId } = route.params || {};

  const [visitLogId, setVisitLogId] = useState(routeVisitLogId || null);
  const [visit, setVisit] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(Boolean(routeVisitLogId));
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);
  const [photoPreviewIndex, setPhotoPreviewIndex] = useState(0);
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const isMountedRef = useRef(true);

  const resolvedVisitLogId = visitLogId || routeVisitLogId || null;
  const isCheckedOut = Boolean(visit?.checkout_at);
  const store = visit?.store || {};
  const hasStoreRoute = canOpenRoute(store);
  const sapOutstanding = store?.sap_outstanding_receivable || null;
  const storeName = store?.name || sapOutstanding?.card_name || sapOutstanding?.customer_name || 'Toko';
  const storeAddress = store?.address || sapOutstanding?.address || sapOutstanding?.customer_address || '';
  const sapInvoices = Array.isArray(sapOutstanding?.invoices) ? sapOutstanding.invoices : [];
  const visibleSapInvoices = showAllInvoices ? sapInvoices : sapInvoices.slice(0, INVOICE_PREVIEW_LIMIT);
  const sapCustomerCode = sapOutstanding?.card_code
    || sapOutstanding?.customer_code
    || store?.external_bp_code
    || store?.code
    || '-';
  const sapCustomerName = sapOutstanding?.card_name
    || sapOutstanding?.customer_name
    || store?.name
    || 'Customer SAP';
  const sapPaymentTerms = sapOutstanding?.payment_terms || '';
  const storePicName = visit?.form_data?.pic_name
    || store?.pic_name
    || sapOutstanding?.pic_name
    || '';
  const storePicPhone = normalizePhoneNumber(
    visit?.form_data?.pic_phone
      || store?.pic_phone
      || sapOutstanding?.pic_phone
  );
  const sapDocumentCount = Number(
    sapOutstanding?.total_document_outstanding
    ?? sapOutstanding?.invoice_count
    ?? sapInvoices.length
    ?? 0
  );
  const sapArCount = Number(sapOutstanding?.total_ar_invoice_outstanding ?? 0);
  const sapDpCount = Number(sapOutstanding?.total_dp_invoice_outstanding ?? 0);
  const sapInvoicesHaveNominalDetail = sapInvoices.some((invoice) => (
    invoice?.balance_due !== null
    && invoice?.balance_due !== undefined
  ) || (
    invoice?.doc_total !== null
    && invoice?.doc_total !== undefined
  ) || (
    invoice?.paid_to_date !== null
    && invoice?.paid_to_date !== undefined
  ));
  const photoPreviews = Array.isArray(visit?.photos_preview) ? visit.photos_preview : [];
  const photoCount = Number(visit?.photos_count || 0);

  const hydrateForm = useCallback((visitData) => {
    const visitFormData = visitData?.form_data || {};

    setForm({
      visitResult: visitData?.visit_result || EMPTY_FORM.visitResult,
      activityType: visitFormData.activity_type || EMPTY_FORM.activityType,
      picName: visitFormData.pic_name || visitData?.store?.pic_name || '',
      customerResponse: visitFormData.customer_response || '',
      notes: visitData?.notes || visitFormData.notes || '',
    });
  }, []);

  const loadVisit = useCallback(async () => {
    if (!resolvedVisitLogId) {
      if (isMountedRef.current) {
        setLoading(false);
      }
      return;
    }

    if (isMountedRef.current) {
      setLoading(true);
    }
    try {
      const response = await visitService.getVisit(resolvedVisitLogId);
      if (!isMountedRef.current) {
        return;
      }

      const visitData = response.data?.visit || response.data?.data?.visit || null;
      setVisit(visitData);
      hydrateForm(visitData);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      console.log('Load visit error:', error.response?.data || error);
      Alert.alert('Error', 'Gagal memuat data kunjungan.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [hydrateForm, resolvedVisitLogId]);

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!isMountedRef.current) {
        return null;
      }

      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Izin lokasi diperlukan untuk checkout visit.');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (!isMountedRef.current) {
        return null;
      }

      setCurrentLocation(location);
      return location;
    } catch (error) {
      if (!isMountedRef.current) {
        return null;
      }

      Alert.alert('Error', 'Gagal mendapatkan lokasi saat ini.');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!currentLocation) {
      requestLocation();
    }
  }, [currentLocation, requestLocation]);

  useEffect(() => {
    setShowAllInvoices(false);
  }, [resolvedVisitLogId]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVisit();
    }, [loadVisit])
  );

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const openPhotoPreview = (index = 0) => {
    if (photoPreviews.length === 0) {
      return;
    }

    setPhotoPreviewIndex(index);
    setPhotoPreviewVisible(true);
  };

  const closePhotoPreview = () => {
    setPhotoPreviewVisible(false);
  };

  const backToHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }, [navigation]);

  const returnToStoreList = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('StartVisit');
  }, [navigation]);

  const handleTakePhoto = async () => {
    if (!resolvedVisitLogId) {
      Alert.alert('Belum Bisa', 'ID kunjungan belum tersedia.');
      return;
    }

    const location = await requestLocation();
    if (!location?.coords) {
      return;
    }

    const integrity = evaluateVisitLocation(location);
    if (!integrity.isValid) {
      Alert.alert(integrity.title, integrity.message);
      return;
    }

    const locationPayload = integrity.payload;

    navigation.navigate('PhotoUpload', {
      visitLogId: resolvedVisitLogId,
      type: 'other',
      latitude: locationPayload.latitude,
      longitude: locationPayload.longitude,
      takenAt: locationPayload.location_recorded_at || new Date().toISOString(),
      userId: user?.id,
      username: user?.name,
    });
  };

  const handleOpenRoute = async () => {
    try {
      const opened = await openGoogleMapsRoute(store);

      if (!opened) {
        Alert.alert('Rute Belum Tersedia', 'Koordinat toko belum tersedia.');
      }
    } catch (error) {
      Alert.alert('Gagal Membuka Maps', 'Tidak bisa membuka Google Maps dari perangkat ini.');
    }
  };

  const handleCancelVisit = () => {
    if (isCheckedOut || !resolvedVisitLogId) {
      returnToStoreList();
      return;
    }

    Alert.alert(
      'Batalkan Visit?',
      'Visit yang belum selesai akan dihapus supaya bisa mulai toko lain.',
      [
        { text: 'Tetap di Visit', style: 'cancel' },
        {
          text: 'Ya, batalkan',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await visitService.deleteVisit(resolvedVisitLogId);
              returnToStoreList();
            } catch (error) {
              console.log('Cancel visit error:', error.response?.data || error);
              Alert.alert('Gagal', error.response?.data?.message || 'Gagal membatalkan visit.');
            } finally {
              if (isMountedRef.current) {
                setCancelling(false);
              }
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    const location = await requestLocation();
    if (!location?.coords) {
      return;
    }

    if (!resolvedVisitLogId) {
      Alert.alert('Error', 'ID kunjungan tidak ditemukan.');
      return;
    }

    const integrity = evaluateVisitLocation(location);
    if (!integrity.isValid) {
      Alert.alert(integrity.title, integrity.message);
      return;
    }

    setSaving(true);
    try {
      const locationPayload = integrity.payload;
      const response = await visitService.checkOut(
        resolvedVisitLogId,
        form.visitResult,
        form.notes.trim(),
        {
          latitude: locationPayload.latitude,
          longitude: locationPayload.longitude,
          accuracy: locationPayload.accuracy,
          isMockLocation: locationPayload.is_mock_location,
          locationRecordedAt: locationPayload.location_recorded_at,
          formData: {
            activity_type: form.activityType || null,
            customer_response: form.customerResponse.trim() || null,
            notes: form.notes.trim() || null,
            pic_name: form.picName.trim() || null,
            pic_phone: storePicPhone || null,
          },
          submittedAt: new Date().toISOString(),
          userId: user?.id,
          username: user?.name,
        }
      );

      if (!isMountedRef.current) {
        return;
      }

      const payload = response.data || {};
      setVisitLogId(payload.visit_log_id || resolvedVisitLogId);

      Alert.alert('Berhasil', 'Kunjungan berhasil disimpan.', [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      console.log('Save visit error:', error.response?.data || error);
      Alert.alert('Gagal', error.response?.data?.message || 'Gagal menyimpan data kunjungan.');
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>Memuat data kunjungan...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarBack} onPress={backToHome} activeOpacity={0.85}>
          <ArrowLeft size={18} color="#0F766E" />
        </TouchableOpacity>
        <View style={styles.topBarCopy}>
          <Text style={styles.topBarTitle}>Form Visit</Text>
          <Text style={styles.topBarSubtitle}>Kembali ke Home kapan saja bila perlu.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.storeCard}>
          <View style={styles.storeHeader}>
            <View style={styles.storeTextWrap}>
              <Text style={styles.storeLabel}>Visit</Text>
              <Text style={styles.storeName}>{storeName}</Text>
              {!!storeAddress && <Text style={styles.storeAddress}>{storeAddress}</Text>}
              {!!store.branch && <Text style={styles.storeMeta}>{store.branch}</Text>}
            </View>
            <View style={[styles.statusBadge, isCheckedOut ? styles.completedBadge : styles.openBadge]}>
              <CheckCircle2 size={14} color={isCheckedOut ? '#047857' : '#1D4ED8'} />
              <Text style={[styles.statusText, isCheckedOut ? styles.completedText : styles.openText]}>
                {isCheckedOut ? 'Selesai' : 'Aktif'}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <MapPin size={16} color="#64748B" />
            <Text style={styles.metaText}>
              {currentLocation?.coords
                ? `${currentLocation.coords.latitude.toFixed(6)}, ${currentLocation.coords.longitude.toFixed(6)}`
                : 'Mencari lokasi...'}
            </Text>
          </View>

          {hasStoreRoute && (
            <TouchableOpacity style={styles.routeButton} onPress={handleOpenRoute} activeOpacity={0.85}>
              <Navigation size={15} color="#0F766E" />
              <Text style={styles.routeButtonText}>Buka Rute Google Maps</Text>
            </TouchableOpacity>
          )}
        </View>

        {!!sapOutstanding && (
          <View style={styles.sapCard}>
            <View style={styles.sapHeader}>
              <View style={styles.sapHeaderCopy}>
                <Text style={styles.sapLabel}>Piutang SAP</Text>
                <Text style={styles.sapCustomerCode}>{sapCustomerCode}</Text>
                <Text style={styles.sapCustomerName} numberOfLines={2}>
                  {sapCustomerName}
                </Text>
                {sapPaymentTerms ? (
                  <Text style={styles.sapInvoiceMeta}>Termin: {sapPaymentTerms}</Text>
                ) : null}
                {(sapArCount > 0 || sapDpCount > 0) ? (
                  <Text style={styles.sapInvoiceMeta}>
                    AR: {sapArCount} | DP: {sapDpCount}
                  </Text>
                ) : null}
              </View>

              <View
                style={[
                  styles.sapStatusBadge,
                  sapOutstanding.status === 'success'
                    ? styles.sapStatusSuccess
                    : styles.sapStatusWarning,
                ]}
              >
                <Text
                  style={[
                    styles.sapStatusText,
                    sapOutstanding.status === 'success'
                      ? styles.sapStatusTextSuccess
                      : styles.sapStatusTextWarning,
                  ]}
                >
                  {sapOutstanding.status === 'success'
                    ? 'Aktif'
                    : sapOutstanding.status === 'not_found'
                      ? 'Tidak Ditemukan'
                      : 'Belum Tersedia'}
                </Text>
              </View>
            </View>

            {sapOutstanding.status === 'success' ? (
              <>
                <View style={styles.sapBalanceBlock}>
                  <Text style={styles.sapBalanceLabel}>Total Piutang</Text>
                  <Text style={styles.sapBalanceValue}>
                    {formatCurrency(sapOutstanding.total_balance)}
                  </Text>
                </View>

                <View style={styles.sapSummaryRow}>
                  <View style={styles.sapSummaryChip}>
                    <Text style={styles.sapSummaryChipLabel}>Dokumen</Text>
                    <Text style={styles.sapSummaryChipValue}>
                      {sapDocumentCount}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.sapSummaryChip,
                      (sapOutstanding.overdue_invoice_count || 0) > 0
                        ? styles.sapSummaryChipDanger
                        : styles.sapSummaryChipSafe,
                    ]}
                  >
                    <Text style={styles.sapSummaryChipLabel}>Lewat Tempo</Text>
                    <Text
                      style={[
                        styles.sapSummaryChipValue,
                        (sapOutstanding.overdue_invoice_count || 0) > 0
                          ? styles.sapSummaryChipValueDanger
                          : styles.sapSummaryChipValueSafe,
                      ]}
                    >
                      {sapOutstanding.overdue_invoice_count || 0}
                    </Text>
                  </View>
                </View>

                <View style={styles.sapInvoiceSection}>
                  <View style={styles.sapInvoiceHeader}>
                    <Text style={styles.sapInvoiceTitle}>Detail Invoice</Text>
                    <Text style={styles.sapInvoiceSubtitle}>
                      {sapDocumentCount} dokumen
                    </Text>
                  </View>

                  {sapInvoices.length > 0 && !sapInvoicesHaveNominalDetail ? (
                    <Text style={styles.sapInvoiceMeta}>
                      Response API baru tidak mengirim nominal per invoice. Yang ditampilkan hanya nomor, posting date, dan estimasi jatuh tempo.
                    </Text>
                  ) : null}

                  {visibleSapInvoices.length > 0 ? (
                    visibleSapInvoices.map((invoice, index) => {
                      const invoiceAmountAvailable =
                        invoice?.balance_due !== null
                        && invoice?.balance_due !== undefined;
                      const invoiceTotalAvailable =
                        invoice?.doc_total !== null
                        && invoice?.doc_total !== undefined;
                      const invoicePaidAvailable =
                        invoice?.paid_to_date !== null
                        && invoice?.paid_to_date !== undefined;

                      return (
                        <View key={`${invoice.doc_entry || invoice.doc_num || index}`} style={styles.sapInvoiceItem}>
                          <View style={styles.sapInvoiceTopRow}>
                            <Text style={styles.sapInvoiceDoc}>
                              {getInvoiceType(invoice)} #{getInvoiceReference(invoice)}
                            </Text>
                            {invoiceAmountAvailable ? (
                              <Text
                                style={[
                                  styles.sapInvoiceBalance,
                                  Number(invoice.balance_due || 0) > 0
                                    ? styles.sapInvoiceBalanceActive
                                    : styles.sapInvoiceBalancePaid,
                                ]}
                              >
                                {formatCurrency(invoice.balance_due)}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={styles.sapInvoiceMeta}>
                            Posting: {formatDateOnly(invoice.doc_date || invoice.posting_date)}
                          </Text>
                          <Text style={styles.sapInvoiceMeta}>
                            Jatuh tempo: {formatDateOnly(invoice.doc_due_date)}
                          </Text>
                          {invoiceTotalAvailable || invoicePaidAvailable ? (
                            <Text style={styles.sapInvoiceMeta}>
                              Total: {formatCurrency(invoice.doc_total)} | Dibayar: {formatCurrency(invoice.paid_to_date)}
                            </Text>
                          ) : null}
                          {invoice.is_overdue && (
                            <View style={styles.sapOverdueTag}>
                              <AlertTriangle size={12} color="#B45309" />
                              <Text style={styles.sapOverdueText}>Sudah lewat jatuh tempo</Text>
                            </View>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.sapEmptyState}>
                      <Text style={styles.sapEmptyText}>Tidak ada invoice aktif.</Text>
                    </View>
                  )}

                  {sapInvoices.length > INVOICE_PREVIEW_LIMIT && (
                    <TouchableOpacity
                      style={styles.sapToggleButton}
                      onPress={() => setShowAllInvoices((current) => !current)}
                    >
                      <Text style={styles.sapToggleText}>
                        {showAllInvoices
                          ? 'Sembunyikan detail invoice'
                          : `Lihat ${sapInvoices.length - INVOICE_PREVIEW_LIMIT} invoice lainnya`}
                      </Text>
                      {showAllInvoices ? (
                        <ChevronUp size={16} color="#0F766E" />
                      ) : (
                        <ChevronDown size={16} color="#0F766E" />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.sapNotice}>
                <AlertTriangle size={16} color="#B45309" />
                <Text style={styles.sapNoticeText}>
                  {sapOutstanding.message || 'Data piutang SAP belum tersedia.'}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.photoBtn]} onPress={handleTakePhoto}>
            <Camera size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Foto Wajib</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>PIC Toko / Customer</Text>
          <TextInput
            style={styles.input}
            value={form.picName}
            onChangeText={(value) => setField('picName', value)}
            placeholder={storePicName || 'Nama PIC yang ditemui'}
            placeholderTextColor="#94A3B8"
            editable={!isCheckedOut}
          />
          <Text style={styles.fieldHint}>
            Diisi manual karena PIC bisa berbeda di tiap kunjungan.
          </Text>

          <Text style={styles.fieldLabel}>No HP PIC</Text>
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyFieldText}>
              {storePicPhone || 'Belum tersedia dari SAP'}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Aktivitas Kunjungan</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={form.activityType}
              onValueChange={(value) => setField('activityType', value)}
              enabled={!isCheckedOut}
            >
              {ACTIVITY_TYPES.map((item) => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </View>

          <Text style={styles.fieldLabel}>Hasil Visit</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={form.visitResult}
              onValueChange={(value) => setField('visitResult', value)}
              enabled={!isCheckedOut}
            >
              {VISIT_RESULTS.map((item) => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </View>

          <Text style={styles.fieldLabel}>Respon Customer (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.customerResponse}
            onChangeText={(value) => setField('customerResponse', value)}
            placeholder="Respon singkat customer setelah kunjungan"
            placeholderTextColor="#94A3B8"
            multiline
            editable={!isCheckedOut}
          />

          <Text style={styles.fieldLabel}>Catatan</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.notes}
            onChangeText={(value) => setField('notes', value)}
            placeholder="Catatan singkat visit"
            placeholderTextColor="#94A3B8"
            multiline
            editable={!isCheckedOut}
          />
        </View>

        <View style={styles.auditCard}>
          <Text style={styles.auditTitle}>Audit</Text>
          <Text style={styles.auditText}>User: {user?.name || '-'}</Text>
          <Text style={styles.auditText}>Visit ID: {resolvedVisitLogId || '-'}</Text>
        </View>

        {photoCount > 0 && (
          <View style={styles.photoCard}>
            <View style={styles.photoHeader}>
              <Text style={styles.photoTitle}>Foto Terkirim</Text>
              <Text style={styles.photoCount}>{photoCount} foto</Text>
            </View>

            <View style={styles.photoGrid}>
              {photoPreviews.map((photo, index) => (
                <TouchableOpacity
                  key={photo.id}
                  activeOpacity={0.9}
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    openPhotoPreview(index);
                  }}
                >
                  <Image
                    source={{ uri: photo.url }}
                    style={styles.photoThumb}
                  />
                </TouchableOpacity>
              ))}
              {photoCount > photoPreviews.length && (
                <View style={[styles.photoThumb, styles.photoThumbMore]}>
                  <Text style={styles.photoThumbMoreText}>
                    +{photoCount - photoPreviews.length}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.disabledBtn, isCheckedOut && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={saving || isCheckedOut}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Save size={20} color="#fff" />}
          <Text style={styles.saveBtnText}>{isCheckedOut ? 'Visit Sudah Selesai' : 'Simpan Visit'}</Text>
        </TouchableOpacity>

        {!isCheckedOut && (
          <TouchableOpacity
            style={[styles.cancelBtn, (saving || cancelling) && styles.disabledBtn]}
            onPress={handleCancelVisit}
            disabled={saving || cancelling}
          >
            <Text style={styles.cancelBtnText}>
              {cancelling ? 'Membatalkan...' : 'Batalkan & Kembali ke List Toko'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <PhotoPreviewModal
        visible={photoPreviewVisible}
        photos={photoPreviews}
        initialIndex={photoPreviewIndex}
        title="Foto Kunjungan"
        onClose={closePhotoPreview}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  content: {
    padding: 20,
    paddingBottom: Platform.OS === 'android' ? 84 : 60,
  },
  topBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  topBarBack: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: '#E7F1EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCopy: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  topBarSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
  },
  storeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  storeTextWrap: {
    flex: 1,
  },
  storeLabel: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  storeAddress: {
    fontSize: 12,
    color: '#475569',
    marginTop: 3,
  },
  storeMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  sapCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  sapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  sapHeaderCopy: {
    flex: 1,
  },
  sapLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#94A3B8',
  },
  sapCustomerCode: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    color: '#9CCFC7',
  },
  sapCustomerName: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sapStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sapStatusSuccess: {
    backgroundColor: '#DCFCE7',
  },
  sapStatusWarning: {
    backgroundColor: '#FEF3C7',
  },
  sapStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sapStatusTextSuccess: {
    color: '#047857',
  },
  sapStatusTextWarning: {
    color: '#B45309',
  },
  sapBalanceBlock: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sapBalanceLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sapBalanceValue: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  sapSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  sapSummaryChip: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sapSummaryChipDanger: {
    backgroundColor: 'rgba(220, 38, 38, 0.16)',
  },
  sapSummaryChipSafe: {
    backgroundColor: 'rgba(22, 163, 74, 0.16)',
  },
  sapSummaryChipLabel: {
    fontSize: 11,
    color: '#CBD5E1',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sapSummaryChipValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  sapSummaryChipValueDanger: {
    color: '#FCA5A5',
  },
  sapSummaryChipValueSafe: {
    color: '#86EFAC',
  },
  sapInvoiceSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  sapInvoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sapInvoiceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sapInvoiceSubtitle: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '700',
  },
  sapInvoiceItem: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  sapInvoiceTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sapInvoiceDoc: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sapInvoiceBalance: {
    fontSize: 13,
    fontWeight: '900',
  },
  sapInvoiceBalanceActive: {
    color: '#FDE68A',
  },
  sapInvoiceBalancePaid: {
    color: '#86EFAC',
  },
  sapInvoiceMeta: {
    marginTop: 4,
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 16,
  },
  sapOverdueTag: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sapOverdueText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FDE68A',
  },
  sapEmptyState: {
    paddingVertical: 12,
  },
  sapEmptyText: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  sapToggleButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#E0E7FF',
  },
  sapToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F766E',
  },
  sapNotice: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  sapNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#FDE68A',
    lineHeight: 18,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  openBadge: {
    backgroundColor: '#D9F3EE',
  },
  completedBadge: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  openText: {
    color: '#1D4ED8',
  },
  completedText: {
    color: '#047857',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  routeButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E7F1EF',
    borderWidth: 1,
    borderColor: '#BFE3DD',
  },
  routeButtonText: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '900',
  },
  actionRow: {
    marginBottom: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 14,
  },
  photoBtn: {
    backgroundColor: '#0F766E',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 12,
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  readonlyField: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  readonlyFieldText: {
    fontSize: 15,
    color: '#1E293B',
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  auditCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  auditTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C2410C',
    marginBottom: 6,
  },
  auditText: {
    fontSize: 12,
    color: '#9A3412',
    marginTop: 3,
  },
  photoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  photoCount: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumb: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  photoThumbMore: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoThumbMoreText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: '#0F766E',
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelBtn: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  cancelBtnText: {
    color: '#B45309',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.6,
  },
});

export default VisitFormScreen;
