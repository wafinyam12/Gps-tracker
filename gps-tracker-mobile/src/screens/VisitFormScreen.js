import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Picker } from '@react-native-picker/picker';
import { Camera, CheckCircle2, MapPin, Save, Trash2 } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { visitService } from '../api/services/visitService';

const VISIT_RESULTS = [
  { label: 'Ada Order', value: 'order_taken' },
  { label: 'Tidak Ada Order', value: 'no_order' },
  { label: 'Toko Tutup', value: 'closed' },
  { label: 'Tidak Ditemukan', value: 'not_found' },
  { label: 'Dijadwalkan Ulang', value: 'postponed' },
];

const emptyForm = {
  visitResult: 'order_taken',
  contactPerson: '',
  orderValue: '',
  stockNotes: '',
  competitorNotes: '',
  nextAction: '',
  notes: '',
};

const VisitFormScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { schedule, visitLogId: routeVisitLogId, latitude, longitude } = route.params || {};
  const initialVisitLogId = routeVisitLogId || schedule?.visit_log?.id || null;

  const [visitLogId, setVisitLogId] = useState(initialVisitLogId);
  const [visit, setVisit] = useState(schedule?.visit_log ? { ...schedule.visit_log, id: initialVisitLogId } : null);
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    visitResult: schedule?.visit_log?.visit_result || emptyForm.visitResult,
    notes: schedule?.visit_log?.notes || '',
    contactPerson: schedule?.visit_log?.form_data?.contact_person || '',
    orderValue: schedule?.visit_log?.form_data?.order_value !== undefined && schedule?.visit_log?.form_data?.order_value !== null
      ? String(schedule.visit_log.form_data.order_value)
      : '',
    stockNotes: schedule?.visit_log?.form_data?.stock_notes || '',
    competitorNotes: schedule?.visit_log?.form_data?.competitor_notes || '',
    nextAction: schedule?.visit_log?.form_data?.next_action || '',
  }));
  const [currentLocation, setCurrentLocation] = useState(
    latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null
      ? { coords: { latitude, longitude } }
      : null
  );
  const [loading, setLoading] = useState(Boolean(initialVisitLogId));
  const [saving, setSaving] = useState(false);

  const resolvedVisitLogId = visitLogId || routeVisitLogId || schedule?.visit_log?.id || null;
  const isCheckedOut = Boolean(visit?.checkout_at || schedule?.visit_log?.checkout_at);
  const store = visit?.store || schedule?.store || {};
  const submittedAt = useMemo(() => new Date().toISOString(), [saving]);

  const hydrateForm = useCallback((visitData) => {
    const formData = visitData?.form_data || {};

    setForm({
      visitResult: visitData?.visit_result || emptyForm.visitResult,
      notes: visitData?.notes || '',
      contactPerson: formData.contact_person || '',
      orderValue: formData.order_value !== undefined && formData.order_value !== null ? String(formData.order_value) : '',
      stockNotes: formData.stock_notes || '',
      competitorNotes: formData.competitor_notes || '',
      nextAction: formData.next_action || '',
    });
  }, []);

  const loadVisit = useCallback(async () => {
    if (!resolvedVisitLogId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await visitService.getVisit(resolvedVisitLogId);
      const visitData = response.data?.visit;
      setVisit(visitData);
      hydrateForm(visitData);
    } catch (error) {
      console.log('Load visit error:', error.response?.data || error);
      Alert.alert('Error', 'Gagal memuat data kunjungan.');
    } finally {
      setLoading(false);
    }
  }, [hydrateForm, resolvedVisitLogId]);

  const getLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Izin lokasi diperlukan untuk menyimpan kunjungan.');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation(location);
      return location;
    } catch (error) {
      Alert.alert('Error', 'Gagal mendapatkan lokasi saat ini.');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!currentLocation) {
      getLocation();
    }
  }, [currentLocation, getLocation]);

  useFocusEffect(
    useCallback(() => {
      loadVisit();
    }, [loadVisit])
  );

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const buildFormData = () => {
    const numericOrderValue = Number(String(form.orderValue).replace(/[^0-9.]/g, ''));

    return {
      contact_person: form.contactPerson.trim(),
      order_value: Number.isFinite(numericOrderValue) && form.orderValue ? numericOrderValue : null,
      stock_notes: form.stockNotes.trim(),
      competitor_notes: form.competitorNotes.trim(),
      next_action: form.nextAction.trim(),
    };
  };

  const handleTakePhoto = () => {
    if (!resolvedVisitLogId) {
      Alert.alert('Belum Bisa', 'ID kunjungan belum tersedia.');
      return;
    }

    navigation.navigate('PhotoUpload', {
      visitLogId: resolvedVisitLogId,
      type: 'product',
      latitude: currentLocation?.coords?.latitude,
      longitude: currentLocation?.coords?.longitude,
      takenAt: new Date().toISOString(),
      userId: user?.id,
      username: user?.name,
    });
  };

  const handleSubmit = async () => {
    const location = currentLocation || await getLocation();
    if (!location?.coords) {
      Alert.alert('Tunggu', 'Lokasi belum tersedia.');
      return;
    }

    if (!isCheckedOut && !schedule?.id) {
      Alert.alert('Error', 'Data jadwal kunjungan tidak ditemukan.');
      return;
    }

    const payload = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      formData: buildFormData(),
      submittedAt: new Date().toISOString(),
      userId: user?.id,
      username: user?.name,
    };

    setSaving(true);
    try {
      let response;
      if (isCheckedOut) {
        response = await visitService.updateVisit(resolvedVisitLogId, {
          latitude: payload.latitude,
          longitude: payload.longitude,
          notes: form.notes.trim(),
          visit_result: form.visitResult,
          form_data: payload.formData,
          submitted_at: payload.submittedAt,
          submitted_by_user_id: payload.userId,
          submitted_by_username: payload.username,
        });
      } else {
        response = await visitService.checkOut(
          schedule.id,
          form.visitResult,
          form.notes.trim(),
          payload
        );
        setVisitLogId(response.data?.visit_log_id || resolvedVisitLogId);
      }

      Alert.alert(
        'Berhasil',
        isCheckedOut ? 'Data kunjungan berhasil diperbarui.' : 'Kunjungan berhasil disimpan.',
        [{ text: 'OK', onPress: () => navigation.popToTop() }]
      );
    } catch (error) {
      console.log('Save visit error:', error.response?.data || error);
      Alert.alert('Gagal', error.response?.data?.message || 'Gagal menyimpan data kunjungan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDraft = () => {
    if (!resolvedVisitLogId || isCheckedOut) {
      return;
    }

    Alert.alert(
      'Hapus Draft',
      'Data check-in dan foto kunjungan ini akan dihapus.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await visitService.deleteVisit(resolvedVisitLogId);
              Alert.alert('Berhasil', 'Draft kunjungan berhasil dihapus.', [
                { text: 'OK', onPress: () => navigation.popToTop() },
              ]);
            } catch (error) {
              Alert.alert('Gagal', error.response?.data?.message || 'Gagal menghapus draft kunjungan.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Memuat data kunjungan...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.storeCard}>
          <View style={styles.storeHeader}>
            <View style={styles.storeTextWrap}>
              <Text style={styles.storeLabel}>Kunjungan</Text>
              <Text style={styles.storeName}>{store.name || 'Toko'}</Text>
              {!!store.address && <Text style={styles.storeAddress}>{store.address}</Text>}
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
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.photoBtn]} onPress={handleTakePhoto}>
            <Camera size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Foto Langsung</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Hasil Kunjungan</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={form.visitResult}
              onValueChange={(value) => setField('visitResult', value)}
            >
              {VISIT_RESULTS.map((item) => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </View>

          <Text style={styles.fieldLabel}>Nama PIC</Text>
          <TextInput
            style={styles.input}
            value={form.contactPerson}
            onChangeText={(value) => setField('contactPerson', value)}
            placeholder="Nama PIC toko"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.fieldLabel}>Nilai Order</Text>
          <TextInput
            style={styles.input}
            value={form.orderValue}
            onChangeText={(value) => setField('orderValue', value)}
            placeholder="0"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Catatan Stok</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.stockNotes}
            onChangeText={(value) => setField('stockNotes', value)}
            placeholder="Kondisi stok / kebutuhan toko"
            placeholderTextColor="#94A3B8"
            multiline
          />

          <Text style={styles.fieldLabel}>Aktivitas Kompetitor</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.competitorNotes}
            onChangeText={(value) => setField('competitorNotes', value)}
            placeholder="Promo, display, atau catatan kompetitor"
            placeholderTextColor="#94A3B8"
            multiline
          />

          <Text style={styles.fieldLabel}>Tindak Lanjut</Text>
          <TextInput
            style={styles.input}
            value={form.nextAction}
            onChangeText={(value) => setField('nextAction', value)}
            placeholder="Follow-up berikutnya"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.fieldLabel}>Catatan Akhir</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.notes}
            onChangeText={(value) => setField('notes', value)}
            placeholder="Ringkasan kunjungan"
            placeholderTextColor="#94A3B8"
            multiline
          />
        </View>

        <View style={styles.auditCard}>
          <Text style={styles.auditTitle}>Data Pengirim</Text>
          <Text style={styles.auditText}>Timestamp: {new Date(submittedAt).toLocaleString('id-ID')}</Text>
          <Text style={styles.auditText}>User ID: {user?.id || '-'}</Text>
          <Text style={styles.auditText}>Username: {user?.name || '-'}</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Save size={20} color="#fff" />}
          <Text style={styles.saveBtnText}>{isCheckedOut ? 'Simpan Perubahan' : 'Simpan Kunjungan'}</Text>
        </TouchableOpacity>

        {!isCheckedOut && resolvedVisitLogId && (
          <TouchableOpacity
            style={[styles.deleteBtn, saving && styles.disabledBtn]}
            onPress={handleDeleteDraft}
            disabled={saving}
          >
            <Trash2 size={18} color="#B91C1C" />
            <Text style={styles.deleteBtnText}>Hapus Draft</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingBottom: 40,
  },
  storeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  storeName: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
  },
  storeAddress: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  statusBadge: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  completedBadge: {
    backgroundColor: '#D1FAE5',
  },
  openBadge: {
    backgroundColor: '#DBEAFE',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  completedText: {
    color: '#047857',
  },
  openText: {
    color: '#1D4ED8',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  metaText: {
    color: '#64748B',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoBtn: {
    backgroundColor: '#1E40AF',
  },
  galleryBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7,
    marginTop: 12,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 15,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  auditCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  auditTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  auditText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 19,
  },
  saveBtn: {
    minHeight: 56,
    backgroundColor: '#16A34A',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  deleteBtn: {
    minHeight: 50,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteBtnText: {
    color: '#B91C1C',
    fontWeight: '800',
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.65,
  },
});

export default VisitFormScreen;
