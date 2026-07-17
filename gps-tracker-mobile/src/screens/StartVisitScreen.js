import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { ArrowLeft, MapPin, Navigation, Search } from 'lucide-react-native';
import { visitService } from '../api/services/visitService';
import { storeService } from '../api/services/storeService';
import { normalizePhoneNumber } from '../utils/phone';
import { canOpenRoute, openMapRoute } from '../utils/maps';
import { evaluateVisitLocation } from '../utils/locationIntegrity';
import OpenStreetMapView from '../components/maps/OpenStreetMapView';

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
});

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
      if (trimmedKeyword) {
        params.search = trimmedKeyword;
      }

      const response = await storeService.getAvailableStores(params);
      if (requestSeq !== requestSeqRef.current) {
        return;
      }

      const { items, meta } = extractAvailableStoresPayload(response);
      const normalized = items.map(normalizeStore);

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

      console.log('Load stores error:', error.response?.data || error);
      if (!append) {
        setStores([]);
        setSelectedStore(null);
        setHasMore(false);
        setNotice(error.response?.data?.message || 'Gagal memuat daftar toko aktif.');
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
  }, []);

  const requestLocation = useCallback(async () => {
    try {
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
    const currentLocation = await requestLocation();
    if (!currentLocation?.coords) {
      return;
    }

    const integrity = evaluateVisitLocation(currentLocation);
    if (!integrity.isValid) {
      Alert.alert(integrity.title, integrity.message);
      return;
    }

    setStarting(true);
    try {
      const locationPayload = integrity.payload;
      const response = await visitService.startVisit({
        store_id: store.id,
        external_bp_code: store.external_bp_code || store.code,
        store_name: store.name,
        store_address: store.address,
        branch: store.branch,
        latitude: locationPayload.latitude,
        longitude: locationPayload.longitude,
        accuracy: locationPayload.accuracy,
        is_mock_location: locationPayload.is_mock_location,
        location_recorded_at: locationPayload.location_recorded_at,
      });

      const payload = response.data || {};
      const warning = payload.warning || response.message || '';

      navigation.push('VisitForm', {
        visitLogId: payload.visit_log_id,
      });

      if (warning) {
        Alert.alert('Info Visit', warning);
      }
    } catch (error) {
      console.log('Start visit error:', error.response?.data || error);
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
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
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
    const isSelected = selectedStore?.id === item.id;
    const hasLocation = canOpenRoute(item);

    return (
      <TouchableOpacity
        style={[styles.storeCard, isSelected && styles.selectedStoreCard]}
        onPress={() => focusStore(item)}
        disabled={starting}
      >
        <View style={[styles.storeIcon, isSelected && styles.selectedStoreIcon]}>
          <MapPin size={20} color={isSelected ? '#fff' : '#0F766E'} />
        </View>
        <View style={styles.storeInfo}>
          <Text style={styles.storeCode}>{item.external_bp_code || item.code}</Text>
          <Text style={styles.storeName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.storeAddress} numberOfLines={2}>{item.address || 'Alamat belum tersedia'}</Text>
          <Text style={styles.storeMeta} numberOfLines={1}>
            {item.branch || 'Cabang belum tersedia'}{hasLocation ? ' - Koordinat tersimpan' : ' - Koordinat belum ada'}
          </Text>
          {hasLocation && (
            <TouchableOpacity
              style={styles.routeButton}
              onPress={() => handleOpenRoute(item)}
              disabled={starting}
              activeOpacity={0.85}
            >
              <Navigation size={13} color="#0F766E" />
              <Text style={styles.routeButtonText}>Rute</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.startButton, starting && styles.disabled]}
          onPress={() => startVisit(item)}
          disabled={starting}
        >
          {starting && isSelected ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.startButtonText}>Mulai</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <OpenStreetMapView
          style={styles.map}
          center={location?.coords || DEFAULT_REGION}
          markers={mapMarkers}
          zoom={14}
        />

        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackToHome} activeOpacity={0.85}>
              <ArrowLeft size={16} color="#0F766E" />
              <Text style={styles.backButtonText}>Home</Text>
            </TouchableOpacity>
            <Text style={styles.locationBadge}>Tambah Kunjungan</Text>
          </View>
          <Text style={styles.title}>Self-Visit</Text>
          <View style={styles.locationRow}>
            <Navigation size={15} color="#64748B" />
            <Text style={styles.locationText}>
              {location?.coords
                ? `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`
                : 'Mencari lokasi...'}
            </Text>
          </View>
          <Text style={styles.noteText}>
            Pilih toko dari master data SAP. Koordinat toko baru akan tersimpan saat visit valid pertama.
          </Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Cari kode, nama, alamat, atau cabang..."
          placeholderTextColor="#94A3B8"
        />
      </View>

      {!!notice && (
        <View style={styles.noticeRow}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#0F766E" />
            <Text style={styles.loadingText}>Memuat daftar toko aktif...</Text>
          </View>
        ) : (
          <FlatList
            data={stores}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderStore}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.emptyText}>Tidak ada toko yang cocok.</Text>}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            refreshing={loading}
            onRefresh={handleRefresh}
            ListFooterComponent={(
              <>
                {loadingMore ? (
                  <View style={styles.footerRow}>
                    <ActivityIndicator size="small" color="#0F766E" />
                    <Text style={styles.footerText}>Memuat data berikutnya...</Text>
                  </View>
                ) : null}
                {!loading && !loadingMore && hasMore && stores.length > 0 ? (
                  <View style={styles.footerHint}>
                    <Text style={styles.footerHintText}>Scroll lagi untuk memuat data berikutnya.</Text>
                  </View>
                ) : null}
                {!loading && !loadingMore && !hasMore && stores.length > 0 ? (
                  <View style={styles.footerHint}>
                    <Text style={styles.footerHintText}>Semua data sudah dimuat.</Text>
                  </View>
                ) : null}
              </>
            )}
          />
        )}
      </View>
    );
  };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  mapWrap: {
    height: 260,
    backgroundColor: '#E2E8F0',
  },
  map: {
    width: Dimensions.get('window').width,
    height: 260,
  },
  locationCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    padding: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E7F1EF',
    borderWidth: 1,
    borderColor: '#BFE3DD',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  backButtonText: {
    color: '#0F766E',
    fontSize: 13,
    fontWeight: '800',
  },
  locationBadge: {
    flexShrink: 1,
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
  },
  locationText: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  noteText: {
    marginTop: 8,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  searchBox: {
    margin: 16,
    marginBottom: 8,
    minHeight: 48,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  list: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 64 : 40,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  footerHint: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  footerHintText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  noticeRow: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    color: '#B45309',
  },
  loadingRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  storeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  selectedStoreCard: {
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  storeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E7F1EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedStoreIcon: {
    backgroundColor: '#F59E0B',
  },
  storeInfo: {
    flex: 1,
  },
  storeCode: {
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  storeName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  storeAddress: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  storeMeta: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  routeButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E7F1EF',
    borderWidth: 1,
    borderColor: '#BFE3DD',
  },
  routeButtonText: {
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '900',
  },
  startButton: {
    minWidth: 62,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 60,
    color: '#94A3B8',
    fontSize: 14,
  },
});

export default StartVisitScreen;
