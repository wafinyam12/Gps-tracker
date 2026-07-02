import React, { useMemo, useState, useEffect } from 'react';
import { Platform, View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { locationService } from '../../api/services/locationService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, MapPin, Clock, Navigation, Calendar } from 'lucide-react-native';

const toRadians = (value) => (value * Math.PI) / 180;

const haversineMeters = (from, to) => {
  if (!from || !to) {
    return 0;
  }

  const earthRadius = 6371000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
};

const SalesDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params || {};

  useEffect(() => {
    if (!userId) {
      Alert.alert('Error', 'User ID tidak ditemukan');
      navigation.goBack();
      return;
    }
  }, [navigation, userId]);

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        return;
      }

      try {
        const [userRes, historyRes] = await Promise.all([
          locationService.getSalesLocation(userId),
          locationService.getLocationHistory(userId),
        ]);

        const userPayload = userRes.data?.data || userRes.data || null;
        const historyPayload = historyRes.data?.data || historyRes.data || {};

        setUserData(userPayload);
        setHistory(Array.isArray(historyPayload.trail) ? historyPayload.trail : []);
      } catch (error) {
        Alert.alert('Error', 'Gagal mengambil data detail sales');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigation, userId]);

  const totalDistanceKm = useMemo(() => {
    if (history.length < 2) {
      return 0;
    }

    let totalMeters = 0;
    for (let index = 1; index < history.length; index += 1) {
      totalMeters += haversineMeters(history[index - 1], history[index]);
    }

    return totalMeters / 1000;
  }, [history]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  const lastLoc = userData?.location;
  const polylineCoords = history
    .filter((h) => Number.isFinite(h.latitude) && Number.isFinite(h.longitude))
    .map((h) => ({
      latitude: h.latitude,
      longitude: h.longitude,
    }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{userData?.name}</Text>
          <Text style={styles.headerSubtitle}>{userData?.branch?.name || userData?.team?.name || 'Tanpa Cabang'}</Text>
        </View>
        <View style={styles.statusDot(userData?.is_online)} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: lastLoc?.latitude || -6.2,
              longitude: lastLoc?.longitude || 106.8,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {lastLoc && (
              <Marker
                coordinate={{
                  latitude: lastLoc.latitude,
                  longitude: lastLoc.longitude,
                }}
                title="Posisi Terakhir"
                pinColor="#0F766E"
              />
            )}
            {polylineCoords.length > 1 && (
              <Polyline
                coordinates={polylineCoords}
                strokeColor="#0F766E"
                strokeWidth={3}
              />
            )}
          </MapView>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Status Hari Ini</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Terakhir Terlihat</Text>
              <Text style={styles.statValue}>{userData?.last_seen_at_human || '-'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Jarak Tempuh</Text>
              <Text style={styles.statValue}>{totalDistanceKm.toFixed(1)} KM</Text>
            </View>
          </View>

          <View style={styles.detailList}>
            <View style={styles.detailItem}>
              <MapPin size={20} color="#64748B" />
              <View>
                <Text style={styles.detailLabel}>Lokasi Terakhir</Text>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {lastLoc ? `${lastLoc.latitude.toFixed(6)}, ${lastLoc.longitude.toFixed(6)}` : 'Tidak diketahui'}
                </Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <Clock size={20} color="#64748B" />
              <View>
                <Text style={styles.detailLabel}>Update GPS Terakhir</Text>
                <Text style={styles.detailValue}>
                  {lastLoc?.recorded_at || userData?.last_seen_at || 'Belum ada data'}
                </Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <Navigation size={20} color="#64748B" />
              <View>
                <Text style={styles.detailLabel}>Kecepatan / Baterai</Text>
                <Text style={styles.detailValue}>
                  {lastLoc?.speed || 0} km/h - {lastLoc?.battery || 0}% Baterai
                </Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => Alert.alert('Info', 'Fitur Riwayat Lengkap tersedia di Dashboard Web')}
        >
          <Calendar size={20} color="#fff" />
          <Text style={styles.historyBtnText}>Lihat Riwayat Perjalanan Penuh</Text>
        </TouchableOpacity>

        <View style={{ height: Platform.OS === 'android' ? 64 : 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  statusDot: (online) => ({
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: online ? '#10B981' : '#EF4444',
    marginLeft: 'auto',
  }),
  content: {
    paddingBottom: Platform.OS === 'android' ? 40 : 16,
  },
  scroll: {
    flex: 1,
  },
  mapContainer: {
    height: 250,
    backgroundColor: '#F1F5F9',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  infoSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F766E',
  },
  detailList: {
    gap: 20,
  },
  detailItem: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  detailValue: {
    fontSize: 14,
    color: '#1E293B',
    marginTop: 2,
  },
  historyBtn: {
    flexDirection: 'row',
    backgroundColor: '#0F766E',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  historyBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default SalesDetailScreen;
