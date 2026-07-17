import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { Crosshair, RefreshCw, MapPin } from 'lucide-react-native';
import { storeService } from '../api/services/storeService';
import AppScreen from '../components/ui/AppScreen';
import Surface from '../components/ui/Surface';
import { colors, radii, shadows, spacing } from '../styles/theme';
import OpenStreetMapView from '../components/maps/OpenStreetMapView';

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
  const subscriptionRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_REGION);
  const [storePoints, setStorePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const centerToLocation = (nextLocation = location) => {
    if (!nextLocation) {
      return;
    }

    setMapCenter(toRegion(nextLocation));
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
  const mapMarkers = useMemo(() => {
    const points = [];

    if (location?.coords) {
      points.push({
        id: 'current-location',
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        title: 'Lokasi Saya',
        description: `Akurasi ${Math.round(location.coords.accuracy || 0)} m`,
        color: colors.primary,
      });
    }

    storePoints.forEach((store) => {
      points.push({
        id: `store-${store.id || store.code}`,
        latitude: store.latitude,
        longitude: store.longitude,
        title: store.name || 'Toko',
        description: store.branch || store.address || '',
        color: '#16A34A',
      });
    });

    return points;
  }, [location, storePoints]);
  const accuracyCircles = useMemo(() => {
    if (!location?.coords || typeof location.coords.accuracy !== 'number') {
      return [];
    }

    return [{
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      radius: location.coords.accuracy,
      strokeColor: 'rgba(30, 64, 175, 0.35)',
      fillColor: 'rgba(30, 64, 175, 0.12)',
    }];
  }, [location]);

  return (
    <AppScreen>
      <View style={styles.container}>
        <OpenStreetMapView
          style={styles.map}
          center={mapCenter || region}
          markers={mapMarkers}
          circles={accuracyCircles}
          zoom={15}
        />

        <View style={styles.overlay}>
          <Surface style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.badge}>
                <MapPin size={14} color={colors.primary} />
                <Text style={styles.badgeText}>Lokasi Saya</Text>
              </View>
              <Text style={styles.badgeMeta}>{storePoints.length} titik toko</Text>
            </View>

            {loading ? (
              <View style={styles.row}>
                <ActivityIndicator size="small" color={colors.primary} />
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
          </Surface>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlBtn} onPress={() => centerToLocation()} activeOpacity={0.9}>
              <Crosshair size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn} onPress={refreshLocation} activeOpacity={0.9}>
              <RefreshCw size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    gap: 12,
  },
  statusCard: {
    gap: 10,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  badgeMeta: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coordinateText: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  statusText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '700',
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
});

export default MyLocationScreen;
