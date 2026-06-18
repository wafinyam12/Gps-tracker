import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { MapPin, Navigation, Search } from 'lucide-react-native';
import { visitService } from '../api/services/visitService';
import { storeService } from '../api/services/storeService';

const DEFAULT_REGION = {
  latitude: -6.2,
  longitude: 106.816666,
  latitudeDelta: 0.14,
  longitudeDelta: 0.1,
};

const normalizeStore = (store) => ({
  id: store.id,
  code: store.code,
  external_bp_code: store.external_bp_code || store.code,
  name: store.name,
  address: store.address || '',
  branch: store.branch || store.area || '',
  latitude: Number(store.latitude),
  longitude: Number(store.longitude),
  geofence_radius: store.geofence_radius,
  status: store.status,
  has_location: Boolean(store.has_location),
});

const StartVisitScreen = ({ navigation }) => {
  const mapRef = useRef(null);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState(null);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState('');

  const loadStores = useCallback(async () => {
    try {
      const response = await storeService.getAvailableStores({ search });
      const payload = response.data?.data || response.data || [];
      const normalized = Array.isArray(payload) ? payload.map(normalizeStore) : [];
      setStores(normalized);
      setSelectedStore((current) => current || normalized[0] || null);

      if (normalized.length === 0) {
        setNotice('Belum ada toko aktif dari master data.');
      } else if (normalized.every((store) => !Number.isFinite(store.latitude) || !Number.isFinite(store.longitude))) {
        setNotice('Koordinat toko akan tersimpan setelah visit valid pertama.');
      } else {
        setNotice('');
      }
    } catch (error) {
      console.log('Load stores error:', error.response?.data || error);
      setStores([]);
      setNotice(error.response?.data?.message || 'Gagal memuat daftar toko aktif.');
    } finally {
      setLoading(false);
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
        accuracy: Location.Accuracy.Balanced,
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
    loadStores();
  }, [loadStores, requestLocation]);

  const filteredStores = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return stores;
    }

    return stores.filter((store) => {
      const fields = [store.code, store.external_bp_code, store.name, store.address, store.branch];
      return fields.some((field) => field && field.toLowerCase().includes(keyword));
    });
  }, [search, stores]);

  const focusStore = (store) => {
    setSelectedStore(store);

    if (Number.isFinite(store.latitude) && Number.isFinite(store.longitude)) {
      mapRef.current?.animateToRegion({
        latitude: store.latitude,
        longitude: store.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
  };

  const startVisit = async (store) => {
    const currentLocation = location || await requestLocation();
    if (!currentLocation?.coords) {
      return;
    }

    setStarting(true);
    try {
      const response = await visitService.startVisit({
        store_id: store.id,
        external_bp_code: store.external_bp_code || store.code,
        store_name: store.name,
        store_address: store.address,
        branch: store.branch,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy,
        is_mock_location: currentLocation.mocked || false,
      });

      const payload = response.data || {};
      const warning = payload.warning || response.message || '';

      navigation.replace('VisitForm', {
        visitLogId: payload.visit_log_id,
      });

      if (warning) {
        Alert.alert('Info Visit', warning);
      }
    } catch (error) {
      console.log('Start visit error:', error.response?.data || error);
      Alert.alert('Gagal', error.response?.data?.message || 'Gagal memulai visit.');
    } finally {
      setStarting(false);
    }
  };

  const renderStore = ({ item }) => {
    const isSelected = selectedStore?.id === item.id;
    const hasLocation = Number.isFinite(item.latitude) && Number.isFinite(item.longitude);

    return (
      <TouchableOpacity
        style={[styles.storeCard, isSelected && styles.selectedStoreCard]}
        onPress={() => focusStore(item)}
        disabled={starting}
      >
        <View style={[styles.storeIcon, isSelected && styles.selectedStoreIcon]}>
          <MapPin size={20} color={isSelected ? '#fff' : '#1E40AF'} />
        </View>
        <View style={styles.storeInfo}>
          <Text style={styles.storeCode}>{item.external_bp_code || item.code}</Text>
          <Text style={styles.storeName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.storeAddress} numberOfLines={2}>{item.address || 'Alamat belum tersedia'}</Text>
          <Text style={styles.storeMeta} numberOfLines={1}>
            {item.branch || 'Cabang belum tersedia'}{hasLocation ? ' - Koordinat tersimpan' : ' - Koordinat belum ada'}
          </Text>
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
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={DEFAULT_REGION}
          showsUserLocation
          showsMyLocationButton
        >
          {location?.coords && (
            <Marker
              coordinate={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              title="Lokasi Saya"
              pinColor="#1E40AF"
            />
          )}

          {filteredStores
            .filter((store) => Number.isFinite(store.latitude) && Number.isFinite(store.longitude))
            .map((store) => (
              <Marker
                key={store.external_bp_code || store.code}
                coordinate={{
                  latitude: store.latitude,
                  longitude: store.longitude,
                }}
                title={store.name}
                description={store.external_bp_code || store.code}
                pinColor={selectedStore?.id === store.id ? '#F59E0B' : '#16A34A'}
                onPress={() => setSelectedStore(store)}
              />
            ))}
        </MapView>

        <View style={styles.locationCard}>
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
            Pilih toko dari master data SAP dummy. Koordinat toko baru akan tersimpan saat visit valid pertama.
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
          <ActivityIndicator size="small" color="#1E40AF" />
          <Text style={styles.loadingText}>Memuat daftar toko aktif...</Text>
        </View>
      ) : null}

      <FlatList
        data={filteredStores}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderStore}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>Tidak ada toko yang cocok.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    paddingBottom: 40,
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
    backgroundColor: '#EFF6FF',
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
    color: '#1E40AF',
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
  startButton: {
    minWidth: 62,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: '#1E40AF',
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
