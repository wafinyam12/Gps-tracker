import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays, Check, RefreshCw, UsersRound } from 'lucide-react-native';
import moment from 'moment';
import { reportService } from '../../api/services/reportService';
import { useAuth } from '../../context/AuthContext';
import { getRoleName } from '../../utils/roles';
import { buildTargetRangePayload, formatLocalDate, validateTargetRangeDraft } from '../../utils/targetRangePresentation';
import { logEvent } from '../../utils/diagnosticLogger';
import AppScreen from '../../components/ui/AppScreen';
import VisitHeader from '../../components/visit/VisitHeader';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';

const localDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const dateLabel = (value) => moment(value, 'YYYY-MM-DD').format('DD MMM YYYY');

const TargetRangeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const isSpv = getRoleName(user) === 'spv';
  const branchName = user?.branch?.name || user?.team?.name || 'Cabang saya';
  const initialDate = route.params?.initialDate || formatLocalDate(new Date());
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selection, setSelection] = useState('all');
  const [userIds, setUserIds] = useState([]);
  const [dateFrom, setDateFrom] = useState(initialDate);
  const [dateTo, setDateTo] = useState(initialDate);
  const [targetVisits, setTargetVisits] = useState('5');
  const [picker, setPicker] = useState(null);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isSpv) loadSales();
  }, [isSpv]);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => subscription.remove();
  }, []);

  const loadSales = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await reportService.eligibleTargetSales();
      const rows = response.data?.data?.sales;
      setSales(Array.isArray(rows) ? rows : []);
    } catch (error) {
      logEvent('target_range.sales_fetch_failed', { status: error.response?.status, error_code: error.code });
      setLoadError(error.response?.data?.message || 'Daftar Sales belum bisa dimuat. Periksa koneksi dan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (_event, nextDate) => {
    const field = picker;
    setPicker(null);
    if (!nextDate || !field) return;
    const value = formatLocalDate(nextDate);
    if (field === 'from') {
      setDateFrom(value);
      if (value > dateTo) setDateTo(value);
    } else {
      setDateTo(value);
    }
    setErrors((current) => ({ ...current, dateFrom: undefined, dateTo: undefined }));
    setSaveError('');
  };

  const toggleSales = (id) => {
    setUserIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setErrors((current) => ({ ...current, userIds: undefined }));
    setSaveError('');
  };

  const submit = async (draft) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await reportService.setTargetRange(buildTargetRangePayload(draft));
      logEvent('target_range.save_succeeded', { selection: draft.selection });
      navigation.goBack();
      Alert.alert('Target tersimpan', 'Ringkasan kunjungan akan memuat target terbaru.');
    } catch (error) {
      logEvent('target_range.save_failed', { status: error.response?.status, error_code: error.code });
      const apiErrors = error.response?.data?.errors || {};
      setErrors((current) => ({
        ...current,
        userIds: apiErrors.user_ids?.[0],
        dateFrom: apiErrors.date_from?.[0],
        dateTo: apiErrors.date_to?.[0],
        targetVisits: apiErrors.target_visits?.[0],
      }));
      setSaveError(error.response?.data?.message || 'Target belum tersimpan. Periksa koneksi lalu coba lagi.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const review = () => {
    const draft = { selection, userIds, dateFrom, dateTo, targetVisits };
    const result = validateTargetRangeDraft(draft, sales);
    setErrors(result.errors);
    setSaveError('');
    if (Object.keys(result.errors).length > 0) return;

    Alert.alert(
      'Simpan target harian?',
      `${result.salesCount} Sales × ${result.daysCount} hari (${dateLabel(dateFrom)} – ${dateLabel(dateTo)}).\nTarget: ${targetVisits} kunjungan per Sales per hari.\nTarget yang sudah ada pada tanggal ini akan diganti.`,
      [
        { text: 'Periksa lagi', style: 'cancel' },
        { text: 'Simpan target', onPress: () => submit(draft) },
      ],
    );
  };

  const maxDate = localDate(dateFrom);
  maxDate.setDate(maxDate.getDate() + 30);

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      <VisitHeader title="Atur target harian" subtitle={branchName} onBack={() => navigation.goBack()} />
      {!isSpv ? (
        <View style={styles.stateCard}><Text style={styles.stateTitle}>Akses tidak tersedia</Text><Text style={styles.hint}>Pengaturan ini hanya untuk Area Manager.</Text></View>
      ) : loading ? (
        <View style={styles.stateCard}><ActivityIndicator color={visitColors.primary} /><Text style={styles.hint}>Memuat Sales cabang...</Text></View>
      ) : loadError ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Daftar Sales belum tersedia</Text>
          <Text style={styles.hint}>{loadError}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={loadSales} style={styles.retry}><RefreshCw size={16} color={visitColors.primary} /><Text style={styles.retryText}>Coba lagi</Text></TouchableOpacity>
        </View>
      ) : sales.length === 0 ? (
        <View style={styles.stateCard}><Text style={styles.stateTitle}>Belum ada Sales aktif</Text><Text style={styles.hint}>Tambahkan Sales aktif pada cabang ini sebelum mengatur target.</Text></View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <View style={styles.introCard}>
              <UsersRound size={20} color={visitColors.primary} />
              <View style={styles.introCopy}>
                <Text style={styles.introTitle}>{branchName}</Text>
                <Text style={styles.hint}>Target hanya berlaku untuk Sales aktif di cabang Anda.</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Pilih Sales</Text>
            <View style={styles.card}>
              <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: selection === 'all' }} onPress={() => { setSelection('all'); setErrors({}); }} style={styles.choiceRow}>
                <View style={[styles.radio, selection === 'all' && styles.radioSelected]}>{selection === 'all' ? <Check size={13} color={visitColors.surface} /> : null}</View>
                <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>Semua Sales aktif</Text><Text style={styles.hint}>{sales.length} Sales dalam cabang ini</Text></View>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: selection === 'selected' }} onPress={() => { setSelection('selected'); setErrors({}); }} style={styles.choiceRow}>
                <View style={[styles.radio, selection === 'selected' && styles.radioSelected]}>{selection === 'selected' ? <Check size={13} color={visitColors.surface} /> : null}</View>
                <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>Pilih Sales</Text><Text style={styles.hint}>Atur untuk beberapa orang tertentu</Text></View>
              </TouchableOpacity>
              {selection === 'selected' ? (
                <View style={styles.salesList}>
                  {sales.map((person) => {
                    const selected = userIds.includes(Number(person.id));
                    return (
                      <TouchableOpacity key={String(person.id)} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={'Pilih ' + person.name} onPress={() => toggleSales(Number(person.id))} style={styles.salesRow}>
                        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Check size={15} color={visitColors.surface} /> : null}</View>
                        <Text style={styles.salesName}>{person.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
              {errors.userIds ? <Text style={styles.errorText}>{errors.userIds}</Text> : null}
            </View>

            <Text style={styles.sectionTitle}>Tanggal berlaku</Text>
            <View style={styles.card}>
              <Text style={styles.label}>Tanggal mulai</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Pilih tanggal mulai" onPress={() => setPicker('from')} style={styles.dateButton}><CalendarDays size={18} color={visitColors.primary} /><Text style={styles.dateText}>{dateLabel(dateFrom)}</Text></TouchableOpacity>
              {errors.dateFrom ? <Text style={styles.errorText}>{errors.dateFrom}</Text> : null}
              <Text style={[styles.label, styles.secondLabel]}>Tanggal selesai</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Pilih tanggal selesai" onPress={() => setPicker('to')} style={styles.dateButton}><CalendarDays size={18} color={visitColors.primary} /><Text style={styles.dateText}>{dateLabel(dateTo)}</Text></TouchableOpacity>
              {errors.dateTo ? <Text style={styles.errorText}>{errors.dateTo}</Text> : null}
              <Text style={styles.hint}>Tanggal sama berlaku satu hari. Maksimal 31 hari sekaligus.</Text>
            </View>

            <Text style={styles.sectionTitle}>Target per hari</Text>
            <View style={styles.card}>
              <Text style={styles.label}>Jumlah kunjungan per Sales</Text>
              <TextInput
                accessibilityLabel="Jumlah target kunjungan per hari"
                value={targetVisits}
                onChangeText={(value) => { setTargetVisits(value.replace(/[^0-9]/g, '')); setErrors((current) => ({ ...current, targetVisits: undefined })); setSaveError(''); }}
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 180)}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="Contoh: 5"
                style={styles.input}
              />
              {errors.targetVisits ? <Text style={styles.errorText}>{errors.targetVisits}</Text> : null}
              <Text style={styles.hint}>Tanggal yang belum pernah diatur tetap memakai target pilot 5 kunjungan.</Text>
            </View>

            {saveError ? <View style={styles.errorCard}><Text style={styles.errorText}>{saveError}</Text></View> : null}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tinjau dan simpan target" disabled={saving} onPress={review} style={[styles.saveButton, saving && styles.disabledButton]} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={visitColors.surface} /> : <Text style={styles.saveText}>Tinjau dan simpan target</Text>}
            </TouchableOpacity>
          </ScrollView>
          {picker ? <DateTimePicker value={localDate(picker === 'from' ? dateFrom : dateTo)} mode="date" display="default" minimumDate={picker === 'to' ? localDate(dateFrom) : undefined} maximumDate={picker === 'to' ? maxDate : undefined} onChange={changeDate} /> : null}
        </KeyboardAvoidingView>
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas },
  screenContent: { paddingTop: 0, paddingBottom: 0 },
  flex: { flex: 1 },
  content: { paddingHorizontal: visitSpacing.page, paddingTop: visitSpacing.section, paddingBottom: visitSpacing.sectionLarge, flexGrow: 1 },
  introCard: { flexDirection: 'row', gap: visitSpacing.md, padding: visitSpacing.card, backgroundColor: visitColors.primaryTint, borderRadius: visitRadii.card },
  introCopy: { flex: 1, minWidth: 0 },
  introTitle: { ...visitType.section, color: visitColors.ink },
  sectionTitle: { ...visitType.section, color: visitColors.ink, marginTop: visitSpacing.sectionLarge, marginBottom: visitSpacing.sm },
  card: { padding: visitSpacing.card, backgroundColor: visitColors.surface, borderRadius: visitRadii.card, borderColor: visitColors.border, borderWidth: 1 },
  choiceRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.md },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: visitColors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: visitColors.primary, borderColor: visitColors.primary },
  choiceCopy: { flex: 1, minWidth: 0 },
  choiceTitle: { ...visitType.body, fontWeight: '600', color: visitColors.ink },
  hint: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  divider: { height: 1, backgroundColor: visitColors.border, marginVertical: visitSpacing.xs },
  salesList: { marginTop: visitSpacing.md, borderTopWidth: 1, borderColor: visitColors.border },
  salesRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.md, borderBottomWidth: 1, borderColor: visitColors.border },
  checkbox: { width: 22, height: 22, borderWidth: 1.5, borderColor: visitColors.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: visitColors.primary, borderColor: visitColors.primary },
  salesName: { ...visitType.body, color: visitColors.ink, flex: 1 },
  label: { ...visitType.label, color: visitColors.ink, marginBottom: visitSpacing.sm },
  secondLabel: { marginTop: visitSpacing.card },
  dateButton: { minHeight: 48, paddingHorizontal: visitSpacing.md, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm, borderRadius: visitRadii.control, borderWidth: 1, borderColor: visitColors.border },
  dateText: { ...visitType.body, color: visitColors.ink },
  input: { minHeight: 48, paddingHorizontal: visitSpacing.md, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.control, ...visitType.body, color: visitColors.ink },
  errorText: { ...visitType.caption, color: visitColors.danger, marginTop: visitSpacing.sm },
  errorCard: { padding: visitSpacing.card, backgroundColor: visitColors.dangerTint, borderRadius: visitRadii.control, marginTop: visitSpacing.section },
  saveButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: visitSpacing.sectionLarge, borderRadius: visitRadii.control, backgroundColor: visitColors.primary },
  disabledButton: { opacity: 0.65 },
  saveText: { ...visitType.label, fontSize: 15, color: visitColors.surface },
  stateCard: { margin: visitSpacing.page, padding: visitSpacing.card, gap: visitSpacing.sm, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card },
  stateTitle: { ...visitType.section, color: visitColors.ink },
  retry: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm },
  retryText: { ...visitType.label, color: visitColors.primary },
});

export default TargetRangeScreen;
