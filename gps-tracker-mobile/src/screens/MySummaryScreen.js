import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AlertTriangle } from 'lucide-react-native';
import { reportService } from '../api/services/reportService';
import PhotoPreviewModal from '../components/PhotoPreviewModal';
import AppScreen from '../components/ui/AppScreen';
import VisitHeader from '../components/visit/VisitHeader';
import VisitHistoryRow from '../components/visit/VisitHistoryRow';
import VisitStatusBadge from '../components/visit/VisitStatusBadge';
import { getVisitDashboardPresentation } from '../utils/visitDashboardPresentation';
import { logEvent } from '../utils/diagnosticLogger';
import { visitColors, visitRadii, visitSpacing, visitType } from '../styles/visitTheme';

const MySummaryScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);
  const [photoPreviewIndex, setPhotoPreviewIndex] = useState(0);
  const [photoPreviewItems, setPhotoPreviewItems] = useState([]);

  const fetchSummary = useCallback(async () => {
    setErrorMessage('');
    try {
      const response = await reportService.targetToday();
      setSummary(response.data?.data || response.data || null);
    } catch (error) {
      logEvent('summary.fetch_failed', { status: error.response?.status, error_code: error.code });
      setSummary(null);
      setErrorMessage('Ringkasan belum dapat dimuat. Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchSummary();
  }, [fetchSummary]));

  const visits = Array.isArray(summary?.visits) ? summary.visits : [];
  const warnings = Array.isArray(summary?.warnings) ? summary.warnings : [];
  const openVisit = summary?.open_visit || null;
  const presentation = getVisitDashboardPresentation(summary);

  const openPhotoPreview = (items, index = 0) => {
    const normalized = Array.isArray(items) ? items.filter((item) => item?.url) : [];
    if (normalized.length === 0) return;
    setPhotoPreviewItems(normalized);
    setPhotoPreviewIndex(index);
    setPhotoPreviewVisible(true);
  };

  const handleVisitPress = (visit) => {
    if (visit?.id) {
      navigation.navigate('VisitForm', {
        visitLogId: visit.id,
        ...(visit.checkout_at ? { mode: 'detail' } : {}),
      });
    }
  };

  const header = (
    <>
      <VisitHeader
        title="Ringkasan kunjungan"
        subtitle={summary?.period?.date || 'Target dan riwayat hari ini'}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.sections}>
        <Text style={styles.sectionTitle}>Target hari ini</Text>
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressValue}>{presentation.progressLabel}</Text>
            <Text style={styles.progressPercent}>{presentation.progressPercent}% selesai</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${presentation.progressPercent}%` }]} />
          </View>
          <View style={styles.metrics}>
            <Text style={styles.metric}><Text style={styles.metricNumber}>{presentation.unique}</Text> toko unik</Text>
            <Text style={styles.metric}><Text style={styles.metricNumber}>{presentation.duplicates}</Text> duplikat</Text>
          </View>
        </View>

        {openVisit ? (
          <>
            <Text style={styles.sectionTitle}>Kunjungan aktif</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigation.navigate('VisitForm', { visitLogId: openVisit.visit_log_id })}
              style={styles.openVisitCard}
            >
              <View style={styles.openVisitCopy}>
                <Text style={styles.openVisitTitle}>{openVisit.store?.name || 'Toko'}</Text>
                <Text style={styles.openVisitMeta}>{openVisit.store?.branch || openVisit.store?.address || 'Detail toko belum tersedia'}</Text>
              </View>
              <VisitStatusBadge label="Lanjut" tone="success" />
            </TouchableOpacity>
          </>
        ) : null}

        {warnings.length > 0 ? (
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <AlertTriangle size={18} color={visitColors.warning} />
              <Text style={styles.warningTitle}>Perlu perhatian</Text>
            </View>
            {warnings.slice(0, 3).map((warning, index) => (
              <Text key={`${warning.date || index}-${index}`} style={styles.warningText}>
                {warning.message || `Hari ${warning.date} belum mencapai target.`}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Kunjungan terbaru</Text>
      </View>
    </>
  );

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      {loading ? (
        <>
          <VisitHeader title="Ringkasan kunjungan" subtitle="Memuat target dan riwayat" onBack={() => navigation.goBack()} />
          <View style={styles.center}>
            <ActivityIndicator size="large" color={visitColors.primary} />
            <Text style={styles.stateText}>Memuat ringkasan...</Text>
          </View>
        </>
      ) : errorMessage ? (
        <>
          <VisitHeader title="Ringkasan kunjungan" onBack={() => navigation.goBack()} />
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Ringkasan belum tersedia</Text>
            <Text style={styles.stateText}>{errorMessage}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => { setLoading(true); fetchSummary(); }} style={styles.retryButton}>
              <Text style={styles.retryText}>Coba lagi</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <View style={styles.historyItem}>
              <VisitHistoryRow visit={item} onOpen={handleVisitPress} onPhotoPress={openPhotoPreview} />
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyCard}>
              <Text style={styles.stateTitle}>Belum ada kunjungan</Text>
              <Text style={styles.stateText}>Kunjungan yang selesai atau masih aktif akan tampil di sini.</Text>
            </View>
          )}
          refreshing={false}
          onRefresh={() => { setLoading(true); fetchSummary(); }}
        />
      )}
      <PhotoPreviewModal
        visible={photoPreviewVisible}
        photos={photoPreviewItems}
        initialIndex={photoPreviewIndex}
        title="Foto kunjungan"
        onClose={() => setPhotoPreviewVisible(false)}
      />
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas },
  screenContent: { paddingTop: 0, paddingBottom: 0 },
  listContent: { paddingBottom: visitSpacing.sectionLarge },
  sections: { paddingHorizontal: visitSpacing.page, paddingTop: visitSpacing.card },
  sectionTitle: { ...visitType.section, color: visitColors.ink, marginTop: visitSpacing.section, marginBottom: visitSpacing.sm },
  progressCard: { backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, padding: visitSpacing.card },
  progressTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: visitSpacing.sm },
  progressValue: { ...visitType.page, color: visitColors.ink },
  progressPercent: { ...visitType.caption, color: visitColors.mutedInk },
  progressTrack: { height: 7, backgroundColor: visitColors.primaryTint, borderRadius: 7, overflow: 'hidden', marginTop: visitSpacing.md, marginBottom: visitSpacing.md },
  progressFill: { height: '100%', backgroundColor: visitColors.primary },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: visitSpacing.card },
  metric: { ...visitType.caption, color: visitColors.mutedInk },
  metricNumber: { ...visitType.body, color: visitColors.ink, fontWeight: '600' },
  openVisitCard: { minHeight: 68, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, padding: visitSpacing.card, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm },
  openVisitCopy: { flex: 1, minWidth: 0 },
  openVisitTitle: { ...visitType.section, color: visitColors.ink },
  openVisitMeta: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  warningCard: { backgroundColor: visitColors.warningTint, borderRadius: visitRadii.card, padding: visitSpacing.card, marginTop: visitSpacing.section },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm },
  warningTitle: { ...visitType.label, color: visitColors.warning },
  warningText: { ...visitType.body, color: visitColors.warning, marginTop: visitSpacing.xs },
  historyItem: { paddingHorizontal: visitSpacing.page },
  emptyCard: { backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, padding: visitSpacing.card, marginHorizontal: visitSpacing.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: visitSpacing.md },
  stateCard: { backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, padding: visitSpacing.card, margin: visitSpacing.page },
  stateTitle: { ...visitType.section, color: visitColors.ink },
  stateText: { ...visitType.body, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  retryButton: { minHeight: 48, backgroundColor: visitColors.primary, borderRadius: visitRadii.control, marginTop: visitSpacing.md, alignItems: 'center', justifyContent: 'center' },
  retryText: { ...visitType.label, color: visitColors.surface },
});

export default MySummaryScreen;
