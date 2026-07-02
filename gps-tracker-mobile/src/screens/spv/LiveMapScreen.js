import React, { useEffect, useRef, useState } from 'react';
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
import MapView, { Callout, Marker } from 'react-native-maps';
import moment from 'moment';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, RefreshCw, Clock } from 'lucide-react-native';
import { locationService } from '../../api/services/locationService';
import { storeService } from '../../api/services/storeService';

const normalizeStore = (store) => ({
  id: store.id,
  name: store.name,
  address: store.address,
  branch: store.branch,
  code: store.code,
  latitude: Number(store.latitude),
  longitude: Number(store.longitude),
});

const normalizeBranch = (branch) => ({
  id: branch.id,
  name: branch.name,
  code: branch.code,
  area: branch.area,
  latitude: Number(branch.latitude ?? branch.location?.latitude),
  longitude: Number(branch.longitude ?? branch.location?.longitude),
  is_active: Boolean(branch.is_active),
});

const LiveMapScreen = () => {
  const [locations, setLocations] = useState([]);
  const [branchLocations, setBranchLocations] = useState([]);
  const [storeTargets, setStoreTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mapRef = useRef(null);
  const hasCenteredRef = useRef(false);
  const navigation = useNavigation();

  const [region, setRegion] = useState({
    latitude: -6.2,
    longitude: 106.816666,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  const fetchStoreTargets = async () => {
    try {
      const response = await storeService.getAvailableStores();
      const payload = response.data?.data || response.data || [];
      const stores = Array.isArray(payload)
        ? payload.map(normalizeStore).filter((store) => Number.isFinite(store.latitude) && Number.isFinite(store.longitude))
        : [];
      setStoreTargets(stores);
      return stores;
    } catch (error) {
      console.log('Error fetching store targets', error.response?.data || error);
      setStoreTargets([]);
      return [];
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await locationService.getLiveLocations();
      const payload = response.data?.data || [];
      const normalizedUsers = Array.isArray(payload) ? payload : payload?.users || [];
      const normalizedBranches = Array.isArray(payload) ? [] : payload?.branches || [];
      const branchData = Array.isArray(normalizedBranches)
        ? normalizedBranches.map(normalizeBranch).filter((branch) => Number.isFinite(branch.latitude) && Number.isFinite(branch.longitude))
        : [];

      setLocations(Array.isArray(normalizedUsers) ? normalizedUsers : []);
      setBranchLocations(branchData);
      const stores = await fetchStoreTargets();

      if (!hasCenteredRef.current) {
        const firstUser = normalizedUsers.find((user) => user.location);
        const firstBranch = branchData.find((branch) => Number.isFinite(branch.latitude) && Number.isFinite(branch.longitude));
        const firstStore = stores.find((store) => Number.isFinite(store.latitude) && Number.isFinite(store.longitude));

        const anchor = firstUser?.location || firstBranch || firstStore;
        if (anchor) {
          const newRegion = {
            latitude: anchor.latitude,
            longitude: anchor.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          setRegion(newRegion);
          mapRef.current?.animateToRegion(newRegion, 1000);
          hasCenteredRef.current = true;
        }
      }
    } catch (error) {
      console.log('Error fetching live locations', error.response?.data || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 30000);
    return () => clearInterval(interval);
  }, []);

  const onManualRefresh = () => {
    setRefreshing(true);
    fetchLocations();
  };

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
        <MapView
          ref={mapRef}
          style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
      >
        {locations.map((item) => {
          if (!item.location) {
            return null;
          }

          return (
            <Marker
              key={item.user_id}
              coordinate={{
                latitude: item.location.latitude,
                longitude: item.location.longitude,
              }}
              pinColor={item.is_online ? '#10B981' : '#EF4444'}
            >
              <Callout onPress={() => navigation.navigate('SalesDetail', { userId: item.user_id })}>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>{item.name}</Text>
                  <Text style={styles.calloutTeam}>{item.branch?.name || item.team || 'Tanpa Cabang'}</Text>
                  <View style={styles.calloutTime}>
                    <Clock size={10} color="#64748B" />
                    <Text style={styles.calloutTimeText}>
                      {item.last_seen_at ? moment(item.last_seen_at).format('HH:mm') : 'Baru saja'}
                    </Text>
                  </View>
                  <Text style={styles.calloutLink}>Lihat Detail {'>'}</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {branchLocations.map((branch) => (
          <Marker
            key={`branch-${branch.id}`}
            coordinate={{
              latitude: branch.latitude,
              longitude: branch.longitude,
            }}
            pinColor="#0E7490"
          >
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutName}>{branch.name || 'Cabang'}</Text>
                <Text style={styles.calloutTeam}>{branch.code || branch.area || 'Lokasi cabang'}</Text>
                <Text style={styles.calloutTimeText}>
                  {branch.is_active ? 'Cabang aktif' : 'Cabang nonaktif'}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {storeTargets.map((store) => (
          <Marker
            key={`store-${store.id}`}
            coordinate={{
              latitude: store.latitude,
              longitude: store.longitude,
            }}
            pinColor="#F59E0B"
          >
            <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>{store.name || 'Toko'}</Text>
                  <Text style={styles.calloutTeam}>{store.branch || store.address || 'Alamat belum tersedia'}</Text>
                  <Text style={styles.calloutTimeText}>Koordinat lokal tersimpan</Text>
                </View>
            </Callout>
          </Marker>
          ))}
        </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
        <ChevronLeft size={18} color="#0F766E" />
        <Text style={styles.backBtnText}>Kembali</Text>
      </TouchableOpacity>

      <View style={styles.overlayHeader}>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Online</Text>
          </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Offline</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#0E7490' }]} />
              <Text style={styles.legendText}>Cabang</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>Toko</Text>
            </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onManualRefresh} disabled={refreshing}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#0F766E" />
          ) : (
            <RefreshCw size={20} color="#0F766E" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.overlayBottom}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.userScroll}>
          {locations.map((item) => (
            <TouchableOpacity
              key={item.user_id}
              style={styles.userCard}
              onPress={() => {
                if (item.location) {
                  const target = {
                    latitude: item.location.latitude,
                    longitude: item.location.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  };
                  mapRef.current?.animateToRegion(target, 1000);
                }
              }}
            >
              <View style={[styles.statusIndicator, { backgroundColor: item.is_online ? '#10B981' : '#EF4444' }]} />
              <Text style={styles.userCardName} numberOfLines={1}>{item.name}</Text>
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
    alignItems: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E293B',
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
  callout: {
    width: 160,
    padding: 8,
  },
  calloutName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  calloutTeam: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  calloutTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  calloutTimeText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  calloutLink: {
    fontSize: 11,
    color: '#0F766E',
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'right',
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
