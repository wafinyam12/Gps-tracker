import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Circle, Marker } from 'react-native-maps';
import { Crosshair, RefreshCw } from 'lucide-react-native';
import { storeService } from '../api/services/storeService';

const DEFAULT_REGION = {
  latitude: -6.2,
  longitude: 106.816666,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const toRegion = (location) => ({
  latitude: location.coords.latitude,
  longitude: location.coords.longitude,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
});

const normalizeStore = (store) => ({
  id: store.id,
  code: store.code,
  name: store.name,
  address: store.address,
  branch: store.branch,
  latitude: Number(store.latitude),
  longitude: Number(store.longitude),
});

const MyLocationScreen = () => {
  const mapRef = useRef(null);
  const subscriptionRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [storePoints, setStorePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const centerToLocation = (nextLocation = location) => {
    if (!nextLocation) {
      return;
    }

    mapRef.current?.animateToRegion(toRegion(nextLocation), 600);
  };

  const loadStorePoints = async () => {
    try {
      const response = await storeService.getAvailableStores();
      const payload = response.data?.data || response.data || [];
      const stores = Array.isArray(payload)
        ? payload.map(normalizeStore).filter((store) => Number.isFinite(store.latitude) && Number.isFinite(store.longitude))
        : [];
      setStorePoints(stores);
    } catch (error) {
      console.log('Load store points error:', error.response?.data || error);
      setStorePoints([]);
    }
  };

  const refreshLocation = async () => {
    try {
      setErrorMsg(null);
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(current);
      centerToLocation(current);
      await loadStorePoints();
    } catch (error) {
      setErrorMsg('Gagal mengambil lokasi terbaru.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (mounted) {
          setErrorMsg('Izin lokasi diperlukan untuk menampilkan posisi Anda.');
          setLoading(false);
        }
        return;
      }

      await refreshLocation();

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (nextLocation) => {
          setLocation(nextLocation);
          centerToLocation(nextLocation);
        }
      );
    };

    start();

    return () => {
      mounted = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []);

  const region = location ? toRegion(location) : DEFAULT_REGION;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
      >
        {location && (
          <>
            <Marker
              coordinate={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              title="Lokasi Saya"
              pinColor="#1E40AF"
            />
            {typeof location.coords.accuracy === 'number' && (
              <Circle
                center={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
                radius={location.coords.accuracy}
                strokeColor="rgba(30, 64, 175, 0.35)"
                fillColor="rgba(30, 64, 175, 0.12)"
              />
            )}
          </>
        )}

        {storePoints.map((store) => (
          <Marker
            key={store.code || store.id}
            coordinate={{
              latitude: store.latitude,
              longitude: store.longitude,
            }}
            title={store.name || 'Toko'}
            description={store.branch || store.address || ''}
            pinColor="#16A34A"
          />
        ))}
      </MapView>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Lokasi Saya</Text>
        {loading ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color="#1E40AF" />
            <Text style={styles.statusText}>Mencari GPS...</Text>
          </View>
        ) : errorMsg ? (
          <Text style={styles.errorText}>{errorMsg}</Text>
        ) : (
          <>
            <Text style={styles.coordinateText}>
              {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
            </Text>
            <Text style={styles.statusText}>
              Akurasi {Math.round(location.coords.accuracy || 0)} m
            </Text>
            <Text style={styles.statusText}>
              {storePoints.length > 0 ? `${storePoints.length} toko punya koordinat lokal` : 'Belum ada koordinat toko yang tersimpan'}
            </Text>
          </>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn} onPress={() => centerToLocation()}>
          <Crosshair size={22} color="#1E40AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={refreshLocation}>
          <RefreshCw size={22} color="#1E40AF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  statusCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  statusTitle: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coordinateText: {
    color: '#1E40AF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
  },
  controls: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    gap: 12,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
});

export default MyLocationScreen;
