import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft, RefreshCw } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { locationService } from '../../api/services/locationService';
import OpenStreetMapView from '../../components/maps/OpenStreetMapView';
import { logEvent } from '../../utils/diagnosticLogger';
import { findSelectedMonitoringBranch, getMonitoringMapDataState, getMonitoringMapOverlayOffsets, getMonitoringMapScope, getSalesOnlineLabel } from '../../utils/monitoringMapPresentation';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';

const LIVE_REFRESH_MS = 60_000;
const VIEWPORT_DEBOUNCE_MS = 450;
const DEFAULT_REGION = {
  latitude: -6.2,
  longitude: 106.816666,
};

const normalizeBranch = (branch) => ({
  id: branch.id,
  name: branch.name,
  code: branch.code,
  area: branch.area,
  latitude: Number(branch.latitude ?? branch.location?.latitude),
  longitude: Number(branch.longitude ?? branch.location?.longitude),
  onlineSalesCount: Number(branch.online_sales_count || 0),
  is_active: Boolean(branch.is_active),
});

const normalizeViewport = (viewport) => {
  const south = Number(viewport?.south);
  const north = Number(viewport?.north);
  const west = Number(viewport?.west);
  const east = Number(viewport?.east);
  const zoom = Math.round(Number(viewport?.zoom));

  if (![south, north, west, east, zoom].every(Number.isFinite) || south >= north || west >= east) {
    return null;
  }

  return { south, north, west, east, zoom };
};

const validBranchLocations = (branches) => branches
  .filter((branch) => Number.isFinite(branch.latitude) && Number.isFinite(branch.longitude));

const LiveMapScreen = () => {
  const [locations, setLocations] = useState([]);
  const [branchLocations, setBranchLocations] = useState([]);
  const [customerLayer, setCustomerLayer] = useState({ mode: 'clusters', items: [], meta: null });
  const [scopeTeamId, setScopeTeamId] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [canAccessAllBranches, setCanAccessAllBranches] = useState(false);
  const [showCustomers, setShowCustomers] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [customerError, setCustomerError] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [mapZoom, setMapZoom] = useState(12);
  const [viewportKey, setViewportKey] = useState(0);
  const hasCenteredRef = useRef(false);
  const liveRequestSequenceRef = useRef(0);
  const customerRequestSequenceRef = useRef(0);
  const viewportTimerRef = useRef(null);
  const viewportRef = useRef(null);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const overlayOffsets = getMonitoringMapOverlayOffsets(insets);

  const activeTeamId = selectedTeamId || scopeTeamId;
  const isGlobalView = canAccessAllBranches && !selectedTeamId;

  const focusMap = useCallback((latitude, longitude, zoom = 15) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    setRegion({ latitude, longitude });
    setMapZoom(zoom);
    setViewportKey((current) => current + 1);
  }, []);

  const fetchCustomerLayer = useCallback(async (viewport, teamId) => {
    if (!showCustomers || !teamId || !viewport) {
      return;
    }

    const requestSequence = customerRequestSequenceRef.current + 1;
    customerRequestSequenceRef.current = requestSequence;
    setCustomerLoading(true);
    setCustomerError(false);

    try {
      const response = await locationService.getCustomerMarkers({
        team_id: teamId,
        south: viewport.south,
        north: viewport.north,
        west: viewport.west,
        east: viewport.east,
        zoom: viewport.zoom,
        limit: 100,
      });
      if (requestSequence !== customerRequestSequenceRef.current) {
        return;
      }

      const payload = response.data?.data || {};
      setCustomerLayer({
        mode: payload.mode || 'clusters',
        items: Array.isArray(payload.items) ? payload.items : [],
        meta: payload.meta || null,
      });
    } catch (error) {
      if (requestSequence === customerRequestSequenceRef.current) {
        logEvent('monitoring.customer_markers_fetch_failed', { status: error.response?.status, error_code: error.code });
        setCustomerLayer({ mode: 'clusters', items: [], meta: null });
        setCustomerError(true);
      }
    } finally {
      if (requestSequence === customerRequestSequenceRef.current) {
        setCustomerLoading(false);
      }
    }
  }, [showCustomers]);

  const scheduleCustomerLayer = useCallback((viewport, teamId = activeTeamId) => {
    if (viewportTimerRef.current) {
      clearTimeout(viewportTimerRef.current);
    }

    if (!showCustomers || !teamId || !viewport) {
      return;
    }

    viewportTimerRef.current = setTimeout(() => {
      fetchCustomerLayer(viewport, teamId);
    }, VIEWPORT_DEBOUNCE_MS);
  }, [activeTeamId, fetchCustomerLayer, showCustomers]);

  const fetchLocations = useCallback(async () => {
    const requestSequence = liveRequestSequenceRef.current + 1;
    liveRequestSequenceRef.current = requestSequence;
    setLoadError(false);
    try {
      const response = await locationService.getLiveLocations(
        selectedTeamId ? { team_id: selectedTeamId, limit: 50 } : { limit: 50 }
      );
      if (requestSequence !== liveRequestSequenceRef.current) {
        return;
      }

      const payload = response.data?.data || {};
      const users = Array.isArray(payload.users) ? payload.users : [];
      const branches = validBranchLocations(
        (Array.isArray(payload.branches) ? payload.branches : []).map(normalizeBranch)
      );
      const nextScopeTeamId = payload.scope?.can_access_all_branches
        ? null
        : (payload.scope?.team_id ? Number(payload.scope.team_id) : null);

      setLocations(users);
      setBranchLocations(branches);
      setScopeTeamId(nextScopeTeamId);
      setCanAccessAllBranches(Boolean(payload.scope?.can_access_all_branches));
      setLastUpdatedAt(new Date());

      if (!hasCenteredRef.current) {
        const selectedBranch = findSelectedMonitoringBranch(branches, selectedTeamId || nextScopeTeamId);
        const firstUser = users.find((user) => user.location);
        const anchor = selectedBranch || firstUser?.location || branches[0];

        if (anchor) {
          focusMap(anchor.latitude, anchor.longitude, selectedBranch || nextScopeTeamId ? 12 : 6);
          hasCenteredRef.current = true;
        }
      }
    } catch (error) {
      if (requestSequence === liveRequestSequenceRef.current) {
        logEvent('monitoring.live_locations_fetch_failed', { status: error.response?.status, error_code: error.code });
        setLoadError(true);
      }
    } finally {
      if (requestSequence === liveRequestSequenceRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [focusMap, selectedTeamId]);

  useFocusEffect(
    useCallback(() => {
      fetchLocations();
      const interval = setInterval(() => {
        if (AppState.currentState === 'active') {
          fetchLocations();
        }
      }, LIVE_REFRESH_MS);
      const appStateSubscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          fetchLocations();
        }
      });

      return () => {
        clearInterval(interval);
        appStateSubscription.remove();
      };
    }, [fetchLocations])
  );

  useEffect(() => {
    hasCenteredRef.current = false;
  }, [selectedTeamId]);

  useEffect(() => {
    if (!showCustomers) {
      customerRequestSequenceRef.current += 1;
      setCustomerLayer({ mode: 'clusters', items: [], meta: null });
      setCustomerLoading(false);
      setCustomerError(false);
      return;
    }

    if (activeTeamId && viewportRef.current) {
      scheduleCustomerLayer(viewportRef.current, activeTeamId);
    }
  }, [activeTeamId, scheduleCustomerLayer, showCustomers]);

  useEffect(() => () => {
    if (viewportTimerRef.current) {
      clearTimeout(viewportTimerRef.current);
    }
  }, []);

  const onManualRefresh = () => {
    setRefreshing(true);
    fetchLocations();
    if (activeTeamId && viewportRef.current) {
      fetchCustomerLayer(viewportRef.current, activeTeamId);
    }
  };

  const handleViewportChange = useCallback((nextViewport) => {
    const viewport = normalizeViewport(nextViewport);
    if (!viewport) {
      return;
    }

    viewportRef.current = viewport;
    scheduleCustomerLayer(viewport);
  }, [scheduleCustomerLayer]);

  const mapMarkers = useMemo(() => {
    const userMarkers = locations
      .filter((item) => item.location)
      .map((item) => ({
        id: `user-${item.user_id}`,
        kind: 'user',
        userId: item.user_id,
        zIndexOffset: 1000,
        latitude: Number(item.location.latitude),
        longitude: Number(item.location.longitude),
        title: item.name || 'Sales',
        description: `${item.branch?.name || item.team || 'Tanpa Cabang'} - ${item.last_seen_at ? moment(item.last_seen_at).format('HH:mm') : 'Baru saja'}`,
        color: item.is_online ? '#10B981' : '#EF4444',
      }))
      .filter((marker) => Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude));

    const branchMarkers = branchLocations.map((branch) => ({
      id: `branch-${branch.id}`,
      kind: 'branch',
      teamId: branch.id,
      zIndexOffset: 500,
      latitude: branch.latitude,
      longitude: branch.longitude,
      title: branch.name || 'Cabang',
      description: `${branch.onlineSalesCount} sales online${branch.code ? ` - ${branch.code}` : ''}`,
      color: '#0E7490',
    }));

    const customerMarkers = showCustomers
      ? customerLayer.items.map((item) => ({
        ...item,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        color: item.kind === 'customer_store' ? '#F59E0B' : undefined,
      })).filter((marker) => Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude))
      : [];

    // Put sales last so their marker remains tappable when locations overlap.
    return [...customerMarkers, ...branchMarkers, ...userMarkers];
  }, [branchLocations, customerLayer.items, locations, showCustomers]);

  const handleMarkerPress = (marker) => {
    if (marker?.kind === 'user' && marker.userId) {
      navigation.navigate('SalesDetail', { userId: marker.userId });
      return;
    }

    if (marker?.kind === 'branch' && marker.teamId && isGlobalView) {
      setSelectedTeamId(marker.teamId);
      return;
    }

    if (marker?.kind === 'customer_cluster') {
      focusMap(Number(marker.latitude), Number(marker.longitude), 15);
    }
  };

  const selectedBranch = findSelectedMonitoringBranch(branchLocations, activeTeamId);
  const mapScope = getMonitoringMapScope({
    scopeTeamId,
    selectedTeamId,
    selectedBranchName: selectedBranch?.name,
    canAccessAllBranches,
  });
  const mapDataState = getMonitoringMapDataState({
    loadError,
    hasLocations: locations.some((item) => item.location),
  });
  const customerMetaText = customerLayer.meta
    ? `${customerLayer.meta.visible_customers || 0} pelanggan ${customerLayer.mode === 'markers' ? 'di peta' : 'dikelompokkan'}`
    : null;

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.center}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>Memuat peta monitoring...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <OpenStreetMapView
        style={[styles.map, { bottom: insets.bottom }]}
        center={region}
        markers={mapMarkers}
        zoom={mapZoom}
        zoomControls={false}
        viewportKey={viewportKey}
        onMarkerPress={handleMarkerPress}
        onViewportChange={handleViewportChange}
      />

      {insets.top > 0 ? <View pointerEvents="none" style={[styles.systemBarShield, { height: insets.top }]} /> : null}

      <View style={[styles.overlayTop, { top: overlayOffsets.top }]}>
        <View style={styles.topRow}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Kembali" style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <ChevronLeft size={18} color={visitColors.primary} />
            <Text style={styles.backBtnText}>Kembali</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Perbarui posisi Sales" style={styles.refreshBtn} onPress={onManualRefresh} disabled={refreshing}>
            {refreshing ? <ActivityIndicator size="small" color={visitColors.primary} /> : <RefreshCw size={20} color={visitColors.primary} />}
          </TouchableOpacity>
        </View>
        <View style={styles.filterRow}>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Sales</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#0E7490' }]} />
            <Text style={styles.legendText}>Cabang</Text>
          </View>
          {showCustomers && (
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>Customer</Text>
            </View>
          )}
        </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={showCustomers ? 'Sembunyikan pelanggan di peta' : 'Tampilkan pelanggan di peta'}
            style={[styles.customerToggle, showCustomers && styles.customerToggleActive]}
            onPress={() => setShowCustomers((current) => !current)}
            activeOpacity={0.85}
          >
            <Text style={[styles.customerToggleText, showCustomers && styles.customerToggleTextActive]}>
              {showCustomers ? 'Pelanggan tampil' : 'Pelanggan tersembunyi'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.mapStatus}>
        <Text style={styles.mapStatusTitle}>
          {mapScope.label}
        </Text>
        {!!lastUpdatedAt && (
          <Text style={styles.mapStatusMeta}>
            Status diperbarui {moment(lastUpdatedAt).format('HH:mm:ss')}
          </Text>
        )}
        {showCustomers && activeTeamId && (
          <Text style={styles.mapStatusMeta}>
            {customerLoading ? 'Memuat pelanggan di area peta...' : customerError ? 'Pelanggan gagal dimuat. Ketuk perbarui.' : customerMetaText || 'Geser atau perbesar peta untuk memuat pelanggan.'}
          </Text>
        )}
        {mapDataState === 'error' ? <Text style={styles.errorText}>Posisi terbaru gagal dimuat. Data terakhir tetap ditampilkan.</Text> : null}
        {mapDataState === 'empty' ? (
          <Text style={styles.mapStatusMeta}>Belum ada posisi Sales yang tersedia. Ketuk perbarui untuk mencoba lagi.</Text>
        ) : null}
        {mapScope.canReturnToGlobal ? (
          <TouchableOpacity accessibilityRole="button" style={styles.allBranchesButton} onPress={() => setSelectedTeamId(null)}>
            <Text style={styles.allBranchesText}>Semua cabang</Text>
          </TouchableOpacity>
        ) : null}
        </View>
      </View>

      <View style={[styles.overlayBottom, { bottom: overlayOffsets.bottom }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.userScroll}>
          {locations.filter((item) => item.location).map((item) => (
            <TouchableOpacity
              key={item.user_id}
              style={styles.userCard}
              onPress={() => navigation.navigate('SalesDetail', { userId: item.user_id })}
            >
              <View style={[styles.statusIndicator, { backgroundColor: item.is_online ? '#10B981' : '#EF4444' }]} />
              <Text style={styles.userCardName}>{item.name}</Text>
              <Text style={styles.userCardStatus}>{getSalesOnlineLabel(item.is_online)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: visitColors.canvas,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: visitColors.canvas,
  },
  loadingText: {
    marginTop: 12,
    color: visitColors.mutedInk,
    fontSize: 14,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  systemBarShield: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: visitColors.canvas,
  },
  overlayTop: {
    position: 'absolute',
    top: visitSpacing.sm,
    left: visitSpacing.page,
    right: visitSpacing.page,
    gap: visitSpacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: visitSpacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: visitSpacing.sm,
  },
  backBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: visitSpacing.xs,
    backgroundColor: visitColors.surface,
    paddingHorizontal: visitSpacing.md,
    borderRadius: visitRadii.control,
    borderWidth: 1,
    borderColor: visitColors.border,
  },
  backBtnText: {
    ...visitType.label,
    color: visitColors.primary,
  },
  legend: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 150,
    minHeight: 44,
    backgroundColor: visitColors.surface,
    paddingHorizontal: visitSpacing.sm,
    paddingVertical: visitSpacing.sm,
    borderRadius: visitRadii.control,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: visitSpacing.sm,
    borderWidth: 1,
    borderColor: visitColors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: visitSpacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...visitType.caption,
    color: visitColors.ink,
  },
  customerToggle: {
    minWidth: 120,
    minHeight: 44,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: visitColors.surface,
    paddingHorizontal: visitSpacing.sm,
    borderRadius: visitRadii.control,
    borderWidth: 1,
    borderColor: visitColors.border,
  },
  customerToggleActive: {
    backgroundColor: visitColors.primary,
    borderColor: visitColors.primary,
  },
  customerToggleText: {
    ...visitType.caption,
    color: visitColors.primary,
    textAlign: 'center',
  },
  customerToggleTextActive: {
    color: visitColors.surface,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: visitColors.surface,
    borderRadius: visitRadii.control,
    borderWidth: 1,
    borderColor: visitColors.border,
  },
  mapStatus: {
    backgroundColor: visitColors.surface,
    borderRadius: visitRadii.card,
    padding: visitSpacing.md,
    gap: visitSpacing.xs,
    borderWidth: 1,
    borderColor: visitColors.border,
  },
  mapStatusTitle: {
    ...visitType.label,
    color: visitColors.ink,
  },
  mapStatusMeta: {
    ...visitType.caption,
    color: visitColors.mutedInk,
  },
  errorText: { ...visitType.caption, color: visitColors.danger },
  allBranchesButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: visitSpacing.sm,
  },
  allBranchesText: {
    ...visitType.label,
    color: visitColors.primary,
  },
  overlayBottom: {
    position: 'absolute',
    bottom: visitSpacing.sm,
    left: 0,
    right: 0,
  },
  userScroll: {
    paddingHorizontal: visitSpacing.page,
    gap: visitSpacing.sm,
  },
  userCard: {
    minHeight: 44,
    backgroundColor: visitColors.surface,
    paddingHorizontal: visitSpacing.card,
    borderRadius: visitRadii.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: visitSpacing.sm,
    minWidth: 120,
    borderWidth: 1,
    borderColor: visitColors.border,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  userCardName: {
    ...visitType.label,
    color: visitColors.ink,
  },
  userCardStatus: { ...visitType.caption, color: visitColors.mutedInk },
});

export default LiveMapScreen;
