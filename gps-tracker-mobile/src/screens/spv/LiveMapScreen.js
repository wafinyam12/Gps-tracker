import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft, RefreshCw } from 'lucide-react-native';
import { locationService } from '../../api/services/locationService';
import OpenStreetMapView from '../../components/maps/OpenStreetMapView';

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
  const [showCustomers, setShowCustomers] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [mapZoom, setMapZoom] = useState(12);
  const [viewportKey, setViewportKey] = useState(0);
  const hasCenteredRef = useRef(false);
  const liveRequestSequenceRef = useRef(0);
  const customerRequestSequenceRef = useRef(0);
  const viewportTimerRef = useRef(null);
  const viewportRef = useRef(null);
  const navigation = useNavigation();

  const activeTeamId = selectedTeamId || scopeTeamId;
  const isGlobalView = !scopeTeamId && !selectedTeamId;
  const canReturnToGlobal = !scopeTeamId && !!selectedTeamId;

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
        console.log('Error fetching customer markers', error.response?.data || error);
        setCustomerLayer({ mode: 'clusters', items: [], meta: null });
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

      if (!hasCenteredRef.current) {
        const selectedBranch = branches.find((branch) => branch.id === (selectedTeamId || nextScopeTeamId));
        const firstUser = users.find((user) => user.location);
        const anchor = selectedBranch || firstUser?.location || branches[0];

        if (anchor) {
          focusMap(anchor.latitude, anchor.longitude, selectedBranch || nextScopeTeamId ? 12 : 6);
          hasCenteredRef.current = true;
        }
      }
    } catch (error) {
      if (requestSequence === liveRequestSequenceRef.current) {
        console.log('Error fetching live locations', error.response?.data || error);
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
      const interval = setInterval(fetchLocations, LIVE_REFRESH_MS);

      return () => clearInterval(interval);
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

    return [...branchMarkers, ...userMarkers, ...customerMarkers];
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

  const selectedBranch = branchLocations.find((branch) => branch.id === activeTeamId);
  const customerMetaText = customerLayer.meta
    ? `${customerLayer.meta.visible_customers || 0} customer ${customerLayer.mode === 'markers' ? 'di peta' : 'dikelompokkan'}`
    : null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>Memuat peta monitoring...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OpenStreetMapView
        style={styles.map}
        center={region}
        markers={mapMarkers}
        zoom={mapZoom}
        viewportKey={viewportKey}
        onMarkerPress={handleMarkerPress}
        onViewportChange={handleViewportChange}
      />

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
        <ChevronLeft size={18} color="#0F766E" />
        <Text style={styles.backBtnText}>Kembali</Text>
      </TouchableOpacity>

      <View style={styles.overlayHeader}>
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

        <View style={styles.actionStack}>
          <TouchableOpacity
            style={[styles.customerToggle, showCustomers && styles.customerToggleActive]}
            onPress={() => setShowCustomers((current) => !current)}
            activeOpacity={0.85}
          >
            <Text style={[styles.customerToggleText, showCustomers && styles.customerToggleTextActive]}>
              {showCustomers ? 'Customer On' : 'Customer Off'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshBtn} onPress={onManualRefresh} disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator size="small" color="#0F766E" />
            ) : (
              <RefreshCw size={20} color="#0F766E" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mapStatus}>
        <Text style={styles.mapStatusTitle}>
          {selectedBranch?.name || (isGlobalView ? 'Pilih marker cabang untuk melihat customer' : 'Monitoring Cabang')}
        </Text>
        {showCustomers && activeTeamId && (
          <Text style={styles.mapStatusMeta}>
            {customerLoading ? 'Memuat customer di area peta...' : customerMetaText || 'Geser atau perbesar peta untuk memuat customer.'}
          </Text>
        )}
        {canReturnToGlobal && (
          <TouchableOpacity style={styles.allBranchesButton} onPress={() => setSelectedTeamId(null)}>
            <Text style={styles.allBranchesText}>Semua cabang</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.overlayBottom}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.userScroll}>
          {locations.filter((item) => item.location).map((item) => (
            <TouchableOpacity
              key={item.user_id}
              style={styles.userCard}
              onPress={() => focusMap(Number(item.location.latitude), Number(item.location.longitude), 15)}
            >
              <View style={[styles.statusIndicator, { backgroundColor: item.is_online ? '#10B981' : '#EF4444' }]} />
              <Text style={styles.userCardName}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  overlayHeader: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  backBtn: {
    position: 'absolute',
    top: 18,
    left: 20,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F766E',
  },
  legend: {
    flex: 1,
    maxWidth: '68%',
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E293B',
  },
  actionStack: {
    alignItems: 'flex-end',
    gap: 8,
  },
  customerToggle: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    elevation: 4,
  },
  customerToggleActive: {
    backgroundColor: '#B45309',
  },
  customerToggleText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '900',
  },
  customerToggleTextActive: {
    color: '#fff',
  },
  refreshBtn: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapStatus: {
    position: 'absolute',
    top: 132,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  mapStatusTitle: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '900',
  },
  mapStatusMeta: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
  },
  allBranchesButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  allBranchesText: {
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '900',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 64 : 40,
    left: 0,
    right: 0,
  },
  userScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  userCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 120,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  userCardName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
  },
});

export default LiveMapScreen;
