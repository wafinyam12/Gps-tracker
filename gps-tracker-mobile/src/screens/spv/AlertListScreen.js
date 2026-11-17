import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AlertTriangle, ArrowRight, CheckCircle, RefreshCw } from 'lucide-react-native';
import moment from 'moment';
import { reportService } from '../../api/services/reportService';
import AppScreen from '../../components/ui/AppScreen';
import VisitHeader from '../../components/visit/VisitHeader';
import { getJakartaDateString } from '../../utils/date';
import { logEvent } from '../../utils/diagnosticLogger';
import { getWarningListPresentation } from '../../utils/monitoringDetailPresentation';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';

const AlertListScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [warningDate, setWarningDate] = useState(() => getJakartaDateString(-1));

  useEffect(() => {
    fetchWarnings();
  }, []);

  const fetchWarnings = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const yesterday = getJakartaDateString(-1);
      setWarningDate(yesterday);
      const response = await reportService.targetSummary({ date_from: yesterday, date_to: yesterday });
      const payload = response.data?.data || response.data || {};
      setWarnings(Array.isArray(payload.warnings) ? payload.warnings : []);
    } catch (error) {
      logEvent('alerts.fetch_failed', { status: error.response?.status, error_code: error.code });
      setWarnings([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const presentation = getWarningListPresentation({ loading, error: loadError, warnings, date: warningDate });
  const dateLabel = moment(presentation.date, 'YYYY-MM-DD').format('DD MMMM YYYY');

  const renderItem = ({ item }) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={'Lihat detail ' + (item.name || 'Sales')}
      disabled={!item.user_id}
      onPress={() => navigation.navigate('SalesDetail', { userId: item.user_id })}
      style={styles.warningCard}
    >
      <View style={styles.warningHeading}>
        <View style={styles.warningNameWrap}>
          <AlertTriangle size={18} color={visitColors.warning} />
          <Text style={styles.warningName}>{item.name || 'Sales'}</Text>
        </View>
        {item.user_id ? <ArrowRight size={18} color={visitColors.primary} /> : null}
      </View>
      <Text style={styles.warningDate}>{item.date || presentation.date}</Text>
      <Text style={styles.warningMessage}>{item.message || 'Target kunjungan perlu ditinjau.'}</Text>
      <Text style={styles.warningMetrics}>
        Target {item.target_visits ?? 0} · Unik {item.unique_visits ?? 0} · Duplikat {item.duplicate_visits ?? 0}
      </Text>
      {item.user_id ? <Text style={styles.detailLink}>Lihat detail Sales</Text> : null}
    </TouchableOpacity>
  );

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      <VisitHeader title="Peringatan audit" subtitle={'Data ' + dateLabel} onBack={() => navigation.goBack()} />
      {presentation.state === 'loading' ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="large" color={visitColors.primary} />
          <Text style={styles.stateText}>Memuat peringatan...</Text>
        </View>
      ) : presentation.state === 'error' ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Peringatan belum bisa dimuat</Text>
          <Text style={styles.stateText}>Periksa koneksi lalu coba lagi.</Text>
          <TouchableOpacity accessibilityRole="button" onPress={fetchWarnings} style={styles.retryButton}>
            <RefreshCw size={16} color={visitColors.primary} />
            <Text style={styles.retryText}>Coba lagi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={presentation.warnings}
          keyExtractor={(item, index) => `${item.user_id}-${item.date}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={fetchWarnings}
          refreshing={loading}
          ListHeaderComponent={<Text style={styles.intro}>Tinjau kunjungan yang perlu perhatian dari hari sebelumnya.</Text>}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <CheckCircle size={28} color={visitColors.success} />
              <Text style={styles.stateTitle}>Belum ada peringatan</Text>
              <Text style={styles.stateText}>Tidak ada peringatan audit untuk {dateLabel}.</Text>
            </View>
          }
        />
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas },
  screenContent: { paddingTop: 0, paddingBottom: 0 },
  list: { paddingHorizontal: visitSpacing.page, paddingTop: visitSpacing.card, paddingBottom: visitSpacing.sectionLarge, flexGrow: 1 },
  intro: { ...visitType.body, color: visitColors.mutedInk, marginBottom: visitSpacing.card },
  warningCard: { padding: visitSpacing.card, marginBottom: visitSpacing.sm, borderRadius: visitRadii.card, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border },
  warningHeading: { flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm },
  warningNameWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm },
  warningName: { ...visitType.section, color: visitColors.ink, flex: 1 },
  warningDate: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.sm },
  warningMessage: { ...visitType.body, color: visitColors.ink, marginTop: visitSpacing.sm },
  warningMetrics: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.sm },
  detailLink: { ...visitType.label, color: visitColors.primary, marginTop: visitSpacing.md },
  emptyCard: { padding: visitSpacing.sectionLarge, borderRadius: visitRadii.card, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, alignItems: 'center', gap: visitSpacing.sm },
  stateCard: { margin: visitSpacing.page, padding: visitSpacing.card, borderRadius: visitRadii.card, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, alignItems: 'flex-start', gap: visitSpacing.sm },
  stateTitle: { ...visitType.section, color: visitColors.ink, textAlign: 'center' },
  stateText: { ...visitType.body, color: visitColors.mutedInk, textAlign: 'center' },
  retryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm, paddingHorizontal: visitSpacing.md },
  retryText: { ...visitType.label, color: visitColors.primary },
});

export default AlertListScreen;
