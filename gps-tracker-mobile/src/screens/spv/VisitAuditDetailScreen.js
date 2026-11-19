import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { visitService } from '../../api/services/visitService';
import { logEvent } from '../../utils/diagnosticLogger';
import { buildCheckoutMapUrl, getVisitDurationPresentation } from '../../utils/visitDurationPresentation';
import AppScreen from '../../components/ui/AppScreen';
import VisitHeader from '../../components/visit/VisitHeader';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';

const VisitAuditDetailScreen = ({ route, navigation }) => {
  const { visitId } = route.params || {};
  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await visitService.getVisit(visitId);
      setVisit(response.data?.visit || response.data?.data?.visit || null);
    } catch (loadError) {
      logEvent('visit.audit_detail_failed', { status: loadError?.response?.status, error_code: loadError?.code });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const duration = getVisitDurationPresentation(visit);
  const mapUrl = buildCheckoutMapUrl({ latitude: visit?.checkout_latitude, longitude: visit?.checkout_longitude });

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      <VisitHeader title="Audit kunjungan" subtitle={visit?.store?.name || 'Detail Sales'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={visitColors.primary} /> : error || !visit ? (
          <View style={styles.card}>
            <Text style={styles.title}>{error ? 'Detail tidak tersedia' : 'Kunjungan tidak ditemukan'}</Text>
            <Text style={styles.meta}>Pastikan koneksi dan akses tim sesuai.</Text>
            <TouchableOpacity accessibilityRole="button" onPress={load} style={styles.action}><Text style={styles.link}>Coba lagi</Text></TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.title}>{visit.store?.name || 'Customer'}</Text>
              <Text style={styles.meta}>{visit.user?.name || 'Sales'} · {visit.visit_date || '-'}</Text>
              <Text style={styles.row}>Durasi sesi: {duration.durationLabel}</Text>
              <Text style={styles.row}>Status: {duration.statusLabel}</Text>
              <Text style={styles.row}>Estimasi dalam radius: {duration.insideLabel}</Text>
              <Text style={styles.row}>Estimasi di luar radius: {duration.outsideLabel}</Text>
              <Text style={styles.row}>Tidak terukur: {duration.unmeasuredLabel}</Text>
              <Text style={styles.meta}>Waktu di radius adalah perkiraan dari sampel GPS.</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.title}>Titik checkout</Text>
              <Text style={[styles.row, visit.checkout_radius_status === 'outside_radius' && styles.warning]}>{duration.checkoutLabel}</Text>
              {visit.checkout_accuracy !== null && visit.checkout_accuracy !== undefined ? <Text style={styles.meta}>Akurasi GPS: ±{Math.round(Number(visit.checkout_accuracy))} m</Text> : null}
              {mapUrl ? (
                <TouchableOpacity accessibilityRole="link" accessibilityLabel="Lihat titik checkout di peta" onPress={() => Linking.openURL(mapUrl)} style={styles.action}>
                  <Text style={styles.link}>Lihat titik checkout di peta</Text>
                </TouchableOpacity>
              ) : <Text style={styles.meta}>Koordinat checkout belum tersedia.</Text>}
            </View>
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas }, screenContent: { paddingTop: 0, paddingBottom: 0 },
  content: { paddingHorizontal: visitSpacing.page, paddingTop: visitSpacing.card, paddingBottom: visitSpacing.sectionLarge, gap: visitSpacing.sm },
  card: { backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, padding: visitSpacing.card, gap: visitSpacing.sm },
  title: { ...visitType.section, color: visitColors.ink }, meta: { ...visitType.caption, color: visitColors.mutedInk },
  row: { ...visitType.body, color: visitColors.ink }, warning: { color: visitColors.warning },
  action: { minHeight: 44, justifyContent: 'center' }, link: { ...visitType.label, color: visitColors.primary },
});

export default VisitAuditDetailScreen;
