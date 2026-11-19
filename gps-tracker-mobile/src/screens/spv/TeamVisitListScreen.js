import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowRight } from 'lucide-react-native';
import { reportService } from '../../api/services/reportService';
import { logEvent } from '../../utils/diagnosticLogger';
import { getVisitDurationPresentation } from '../../utils/visitDurationPresentation';
import AppScreen from '../../components/ui/AppScreen';
import VisitHeader from '../../components/visit/VisitHeader';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';

const TeamVisitListScreen = ({ route, navigation }) => {
  const { userId, date, salesName } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await reportService.targetDetail(userId, { date });
      setData(response.data?.data || response.data || null);
    } catch (loadError) {
      logEvent('visit.team_list_failed', { status: loadError?.response?.status, error_code: loadError?.code });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId, date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const visits = Array.isArray(data?.visits) ? data.visits : [];

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      <VisitHeader title="Kunjungan Sales" subtitle={`${salesName || data?.user?.name || 'Sales'} · ${date || ''}`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={visitColors.primary} /> : error ? (
          <View style={styles.card}>
            <Text style={styles.title}>Kunjungan belum bisa dimuat</Text>
            <Text style={styles.meta}>Periksa koneksi atau hak akses cabang, lalu coba lagi.</Text>
            <TouchableOpacity accessibilityRole="button" onPress={load} style={styles.action}><Text style={styles.actionText}>Coba lagi</Text></TouchableOpacity>
          </View>
        ) : visits.length === 0 ? (
          <View style={styles.card}><Text style={styles.title}>Belum ada kunjungan</Text><Text style={styles.meta}>Pilih tanggal lain dari ringkasan tim.</Text></View>
        ) : visits.map((visit) => {
          const duration = getVisitDurationPresentation({ ...visit, ...(visit.audit || {}) });
          return (
            <TouchableOpacity key={String(visit.id)} accessibilityRole="button" onPress={() => navigation.navigate('VisitAuditDetail', { visitId: visit.id })} style={styles.card}>
              <View style={styles.row}><Text style={styles.title}>{visit.store?.name || 'Customer'}</Text><ArrowRight size={18} color={visitColors.primary} /></View>
              <Text style={styles.meta}>{visit.checkin_at ? new Date(visit.checkin_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} · {duration.durationLabel}</Text>
              <Text style={styles.meta}>Estimasi dalam radius: {duration.insideLabel} · {duration.statusLabel}</Text>
              {visit.audit?.checkout_radius_status === 'outside_radius' ? <Text style={styles.warning}>Checkout di luar radius</Text> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas },
  screenContent: { paddingTop: 0, paddingBottom: 0 },
  content: { paddingHorizontal: visitSpacing.page, paddingTop: visitSpacing.card, paddingBottom: visitSpacing.sectionLarge, gap: visitSpacing.sm },
  card: { backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, padding: visitSpacing.card, gap: visitSpacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm },
  title: { ...visitType.section, color: visitColors.ink, flex: 1 },
  meta: { ...visitType.caption, color: visitColors.mutedInk },
  warning: { ...visitType.label, color: visitColors.warning },
  action: { minHeight: 44, justifyContent: 'center' },
  actionText: { ...visitType.label, color: visitColors.primary },
});

export default TeamVisitListScreen;
