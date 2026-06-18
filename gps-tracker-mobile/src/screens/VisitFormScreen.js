import React, { useCallback, useEffect, useState } from 'react';
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
import { Camera, CheckCircle2, MapPin, Save } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { visitService } from '../api/services/visitService';

const VISIT_RESULTS = [
  { label: 'Ada Order', value: 'order_taken' },
  { label: 'Tidak Ada Order', value: 'no_order' },
  { label: 'Toko Tutup', value: 'closed' },
  { label: 'Tidak Ditemukan', value: 'not_found' },
  { label: 'Ditunda', value: 'postponed' },
];

const EMPTY_FORM = {
  visitResult: 'order_taken',
  notes: '',
};

const VisitFormScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { visitLogId: routeVisitLogId } = route.params || {};

  const [visitLogId, setVisitLogId] = useState(routeVisitLogId || null);
  const [visit, setVisit] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(Boolean(routeVisitLogId));
  const [saving, setSaving] = useState(false);

  const resolvedVisitLogId = visitLogId || routeVisitLogId || null;
  const isCheckedOut = Boolean(visit?.checkout_at);
  const store = visit?.store || {};

  const hydrateForm = useCallback((visitData) => {
    setForm({
      visitResult: visitData?.visit_result || EMPTY_FORM.visitResult,
      notes: visitData?.notes || '',
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
      const visitData = response.data?.visit || response.data?.data?.visit || null;
      setVisit(visitData);
      hydrateForm(visitData);
    } catch (error) {
      console.log('Load visit error:', error.response?.data || error);
      Alert.alert('Error', 'Gagal memuat data kunjungan.');
    } finally {
      setLoading(false);
    }
  }, [hydrateForm, resolvedVisitLogId]);

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Izin lokasi diperlukan untuk checkout visit.');
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
      requestLocation();
    }
  }, [currentLocation, requestLocation]);

  useFocusEffect(
    useCallback(() => {
      loadVisit();
    }, [loadVisit])
  );

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleTakePhoto = () => {
    if (!resolvedVisitLogId) {
      Alert.alert('Belum Bisa', 'ID kunjungan belum tersedia.');
      return;
    }

    navigation.navigate('PhotoUpload', {
      visitLogId: resolvedVisitLogId,
      type: 'visit',
      latitude: currentLocation?.coords?.latitude,
      longitude: currentLocation?.coords?.longitude,
      takenAt: new Date().toISOString(),
      userId: user?.id,
      username: user?.name,
    });
  };

  const handleSubmit = async () => {
    const location = currentLocation || await requestLocation();
    if (!location?.coords) {
      return;
    }

    if (!resolvedVisitLogId) {
      Alert.alert('Error', 'ID kunjungan tidak ditemukan.');
      return;
    }

    setSaving(true);
    try {
      const response = await visitService.checkOut(
        resolvedVisitLogId,
        form.visitResult,
        form.notes.trim(),
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          formData: {
            notes: form.notes.trim(),
          },
          submittedAt: new Date().toISOString(),
          userId: user?.id,
          username: user?.name,
        }
      );

      const payload = response.data || {};
      setVisitLogId(payload.visit_log_id || resolvedVisitLogId);

      Alert.alert('Berhasil', 'Kunjungan berhasil disimpan.', [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (error) {
      console.log('Save visit error:', error.response?.data || error);
      Alert.alert('Gagal', error.response?.data?.message || 'Gagal menyimpan data kunjungan.');
    } finally {
      setSaving(false);
    }
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
              <Text style={styles.storeLabel}>Visit</Text>
              <Text style={styles.storeName}>{store.name || 'Toko'}</Text>
              {!!store.address && <Text style={styles.storeAddress}>{store.address}</Text>}
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
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.photoBtn]} onPress={handleTakePhoto}>
            <Camera size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Foto Wajib</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
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

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.disabledBtn, isCheckedOut && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={saving || isCheckedOut}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Save size={20} color="#fff" />}
          <Text style={styles.saveBtnText}>{isCheckedOut ? 'Visit Sudah Selesai' : 'Simpan Visit'}</Text>
        </TouchableOpacity>
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
    paddingBottom: 32,
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
    backgroundColor: '#DBEAFE',
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
    backgroundColor: '#1E40AF',
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
  saveBtn: {
    marginTop: 16,
    backgroundColor: '#1E40AF',
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
  disabledBtn: {
    opacity: 0.6,
  },
});

export default VisitFormScreen;
