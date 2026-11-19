import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AlertTriangle, ArrowRight, Clock, MapPin, Navigation, User } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { reportService } from '../api/services/reportService';
import { canTrackLocation, canVisitStores } from '../utils/roles';
import { canOpenRoute, openMapRoute } from '../utils/maps';
import { getVisitDashboardPresentation } from '../utils/visitDashboardPresentation';
import { logEvent } from '../utils/diagnosticLogger';
import PhotoPreviewModal from '../components/PhotoPreviewModal';
import AppScreen from '../components/ui/AppScreen';
import VisitHeader from '../components/visit/VisitHeader';
import VisitHistoryRow from '../components/visit/VisitHistoryRow';
import VisitStatusBadge from '../components/visit/VisitStatusBadge';
import { visitColors, visitRadii, visitSpacing, visitType } from '../styles/visitTheme';

const HomeScreen = () => {
  const {
    user,
    backgroundTrackingEnabled,
    locationConsentGranted,
    requestBackgroundLocationConsent,
    disableBackgroundLocationTracking,
  } = useAuth();
  const navigation = useNavigation();
  const { isTracking, startTracking, stopTracking } = useLocationTracker();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);
  const [photoPreviewIndex, setPhotoPreviewIndex] = useState(0);
  const [photoPreviewItems, setPhotoPreviewItems] = useState([]);

  const canVisit = canVisitStores(user);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await reportService.targetToday();
      const payload = response.data?.data || response.data || {};
      setSummary(payload);
    } catch (error) {
      logEvent('home.summary_fetch_failed', { status: error.response?.status, error_code: error.code });
      setSummary(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    if (canVisit && locationConsentGranted && backgroundTrackingEnabled) {
      startTracking().then(() => {
        if (cancelled) stopTracking();
      }).catch((error) => logEvent('tracking.home_start_failed', { error_code: error?.code }));
    }
    return () => {
      cancelled = true;
      stopTracking();
    };
  }, [backgroundTrackingEnabled, canVisit, locationConsentGranted, startTracking, stopTracking]));

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchSummary();
  }, [fetchSummary]));

  const visits = Array.isArray(summary?.visits) ? summary.visits : [];
  const openVisit = summary?.open_visit || null;
  const warnings = Array.isArray(summary?.warnings) ? summary.warnings : [];
  const presentation = getVisitDashboardPresentation(summary);
  const isAdminStack = Boolean(navigation.getState()?.routeNames?.includes('AdminDashboard'));
  const firstName = (user?.name || 'Sales').trim().split(/\s+/)[0];
  const branchName = user?.branch?.name || user?.team?.name || 'Cabang belum tersedia';

  const handleOpenVisit = () => {
    if (openVisit?.visit_log_id) {
      navigation.navigate('VisitForm', { visitLogId: openVisit.visit_log_id });
      return;
    }
    navigation.navigate('StartVisit');
  };

  const handleVisitPress = (visit) => {
    if (visit?.id) {
      navigation.navigate('VisitForm', {
        visitLogId: visit.id,
        ...(visit.checkout_at ? { mode: 'detail' } : {}),
      });
    }
  };

  const handleOpenRoute = async (store) => {
    try {
      const opened = await openMapRoute(store);
      if (!opened) {
        Alert.alert('Rute Belum Tersedia', 'Koordinat toko belum tersedia.');
      }
    } catch (error) {
      logEvent('maps.route_open_failed', { error_code: error.code });
      Alert.alert('Gagal Membuka Maps', 'Tidak bisa membuka Google Maps dari perangkat ini.');
    }
  };

  const openPhotoPreview = (items, index = 0) => {
    const normalized = Array.isArray(items) ? items.filter((item) => item?.url) : [];
    if (normalized.length === 0) return;
    setPhotoPreviewItems(normalized);
    setPhotoPreviewIndex(index);
    setPhotoPreviewVisible(true);
  };

  const profileButton = (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Buka profil"
      onPress={() => navigation.navigate('Profile')}
      style={styles.profileButton}
    >
      {user?.photo ? (
        <Image source={{ uri: user.photo }} style={styles.profileImage} />
      ) : (
        <User size={20} color={visitColors.primary} />
      )}
    </TouchableOpacity>
  );

  const header = (
    <>
      <VisitHeader
        title={`Halo, ${firstName}`}
        subtitle={`${branchName} · ${isTracking ? 'GPS aktif' : 'GPS belum aktif'}`}
        onBack={isAdminStack ? () => navigation.popTo('AdminDashboard') : undefined}
        right={profileButton}
      />
      <View style={styles.sections}>
        <TouchableOpacity accessibilityRole="button" onPress={handleOpenVisit} style={styles.primaryAction}>
          <Text style={styles.primaryText}>{presentation.actionLabel}</Text>
          <ArrowRight size={20} color={visitColors.surface} />
        </TouchableOpacity>
        {openVisit ? <Text style={styles.actionHint}>Selesaikan kunjungan aktif sebelum memulai yang baru.</Text> : null}

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Target hari ini</Text>
          <Text style={styles.sectionMeta}>{summary?.period?.date || 'Hari ini'}</Text>
        </View>
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressValue}>{presentation.progressLabel}</Text>
            <Text style={styles.progressPercent}>{presentation.progressStatus}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${presentation.progressFillPercent}%` }]} />
          </View>
          <View style={styles.metrics}>
            <Text style={styles.metric}><Text style={styles.metricNumber}>{presentation.unique}</Text> toko unik</Text>
            <Text style={styles.metric}><Text style={styles.metricNumber}>{presentation.duplicates}</Text> duplikat</Text>
          </View>
        </View>

        {openVisit ? (
          <>
            <Text style={styles.sectionStandalone}>Kunjungan aktif</Text>
            <View style={styles.activeCard}>
              <TouchableOpacity accessibilityRole="button" onPress={handleOpenVisit} style={styles.activeMain}>
                <View style={styles.activeCopy}>
                  <Text style={styles.activeName}>{openVisit.store?.name || 'Toko'}</Text>
                  <Text style={styles.activeMeta}>{openVisit.store?.branch || openVisit.store?.address || 'Detail toko belum tersedia'}</Text>
                </View>
                <VisitStatusBadge label="Lanjut" tone="success" />
              </TouchableOpacity>
              {canOpenRoute(openVisit.store) ? (
                <TouchableOpacity accessibilityRole="button" onPress={() => handleOpenRoute(openVisit.store)} style={styles.activeRoute}>
                  <Navigation size={16} color={visitColors.primary} />
                  <Text style={styles.activeRouteText}>Lihat rute</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}

        <View style={styles.quickLinks}>
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('MySummary')} style={styles.quickLink}>
            <Clock size={18} color={visitColors.primary} />
            <Text style={styles.quickText}>Riwayat</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('MyLocation')} style={styles.quickLink}>
            <MapPin size={18} color={visitColors.primary} />
            <Text style={styles.quickText}>Lokasi saya</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Profile')} style={styles.quickLink}>
            <User size={18} color={visitColors.primary} />
            <Text style={styles.quickText}>Profil</Text>
          </TouchableOpacity>
        </View>

        {canTrackLocation(user) ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={backgroundTrackingEnabled ? disableBackgroundLocationTracking : requestBackgroundLocationConsent}
            style={styles.gpsAction}
          >
            <Text style={styles.gpsActionText}>{backgroundTrackingEnabled ? 'Matikan GPS latar' : 'Aktifkan GPS latar'}</Text>
            <ArrowRight size={16} color={visitColors.primary} />
          </TouchableOpacity>
        ) : null}

        {warnings.length > 0 ? (
          <View style={styles.warningCard}>
            <View style={styles.warningTitleRow}>
              <AlertTriangle size={18} color={visitColors.warning} />
              <Text style={styles.warningTitle}>Perlu perhatian</Text>
            </View>
            {warnings.slice(0, 2).map((warning, index) => (
              <Text key={`${warning.date || index}-${index}`} style={styles.warningText}>
                {warning.message || `Hari ${warning.date} belum mencapai target.`}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Kunjungan terbaru</Text>
          <Text style={styles.sectionMeta}>{visits.length} kunjungan</Text>
        </View>
      </View>
    </>
  );

  if (loading) {
    return (
      <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
        <VisitHeader title="Kunjungan saya" subtitle={branchName} onBack={isAdminStack ? () => navigation.popTo('AdminDashboard') : undefined} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={visitColors.primary} />
          <Text style={styles.loadingText}>Memuat kunjungan...</Text>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      <FlatList
        data={visits}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.historyItem}>
            <VisitHistoryRow visit={item} onOpen={handleVisitPress} onRoute={handleOpenRoute} onPhotoPress={openPhotoPreview} />
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Belum ada kunjungan</Text>
            <Text style={styles.emptyText}>Pilih toko untuk memulai kunjungan pertama hari ini.</Text>
            <TouchableOpacity accessibilityRole="button" onPress={handleOpenVisit} style={styles.emptyAction}>
              <Text style={styles.emptyActionText}>{presentation.actionLabel}</Text>
              <ArrowRight size={16} color={visitColors.primary} />
            </TouchableOpacity>
          </View>
        )}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchSummary();
        }}
      />
      <PhotoPreviewModal
        visible={photoPreviewVisible}
        photos={photoPreviewItems}
        initialIndex={photoPreviewIndex}
        title="Foto Kunjungan"
        onClose={() => setPhotoPreviewVisible(false)}
      />
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas },
  screenContent: { paddingTop: 0, paddingBottom: 0 },
  listContent: { paddingBottom: visitSpacing.sectionLarge },
  profileButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: visitColors.primaryTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  profileImage: { width: 44, height: 44, borderRadius: 22 },
  sections: { paddingHorizontal: visitSpacing.page, paddingTop: visitSpacing.card },
  primaryAction: { minHeight: 50, backgroundColor: visitColors.primary, borderRadius: visitRadii.card, paddingHorizontal: visitSpacing.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryText: { ...visitType.section, color: visitColors.surface },
  actionHint: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.sm },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: visitSpacing.sm, marginTop: visitSpacing.sectionLarge, marginBottom: visitSpacing.sm },
  sectionTitle: { ...visitType.section, color: visitColors.ink },
  sectionStandalone: { ...visitType.section, color: visitColors.ink, marginTop: visitSpacing.sectionLarge, marginBottom: visitSpacing.sm },
  sectionMeta: { ...visitType.caption, color: visitColors.mutedInk },
  progressCard: { backgroundColor: visitColors.surface, borderColor: visitColors.border, borderWidth: 1, borderRadius: visitRadii.card, padding: visitSpacing.card },
  progressTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: visitSpacing.sm },
  progressValue: { ...visitType.page, color: visitColors.ink },
  progressPercent: { ...visitType.caption, color: visitColors.mutedInk },
  progressTrack: { height: 7, backgroundColor: visitColors.primaryTint, borderRadius: 7, overflow: 'hidden', marginTop: visitSpacing.md, marginBottom: visitSpacing.md },
  progressFill: { height: '100%', backgroundColor: visitColors.primary, borderRadius: 7 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: visitSpacing.card },
  metric: { ...visitType.caption, color: visitColors.mutedInk },
  metricNumber: { ...visitType.body, fontWeight: '600', color: visitColors.ink },
  activeCard: { backgroundColor: visitColors.surface, borderColor: visitColors.border, borderWidth: 1, borderRadius: visitRadii.card },
  activeMain: { padding: visitSpacing.card, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm },
  activeCopy: { flex: 1, minWidth: 0 },
  activeName: { ...visitType.section, color: visitColors.ink },
  activeMeta: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  activeRoute: { borderTopWidth: 1, borderTopColor: visitColors.border, minHeight: 44, paddingHorizontal: visitSpacing.card, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.xs },
  activeRouteText: { ...visitType.label, color: visitColors.primary },
  quickLinks: { flexDirection: 'row', gap: visitSpacing.sm, marginTop: visitSpacing.section },
  quickLink: { flex: 1, minWidth: 0, minHeight: 58, backgroundColor: visitColors.surface, borderColor: visitColors.border, borderWidth: 1, borderRadius: visitRadii.control, alignItems: 'center', justifyContent: 'center', gap: visitSpacing.xs, paddingHorizontal: visitSpacing.xs },
  quickText: { ...visitType.caption, color: visitColors.primary, textAlign: 'center' },
  gpsAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: visitSpacing.sm },
  gpsActionText: { ...visitType.label, color: visitColors.primary },
  warningCard: { backgroundColor: visitColors.warningTint, borderRadius: visitRadii.card, padding: visitSpacing.card, marginTop: visitSpacing.section },
  warningTitleRow: { flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm, marginBottom: visitSpacing.xs },
  warningTitle: { ...visitType.label, color: visitColors.warning },
  warningText: { ...visitType.body, color: visitColors.warning, marginTop: visitSpacing.xs },
  historyItem: { paddingHorizontal: visitSpacing.page },
  emptyCard: { backgroundColor: visitColors.surface, borderColor: visitColors.border, borderWidth: 1, borderRadius: visitRadii.card, padding: visitSpacing.card, marginHorizontal: visitSpacing.page },
  emptyTitle: { ...visitType.section, color: visitColors.ink },
  emptyText: { ...visitType.body, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  emptyAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.xs, marginTop: visitSpacing.sm },
  emptyActionText: { ...visitType.label, color: visitColors.primary },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: visitSpacing.md },
  loadingText: { ...visitType.body, color: visitColors.mutedInk },
});

export default HomeScreen;
