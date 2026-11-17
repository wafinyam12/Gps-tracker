import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { Crosshair, RefreshCw } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { storeService } from '../api/services/storeService';
import AppScreen from '../components/ui/AppScreen';
import VisitHeader from '../components/visit/VisitHeader';
import VisitStatusBadge from '../components/visit/VisitStatusBadge';
import { visitColors, visitRadii, visitSpacing, visitType } from '../styles/visitTheme';
import OpenStreetMapView from '../components/maps/OpenStreetMapView';
import { logEvent } from '../utils/diagnosticLogger';
import { confirmLocationDisclosure } from '../utils/locationDisclosure';
import { getLocationPresentation } from '../utils/visitLocationPresentation';
import { useAuth } from '../context/AuthContext';

const toRegion = (location) => ({
  latitude: location.coords.latitude,
  longitude: location.coords.longitude,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
});

const normalizeViewport = (viewport) => {
  const south = Number(viewport?.south);
  const north = Number(viewport?.north);
  const west = Number(viewport?.west);
  const east = Number(viewport?.east);
  const zoom = Math.round(Number(viewport?.zoom));

  if (![south, north, west, east, zoom].every(Number.isFinite)
    || south >= north || west >= east) {
    return null;
  }

  return { south, north, west, east, zoom };
};

const VIEWPORT_DEBOUNCE_MS = 450;

const MyLocationScreen = () => {
  const navigation = useNavigation();
  const { backgroundTrackingEnabled, locationConsentGranted } = useAuth();
  const subscriptionRef = useRef(null);
  const mountedRef = useRef(true);
  const locationRef = useRef(null);
  const locationConsentRef = useRef(false);
  const refreshingRef = useRef(false);
  const viewportRef = useRef(null);
  const viewportTimerRef = useRef(null);
  const markerRequestSequenceRef = useRef(0);
  const [location, setLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(15);
  const [viewportKey, setViewportKey] = useState(0);
  const [storeMarkers, setStoreMarkers] = useState([]);
  const [visibleStoreCount, setVisibleStoreCount] = useState(0);
  const [storeCandidateLimitReached, setStoreCandidateLimitReached] = useState(false);
  const [storeMarkersLoading, setStoreMarkersLoading] = useState(false);
  const [storeMarkersError, setStoreMarkersError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshingLocation, setRefreshingLocation] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const centerToLocation = (nextLocation = locationRef.current) => {
    if (!nextLocation?.coords) {
      setErrorMsg('Lokasi belum tersedia. Tekan refresh untuk mencoba lagi.');
      return;
    }

    setMapCenter(toRegion(nextLocation));
    setMapZoom(15);
    setViewportKey((current) => current + 1);
  };

  const ensureLocationAccess = async () => {
    if (!locationConsentRef.current) {
      const disclosed = await confirmLocationDisclosure({
        title: 'Gunakan lokasi saat ini',
        message: 'Lokasi perangkat digunakan untuk menampilkan posisi Anda dan area peta. Permintaan peta ke penyedia tile dapat menunjukkan area yang sedang dilihat. Lokasi tidak dikirim untuk pelacakan berkala dari layar ini.',
      });
      if (!disclosed) {
        return 'declined';
      }
      locationConsentRef.current = true;
    }

    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      permission = await Location.requestForegroundPermissionsAsync();
    }

    return permission.status === 'granted' ? 'granted' : 'denied';
  };

  const loadStoreMarkers = useCallback(async (viewport) => {
    const requestSequence = markerRequestSequenceRef.current + 1;
    markerRequestSequenceRef.current = requestSequence;
    setStoreMarkersLoading(true);
    setStoreMarkersError(false);

    try {
      const response = await storeService.getMapMarkers({ ...viewport, limit: 100 });
      if (requestSequence !== markerRequestSequenceRef.current) {
        return;
      }

      const payload = response.data?.data || {};
      const markers = Array.isArray(payload.items)
        ? payload.items
          .filter((item) => item?.latitude != null && item?.longitude != null)
          .map((item) => ({
            ...item,
            latitude: Number(item.latitude),
            longitude: Number(item.longitude),
            color: item.kind === 'customer_cluster' ? undefined : '#16A34A',
          }))
          .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
        : [];

      setStoreMarkers(markers);
      setVisibleStoreCount(Number(payload.meta?.visible_stores) || 0);
      setStoreCandidateLimitReached(Boolean(payload.meta?.candidate_limit_reached));
    } catch (error) {
      if (requestSequence === markerRequestSequenceRef.current) {
        logEvent('location.store_markers_fetch_failed', { status: error.response?.status, error_code: error.code });
        setStoreMarkersError(true);
      }
    } finally {
      if (requestSequence === markerRequestSequenceRef.current) {
        setStoreMarkersLoading(false);
      }
    }
  }, []);

  const scheduleStoreMarkers = useCallback((nextViewport) => {
    const viewport = normalizeViewport(nextViewport);
    if (!viewport) {
      return;
    }

    viewportRef.current = viewport;
    markerRequestSequenceRef.current += 1;
    if (viewportTimerRef.current) {
      clearTimeout(viewportTimerRef.current);
    }

    setStoreMarkersLoading(true);
    viewportTimerRef.current = setTimeout(() => {
      loadStoreMarkers(viewport);
    }, VIEWPORT_DEBOUNCE_MS);
  }, [loadStoreMarkers]);

  const handleViewportChange = useCallback((viewport) => {
    if (!location) {
      return;
    }

    const normalized = normalizeViewport(viewport);
    if (!normalized) {
      return;
    }

    setMapZoom(normalized.zoom);
    scheduleStoreMarkers(normalized);
  }, [location, scheduleStoreMarkers]);

  const handleMarkerPress = useCallback((marker) => {
    if (marker?.kind === 'customer_cluster') {
      const currentZoom = viewportRef.current?.zoom || mapZoom;
      setMapCenter({ latitude: marker.latitude, longitude: marker.longitude });
      setMapZoom(Math.min(currentZoom + 2, 19));
      setViewportKey((current) => current + 1);
      return;
    }

    if (marker?.kind !== 'store' && marker?.kind !== 'customer_store') {
      return;
    }

    const destination = encodeURIComponent(`${marker.latitude},${marker.longitude}`);
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    Linking.openURL(directionsUrl).catch(() => {
      logEvent('location.directions_open_failed', { error_code: 'open_url_failed' });
      Alert.alert('Petunjuk arah tidak tersedia', 'Aplikasi peta tidak dapat dibuka.');
    });
  }, [mapZoom]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current);
      }
      markerRequestSequenceRef.current += 1;
    };
  }, []);

  const refreshLocation = async () => {
    if (refreshingRef.current) {
      return;
    }

    refreshingRef.current = true;
    setRefreshingLocation(true);
    try {
      setErrorMsg(null);
      const access = await ensureLocationAccess();
      if (access !== 'granted') {
        if (mountedRef.current) {
          setErrorMsg(access === 'declined'
            ? 'Lokasi belum diizinkan untuk ditampilkan di peta.'
            : 'Izin lokasi diperlukan untuk menampilkan posisi Anda.');
        }
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (!mountedRef.current) {
        return;
      }

      locationRef.current = current;
      setLocation(current);
      centerToLocation(current);
    } catch (error) {
      if (mountedRef.current) {
        logEvent('location.current_position_failed', { error_code: error?.code });
        setErrorMsg('Gagal mengambil lokasi terbaru. Periksa izin dan GPS perangkat.');
      }
    } finally {
      refreshingRef.current = false;
      if (mountedRef.current) {
        setRefreshingLocation(false);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      const access = await ensureLocationAccess();
      if (!mountedRef.current) {
        return;
      }
      if (access !== 'granted') {
        if (mounted) {
          setErrorMsg(access === 'declined'
            ? 'Lokasi belum diizinkan untuk ditampilkan di peta.'
            : 'Izin lokasi diperlukan untuk menampilkan posisi Anda.');
          setLoading(false);
        }
        return;
      }

      await refreshLocation();

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (nextLocation) => {
          const shouldCenter = !locationRef.current;
          locationRef.current = nextLocation;
          setLocation(nextLocation);
          setErrorMsg(null);
          if (shouldCenter) {
            centerToLocation(nextLocation);
          }
        }
      );
      if (mountedRef.current) {
        subscriptionRef.current = subscription;
      } else {
        subscription.remove();
      }
    };

    start().catch((error) => {
      if (mountedRef.current) {
        logEvent('location.start_failed', { error_code: error?.code });
        setErrorMsg('Lokasi belum dapat dimuat. Periksa izin dan GPS perangkat.');
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []);

  const mapMarkers = useMemo(() => {
    const points = [];

    if (location?.coords) {
      points.push({
        id: 'current-location',
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        title: 'Lokasi Saya',
        description: `Akurasi ${Math.round(location.coords.accuracy || 0)} m`,
        color: visitColors.primary,
      });
    }

    points.push(...storeMarkers);

    return points;
  }, [location, storeMarkers]);
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

  const locationPresentation = getLocationPresentation({ location, loading, errorMsg });

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      <VisitHeader title="Lokasi saya" subtitle="Posisi saat ini dan toko di peta" onBack={() => navigation.goBack()} />
      <View style={styles.container}>
        {location?.coords ? (
          <OpenStreetMapView
            style={styles.map}
            center={mapCenter || toRegion(location)}
            markers={mapMarkers}
            circles={accuracyCircles}
            zoom={mapZoom}
            viewportKey={viewportKey}
            onMarkerPress={handleMarkerPress}
            onViewportChange={handleViewportChange}
          />
        ) : <View style={styles.mapPlaceholder} />}

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <VisitStatusBadge label={locationPresentation.statusLabel} tone={locationPresentation.tone} />
              <Text style={styles.badgeMeta}>{visibleStoreCount}{storeCandidateLimitReached ? '+' : ''} toko di peta</Text>
            </View>

            {loading ? (
              <View style={styles.row}>
                <ActivityIndicator size="small" color={visitColors.primary} />
                <Text style={styles.statusText}>Mencari posisi perangkat...</Text>
              </View>
            ) : errorMsg || !location?.coords ? (
              <Text style={styles.errorText}>{errorMsg || 'Lokasi belum tersedia. Tekan Perbarui GPS untuk mencoba lagi.'}</Text>
            ) : (
              <>
                <Text style={styles.coordinateText}>
                  {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
                </Text>
                <Text style={styles.statusText}>{locationPresentation.accuracyLabel} Â· {locationPresentation.updatedLabel}</Text>
                <Text style={styles.statusText}>
                  Pelacakan latar: {backgroundTrackingEnabled && locationConsentGranted ? 'aktif' : 'tidak aktif'}
                </Text>
                {storeMarkersLoading ? (
                  <Text style={styles.statusText}>Memuat toko di area peta...</Text>
                ) : storeMarkersError ? (
                  <Text style={styles.errorText}>Toko di peta belum dapat dimuat. Periksa koneksi.</Text>
                ) : (
                  <Text style={styles.statusText}>
                    {storeCandidateLimitReached
                      ? 'Area padat. Perbesar peta untuk melihat lebih banyak toko.'
                      : visibleStoreCount > 0
                        ? `${visibleStoreCount} toko berkoordinat di area peta`
                        : 'Belum ada toko berkoordinat di area peta'}
                  </Text>
                )}
              </>
            )}
          </View>

          <View style={styles.controls}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Pusatkan peta ke lokasi saya"
              style={[styles.controlBtn, !location && styles.controlBtnDisabled]}
              onPress={() => centerToLocation()}
              disabled={!location}
              activeOpacity={0.9}
            >
              <Crosshair size={20} color={visitColors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Perbarui lokasi GPS"
              style={[styles.controlBtn, (refreshingLocation || (loading && !location)) && styles.controlBtnDisabled]}
              onPress={refreshLocation}
              disabled={refreshingLocation || (loading && !location)}
              activeOpacity={0.9}
            >
              {refreshingLocation ? <ActivityIndicator size="small" color={visitColors.primary} /> : <RefreshCw size={20} color={visitColors.primary} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas },
  screenContent: { paddingTop: 0, paddingBottom: 0 },
  container: { flex: 1 },
  map: { flex: 1 },
  mapPlaceholder: { flex: 1, backgroundColor: visitColors.primaryTint },
  overlay: { position: 'absolute', left: visitSpacing.page, right: visitSpacing.page, top: visitSpacing.page, gap: visitSpacing.sm, zIndex: 2, elevation: 2 },
  statusCard: { backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, padding: visitSpacing.card, gap: visitSpacing.sm },
  statusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: visitSpacing.sm },
  badgeMeta: { ...visitType.caption, color: visitColors.mutedInk, flexShrink: 1, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm },
  coordinateText: { ...visitType.section, color: visitColors.ink, fontFamily: 'monospace' },
  statusText: { ...visitType.caption, color: visitColors.mutedInk },
  errorText: { ...visitType.body, color: visitColors.danger },
  controls: { flexDirection: 'row', gap: visitSpacing.sm, zIndex: 3, elevation: 3 },
  controlBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border },
  controlBtnDisabled: { opacity: 0.5 },
});

export default MyLocationScreen;
