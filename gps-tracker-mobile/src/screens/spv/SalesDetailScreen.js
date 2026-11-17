import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Clock, MapPin, Navigation, RefreshCw } from 'lucide-react-native';
import { locationService } from '../../api/services/locationService';
import OpenStreetMapView from '../../components/maps/OpenStreetMapView';
import AppScreen from '../../components/ui/AppScreen';
import VisitHeader from '../../components/visit/VisitHeader';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';
import { getSalesLocationPresentation, isMissingSalesLocation } from '../../utils/monitoringDetailPresentation';
import { logEvent } from '../../utils/diagnosticLogger';

const SalesDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [userData, setUserData] = useState(null);
  const [history, setHistory] = useState([]);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!userId) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError(false);
    const fetchData = async () => {
      try {
        const [userRes, historyRes] = await Promise.all([
          locationService.getSalesLocation(userId).catch((error) => {
            if (isMissingSalesLocation(error)) return { data: { data: null } };
            throw error;
          }),
          locationService.getLocationHistory(userId),
        ]);
        if (!active) return;
        const userPayload = userRes.data?.data || userRes.data || null;
        const historyPayload = historyRes.data?.data || historyRes.data || {};
        setUserData(userPayload || { name: historyPayload.name || 'Sales' });
        setHistory(Array.isArray(historyPayload.trail) ? historyPayload.trail : []);
      } catch (error) {
        if (!active) return;
        logEvent('sales_detail.fetch_failed', { status: error.response?.status, error_code: error.code });
        setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [userId, retryKey]);

  const presentation = getSalesLocationPresentation(userData, history);
  const branchName = userData?.branch?.name || userData?.team?.name || 'Cabang belum tersedia';
  const marker = presentation.location ? [{
    id: 'last-location',
    ...presentation.location,
    title: 'Posisi terakhir',
    description: presentation.lastSeen,
    color: visitColors.primary,
  }] : [];

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      <VisitHeader title={userData?.name || 'Detail Sales'} subtitle={branchName} onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="large" color={visitColors.primary} />
          <Text style={styles.stateText}>Memuat posisi Sales...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Detail Sales belum bisa dimuat</Text>
          <Text style={styles.stateText}>{userId ? 'Periksa koneksi lalu coba lagi.' : 'ID Sales tidak tersedia. Kembali ke daftar Sales.'}</Text>
          {userId ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => setRetryKey((value) => value + 1)} style={styles.retryButton}>
              <RefreshCw size={16} color={visitColors.primary} />
              <Text style={styles.retryText}>Coba lagi</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusPill, presentation.status === 'Online' ? styles.onlinePill : styles.offlinePill]}>
                <Text style={[styles.statusPillText, presentation.status === 'Online' ? styles.onlineText : styles.offlineText]}>{presentation.status}</Text>
              </View>
              <Text style={styles.statusLabel}>Status Sales</Text>
            </View>
            <Text style={styles.lastSeenLabel}>Terakhir terlihat</Text>
            <Text style={styles.lastSeenValue}>{presentation.lastSeen}</Text>
          </View>

          <Text style={styles.sectionTitle}>Posisi dan perjalanan</Text>
          {presentation.location ? (
            <View style={styles.mapFrame}>
              <OpenStreetMapView
                style={styles.map}
                center={presentation.location}
                markers={marker}
                polyline={presentation.trail}
                zoom={13}
              />
            </View>
          ) : (
            <View style={styles.missingMap}>
              <MapPin size={26} color={visitColors.mutedInk} />
              <Text style={styles.stateTitle}>Belum ada data GPS</Text>
              <Text style={styles.stateText}>Peta akan tersedia setelah perangkat Sales mengirim posisi.</Text>
            </View>
          )}

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Jarak dari jejak GPS</Text>
              <Text style={styles.metricValue}>{presentation.distance}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Titik perjalanan</Text>
              <Text style={styles.metricValue}>{presentation.trail.length}</Text>
            </View>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <MapPin size={18} color={visitColors.primary} />
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Lokasi terakhir</Text>
                <Text style={styles.detailValue}>{presentation.coordinates}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Clock size={18} color={visitColors.primary} />
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Pembaruan GPS</Text>
                <Text style={styles.detailValue}>{presentation.recordedAt}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Navigation size={18} color={visitColors.primary} />
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Kecepatan dan baterai</Text>
                <Text style={styles.detailValue}>{presentation.speedBattery}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.note}>Peta menampilkan jejak GPS yang tersedia untuk Sales ini. Riwayat lengkap dapat dilihat di dashboard web.</Text>
        </ScrollView>
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas },
  screenContent: { paddingTop: 0, paddingBottom: 0 },
  content: { paddingHorizontal: visitSpacing.page, paddingTop: visitSpacing.card, paddingBottom: visitSpacing.sectionLarge },
  statusCard: { padding: visitSpacing.card, backgroundColor: visitColors.surface, borderColor: visitColors.border, borderWidth: 1, borderRadius: visitRadii.card },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: visitSpacing.sm },
  statusPill: { borderRadius: visitRadii.pill, paddingHorizontal: visitSpacing.md, paddingVertical: visitSpacing.xs },
  onlinePill: { backgroundColor: visitColors.successTint },
  offlinePill: { backgroundColor: visitColors.warningTint },
  statusPillText: { ...visitType.label },
  onlineText: { color: visitColors.success },
  offlineText: { color: visitColors.warning },
  statusLabel: { ...visitType.caption, color: visitColors.mutedInk },
  lastSeenLabel: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.card },
  lastSeenValue: { ...visitType.section, color: visitColors.ink, marginTop: visitSpacing.xs },
  sectionTitle: { ...visitType.section, color: visitColors.ink, marginTop: visitSpacing.sectionLarge, marginBottom: visitSpacing.sm },
  mapFrame: { height: 240, borderRadius: visitRadii.card, overflow: 'hidden', borderWidth: 1, borderColor: visitColors.border },
  map: { ...StyleSheet.absoluteFillObject },
  missingMap: { minHeight: 180, padding: visitSpacing.card, alignItems: 'center', justifyContent: 'center', gap: visitSpacing.sm, borderRadius: visitRadii.card, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border },
  metricsRow: { flexDirection: 'row', gap: visitSpacing.sm, marginTop: visitSpacing.sm },
  metricCard: { flex: 1, minWidth: 0, padding: visitSpacing.card, borderRadius: visitRadii.card, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border },
  metricLabel: { ...visitType.caption, color: visitColors.mutedInk },
  metricValue: { ...visitType.section, color: visitColors.ink, marginTop: visitSpacing.xs },
  detailCard: { marginTop: visitSpacing.section, padding: visitSpacing.card, gap: visitSpacing.card, borderRadius: visitRadii.card, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: visitSpacing.md },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: { ...visitType.caption, color: visitColors.mutedInk },
  detailValue: { ...visitType.body, color: visitColors.ink, marginTop: visitSpacing.xs },
  note: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.section },
  stateCard: { margin: visitSpacing.page, padding: visitSpacing.card, borderRadius: visitRadii.card, backgroundColor: visitColors.surface, borderColor: visitColors.border, borderWidth: 1, gap: visitSpacing.sm, alignItems: 'flex-start' },
  stateTitle: { ...visitType.section, color: visitColors.ink, textAlign: 'center' },
  stateText: { ...visitType.body, color: visitColors.mutedInk, textAlign: 'center' },
  retryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm, paddingHorizontal: visitSpacing.md },
  retryText: { ...visitType.label, color: visitColors.primary },
});

export default SalesDetailScreen;
