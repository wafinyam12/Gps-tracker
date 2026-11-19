import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Navigation, Search } from 'lucide-react-native';
import { visitService } from '../api/services/visitService';
import { storeService } from '../api/services/storeService';
import { normalizePhoneNumber } from '../utils/phone';
import { canOpenRoute, openMapRoute } from '../utils/maps';
import { evaluateVisitLocation } from '../utils/locationIntegrity';
import { logEvent } from '../utils/diagnosticLogger';
import { confirmLocationDisclosure } from '../utils/locationDisclosure';
import { offlineQueue } from '../utils/offlineQueue';
import { visitSampleQueue } from '../utils/visitSampleQueue';
import { startBackgroundTracking } from '../utils/backgroundTracker';
import { evaluateStartRadius, capturedStoreReference } from '../utils/visitRadiusDecision';
import { useAuth } from '../context/AuthContext';
import { getRoleName } from '../utils/roles';
import OpenStreetMapView from '../components/maps/OpenStreetMapView';
import AppScreen from '../components/ui/AppScreen';
import VisitHeader from '../components/visit/VisitHeader';
import VisitStoreRow from '../components/visit/VisitStoreRow';
import { visitColors, visitRadii, visitSpacing, visitType } from '../styles/visitTheme';

const DEFAULT_REGION = {
  latitude: -6.2,
  longitude: 106.816666,
  latitudeDelta: 0.14,
  longitudeDelta: 0.1,
};

const toCoordinateNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const normalizeStore = (store) => ({
  id: store.id,
  code: store.code,
  external_bp_code: store.external_bp_code || store.code,
  name: store.name,
  address: store.address || '',
  branch: store.branch || store.area || '',
  pic_name: store.pic_name || '',
  pic_phone: normalizePhoneNumber(store.pic_phone),
  latitude: toCoordinateNumber(store.latitude),
  longitude: toCoordinateNumber(store.longitude),
  geofence_radius: store.geofence_radius,
  status: store.status,
  has_location: Boolean(store.has_location),
  sales_owner_name: typeof store.sales_owner_name === 'string' ? store.sales_owner_name.trim() : '',
});

const distanceBetweenMeters = (first, second) => {
  const earthRadius = 6371000;
  const latitudeDelta = ((second.latitude - first.latitude) * Math.PI) / 180;
  const longitudeDelta = ((second.longitude - first.longitude) * Math.PI) / 180;
  const latitude1 = (first.latitude * Math.PI) / 180;
  const latitude2 = (second.latitude * Math.PI) / 180;
  const value = Math.min(1, Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const PAGE_SIZE = 25;

const extractAvailableStoresPayload = (response) => {
  const payload = response?.data?.data ?? response?.data ?? [];

  if (Array.isArray(payload)) {
    return { items: payload, meta: null };
  }

  if (Array.isArray(payload.items)) {
    return { items: payload.items, meta: payload.meta || null };
  }

  if (Array.isArray(payload.data)) {
    return { items: payload.data, meta: payload.meta || null };
  }

  return { items: [], meta: payload.meta || null };
};

const dedupeStores = (items) => {
  const seen = new Set();

  return items.filter((store) => {
    const key = store.id ?? store.external_bp_code ?? store.code;

    if (key === null || key === undefined) {
      return true;
    }

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const StartVisitScreen = ({ navigation }) => {
  const { user } = useAuth();
  const showSalesOwner = getRoleName(user) === 'spv';
  const requestSeqRef = useRef(0);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState(null);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState('');
  const [viewMode, setViewMode] = useState('list');

  const loadStores = useCallback(async ({
    keyword = '',
    nextPage = 1,
    append = false,
  } = {}) => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const trimmedKeyword = keyword.trim();

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setLoadingMore(false);
      setStores([]);
      setSelectedStore(null);
    }

    try {
      const params = {
        page: nextPage,
        per_page: PAGE_SIZE,
      };
      if (location?.coords
        && Number.isFinite(location.coords.latitude)
        && Number.isFinite(location.coords.longitude)) {
        params.latitude = location.coords.latitude;
        params.longitude = location.coords.longitude;
      }
      if (trimmedKeyword) {
        params.search = trimmedKeyword;
      }

      const response = await storeService.getAvailableStores(params);
      if (requestSeq !== requestSeqRef.current) {
        return;
      }

      const { items, meta } = extractAvailableStoresPayload(response);
      const normalized = items.map(normalizeStore);
      try {
        await offlineQueue.cacheStores(normalized);
      } catch (cacheError) {
        logEvent('visit.stores_cache_failed', { error_code: cacheError?.code });
      }

      setStores((current) => {
        if (append && nextPage > 1) {
          return dedupeStores([...current, ...normalized]);
        }

        return normalized;
      });

      setPage(nextPage);
      setHasMore(() => {
        if (meta && typeof meta.has_more === 'boolean') {
          return meta.has_more;
        }

        if (meta && typeof meta.current_page === 'number' && typeof meta.last_page === 'number') {
          return meta.current_page < meta.last_page;
        }

        return normalized.length >= PAGE_SIZE;
      });

      if (!append) {
        setSelectedStore((current) => {
          if (current && normalized.some((store) => store.id === current.id)) {
            return current;
          }

          return normalized[0] || null;
        });

        if (normalized.length === 0) {
          setNotice(trimmedKeyword
            ? 'Tidak ada toko yang cocok dengan kata kunci ini.'
            : 'Belum ada toko aktif dari master data.');
        } else if (normalized.every((store) => !Number.isFinite(store.latitude) || !Number.isFinite(store.longitude))) {
          setNotice('Koordinat toko akan tersimpan setelah visit valid pertama.');
        } else {
          setNotice('');
        }
      }
    } catch (error) {
      if (requestSeq !== requestSeqRef.current) {
        return;
      }

      logEvent('visit.stores_fetch_failed', { status: error.response?.status, error_code: error.code });
      if (!append) {
        let cached = { stores: [] };
        try {
          cached = await offlineQueue.cachedStores();
        } catch (cacheError) {
          logEvent('visit.stores_cache_read_failed', { error_code: cacheError?.code });
        }
        const cachedStores = Array.isArray(cached.stores) ? cached.stores : [];
        setStores(cachedStores);
        setSelectedStore(cachedStores[0] || null);
        setHasMore(false);
        setNotice(cachedStores.length > 0
          ? 'Mode offline: memakai daftar customer tersimpan. Data akan disinkronkan saat koneksi kembali.'
          : (error.response?.data?.message || 'Daftar customer belum pernah tersimpan di perangkat ini atau penyimpanan offline belum siap.'));
      } else {
        Alert.alert('Gagal', error.response?.data?.message || 'Gagal memuat data toko berikutnya.');
      }
    } finally {
      if (requestSeq === requestSeqRef.current) {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    }
  }, [location?.coords?.latitude, location?.coords?.longitude]);

  const requestLocation = useCallback(async () => {
    try {
      const disclosed = await confirmLocationDisclosure({
        title: 'Lokasi untuk visit ini',
        message: 'Lokasi saat ini digunakan untuk mencatat dan memverifikasi visit ini. Koordinat dan waktu akan dikirim bersama data visit. Pelacakan berkala di latar belakang memerlukan persetujuan terpisah.',
      });
      if (!disclosed) return null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Izin lokasi diperlukan untuk memulai visit.');
        return null;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(current);
      return current;
    } catch (error) {
      Alert.alert('Error', 'Gagal mendapatkan lokasi saat ini.');
      return null;
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStores({ keyword: search, nextPage: 1, append: false });
    }, search.trim() ? 300 : 0);

    return () => clearTimeout(timer);
  }, [loadStores, search]);

  const handleRefresh = useCallback(() => {
    loadStores({ keyword: search, nextPage: 1, append: false });
  }, [loadStores, search]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) {
      return;
    }

    loadStores({
      keyword: search,
      nextPage: page + 1,
      append: true,
    });
  }, [hasMore, loadStores, loading, loadingMore, page, search]);

  const focusStore = (store) => {
    setSelectedStore(store);
  };

  const startVisit = async (store) => {
    setSelectedStore(store);
    const currentLocation = await requestLocation();
    if (!currentLocation?.coords) {
      return;
    }

    const integrity = evaluateVisitLocation(currentLocation);
    if (!integrity.isValid) {
      Alert.alert(integrity.title, integrity.message);
      return;
    }

    const radiusDecision = evaluateStartRadius(store, integrity.payload);
    if (!radiusDecision.canStart) {
      Alert.alert('Lokasi Check-in', radiusDecision.message);
      return;
    }

    const clientUuid = offlineQueue.createUuid();
    const startPayload = {
      store_id: store.id,
      external_bp_code: store.external_bp_code || store.code,
      store_name: store.name,
      store_address: store.address,
      branch: store.branch,
      latitude: integrity.payload.latitude,
      longitude: integrity.payload.longitude,
      accuracy: integrity.payload.accuracy,
      is_mock_location: integrity.payload.is_mock_location,
      location_recorded_at: integrity.payload.location_recorded_at,
      client_uuid: clientUuid,
      ...capturedStoreReference(store),
    };

    setStarting(true);
    try {
      const response = await visitService.startVisit(startPayload);

      const payload = response.data || {};
      const warning = payload.warning || response.message || '';
      let trackingWarning = '';

      try {
        await visitSampleQueue.begin(String(user.id), { serverVisitId: payload.visit_log_id, startedAt: startPayload.location_recorded_at });
        await visitSampleQueue.capture(String(user.id), currentLocation);
        if (!await startBackgroundTracking()) {
          trackingWarning = 'Aktifkan izin lokasi latar belakang agar waktu di radius dapat diperkirakan saat layar terkunci.';
        }
      } catch (trackingError) {
        logEvent('visit.presence_start_failed', { error_code: trackingError?.code });
        trackingWarning = 'Pengukuran lokasi belum aktif. Visit tetap dimulai, tetapi waktu di area customer mungkin tidak terukur.';
      }

      navigation.push('VisitForm', {
        visitLogId: payload.visit_log_id,
      });

      if (warning || trackingWarning) {
        Alert.alert('Info Visit', [warning, trackingWarning].filter(Boolean).join('\n\n'));
      }
    } catch (error) {
      logEvent('visit.start_failed', { status: error.response?.status, error_code: error.code });
      const responseData = error.response?.data || {};
      const activeVisitId = responseData?.errors?.visit_log_id || responseData?.data?.visit_log_id || null;

      if (error.response?.status === 409 && activeVisitId) {
        Alert.alert(
          'Kunjungan Aktif',
          responseData?.message || 'Masih ada kunjungan aktif. Selesaikan check-out terlebih dahulu.',
          [
            { text: 'Tetap di List Toko', style: 'cancel' },
            {
              text: 'Buka Visit Aktif',
              onPress: () => {
                navigation.navigate('VisitForm', { visitLogId: activeVisitId });
              },
            },
          ]
        );
        return;
      }

      const reachable = await offlineQueue.isReachable();
      if (!reachable || !error.response) {
        try {
          const queued = await offlineQueue.enqueueVisitStart(startPayload, clientUuid);
          try {
            await visitSampleQueue.begin(String(user.id), { localVisitId: queued.localVisitId, startedAt: startPayload.location_recorded_at });
            await visitSampleQueue.capture(String(user.id), currentLocation);
            await startBackgroundTracking();
          } catch (trackingError) {
            logEvent('visit.offline_presence_start_failed', { error_code: trackingError?.code });
          }
          navigation.push('VisitForm', {
            offlineVisit: {
              ...queued,
              store,
              checkinAt: startPayload.location_recorded_at || new Date().toISOString(),
              checkinLocation: {
                latitude: startPayload.latitude,
                longitude: startPayload.longitude,
              },
              checkinAccuracy: startPayload.accuracy,
            },
          });
          Alert.alert('Disimpan Offline', 'Check-in tersimpan di perangkat. Selesaikan form visit, data akan dikirim otomatis saat koneksi kembali.');
          return;
        } catch (queueError) {
          logEvent('visit.offline_enqueue_failed', { error_code: queueError?.code });
          Alert.alert('Gagal', 'Tidak dapat menyimpan kunjungan offline di perangkat.');
          return;
        }
      }

      Alert.alert('Gagal', responseData?.message || 'Gagal memulai visit.');
    } finally {
      setStarting(false);
    }
  };

  const handleOpenRoute = async (store) => {
    try {
      const opened = await openMapRoute(store);

      if (!opened) {
        Alert.alert('Rute Belum Tersedia', 'Koordinat toko belum tersedia.');
      }
    } catch (error) {
      Alert.alert('Gagal Membuka Maps', 'Tidak bisa membuka Google Maps dari perangkat ini.');
    }
  };

  const handleBackToHome = useCallback(() => {
    navigation.popTo('Home');
  }, [navigation]);

  const mapMarkers = useMemo(() => {
    const points = [];

    if (location?.coords) {
      points.push({
        id: 'current-location',
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        title: 'Lokasi Saya',
        description: `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`,
        color: '#0F766E',
      });
    }

    stores
      .filter((store) => Number.isFinite(store.latitude) && Number.isFinite(store.longitude))
      .forEach((store) => {
        const selected = selectedStore?.id === store.id;
        points.push({
          id: `store-${store.id || store.external_bp_code || store.code}`,
          latitude: store.latitude,
          longitude: store.longitude,
          title: store.name || 'Toko',
          description: store.external_bp_code || store.code || store.address || '',
          color: selected ? '#F59E0B' : '#16A34A',
        });
      });

    return points;
  }, [location, selectedStore?.id, stores]);

  const renderStore = ({ item }) => {
    const hasLocation = canOpenRoute(item);
    const distanceMeters = location?.coords && hasLocation
      ? distanceBetweenMeters(
        { latitude: location.coords.latitude, longitude: location.coords.longitude },
        { latitude: item.latitude, longitude: item.longitude }
      )
      : null;

    return (
      <VisitStoreRow
        store={item}
        showSalesOwner={showSalesOwner}
        selected={selectedStore?.id === item.id}
        starting={starting}
        distanceMeters={distanceMeters}
        onSelect={focusStore}
        onStart={startVisit}
        onRoute={handleOpenRoute}
      />
    );
  };

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      <VisitHeader
        title="Pilih toko"
        subtitle="Cari pelanggan SAP untuk memulai kunjungan."
        onBack={handleBackToHome}
      />

      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Search size={18} color={visitColors.mutedInk} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setViewMode('list')}
            placeholder="Cari nama, kode, alamat, atau cabang"
            placeholderTextColor={visitColors.mutedInk}
            returnKeyType="search"
          />
        </View>

        <View style={styles.viewSwitch}>
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'list' }}
            onPress={() => setViewMode('list')}
            style={[styles.switchOption, viewMode === 'list' && styles.switchSelected]}
          >
            <Text style={[styles.switchText, viewMode === 'list' && styles.switchTextSelected]}>Daftar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'map' }}
            onPress={() => setViewMode('map')}
            style={[styles.switchOption, viewMode === 'map' && styles.switchSelected]}
          >
            <Text style={[styles.switchText, viewMode === 'map' && styles.switchTextSelected]}>Peta</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gpsRow}>
          <View style={styles.gpsCopy}>
            <Navigation size={16} color={location?.coords ? visitColors.success : visitColors.warning} />
            <Text style={styles.gpsText}>
              {location?.coords ? 'GPS siap digunakan' : 'GPS belum tersedia; pencarian toko tetap bisa'}
            </Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={requestLocation} style={styles.refreshButton}>
            <Text style={styles.refreshText}>Perbarui</Text>
          </TouchableOpacity>
        </View>

        {notice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapWrap}>
          <OpenStreetMapView
            style={styles.map}
            center={location?.coords || DEFAULT_REGION}
            markers={mapMarkers}
            zoom={14}
          />
        </View>
      ) : null}

      <View style={styles.listTitleRow}>
        <Text style={styles.listTitle}>Daftar toko</Text>
        {!loading ? <Text style={styles.listCount}>{stores.length} dimuat</Text> : null}
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={visitColors.primary} />
          <Text style={styles.loadingText}>Memuat toko aktif...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.listView}
          data={stores}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderStore}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Toko tidak ditemukan</Text>
              <Text style={styles.emptyText}>Ubah kata kunci atau perbarui daftar toko saat koneksi tersedia.</Text>
            </View>
          )}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshing={loading}
          onRefresh={handleRefresh}
          ListFooterComponent={(
            <>
              {loadingMore ? (
                <View style={styles.footerRow}>
                  <ActivityIndicator size="small" color={visitColors.primary} />
                  <Text style={styles.footerText}>Memuat toko berikutnya...</Text>
                </View>
              ) : null}
              {!loadingMore && hasMore && stores.length > 0 ? (
                <Text style={styles.footerText}>Geser untuk memuat toko berikutnya.</Text>
              ) : null}
              {!loadingMore && !hasMore && stores.length > 0 ? (
                <Text style={styles.footerText}>Semua toko sudah dimuat.</Text>
              ) : null}
            </>
          )}
        />
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas },
  screenContent: { paddingTop: 0, paddingBottom: 0 },
  controls: { paddingHorizontal: visitSpacing.page, paddingTop: visitSpacing.card },
  searchBox: { minHeight: 48, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.control, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm, paddingHorizontal: visitSpacing.md },
  searchInput: { flex: 1, minWidth: 0, ...visitType.body, color: visitColors.ink, paddingVertical: visitSpacing.sm },
  viewSwitch: { flexDirection: 'row', backgroundColor: visitColors.primaryTint, borderRadius: visitRadii.control, padding: visitSpacing.xs, marginTop: visitSpacing.md },
  switchOption: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: visitRadii.control },
  switchSelected: { backgroundColor: visitColors.surface },
  switchText: { ...visitType.label, color: visitColors.mutedInk },
  switchTextSelected: { color: visitColors.primary },
  gpsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: visitSpacing.sm, marginTop: visitSpacing.sm },
  gpsCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.xs },
  gpsText: { ...visitType.caption, color: visitColors.mutedInk, flex: 1 },
  refreshButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: visitSpacing.sm },
  refreshText: { ...visitType.label, color: visitColors.primary },
  notice: { backgroundColor: visitColors.warningTint, borderRadius: visitRadii.control, padding: visitSpacing.md, marginTop: visitSpacing.sm },
  noticeText: { ...visitType.caption, color: visitColors.warning },
  mapWrap: { height: 190, overflow: 'hidden', borderRadius: visitRadii.card, marginHorizontal: visitSpacing.page, marginTop: visitSpacing.sm, borderWidth: 1, borderColor: visitColors.border },
  map: { width: '100%', height: '100%' },
  listTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: visitSpacing.sm, paddingHorizontal: visitSpacing.page, marginTop: visitSpacing.section, marginBottom: visitSpacing.sm },
  listTitle: { ...visitType.section, color: visitColors.ink },
  listCount: { ...visitType.caption, color: visitColors.mutedInk },
  listView: { flex: 1 },
  listContent: { paddingHorizontal: visitSpacing.page, paddingBottom: visitSpacing.sectionLarge },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: visitSpacing.sm, paddingVertical: visitSpacing.sectionLarge },
  loadingText: { ...visitType.body, color: visitColors.mutedInk },
  emptyState: { backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, padding: visitSpacing.card },
  emptyTitle: { ...visitType.section, color: visitColors.ink },
  emptyText: { ...visitType.body, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: visitSpacing.sm, minHeight: 44 },
  footerText: { ...visitType.caption, color: visitColors.mutedInk, textAlign: 'center', paddingVertical: visitSpacing.sm },
});

export default StartVisitScreen;
