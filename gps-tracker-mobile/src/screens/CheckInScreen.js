import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { visitService } from '../api/services/visitService';
import { offlineQueue } from '../utils/offlineQueue';
import { MapPin, Check } from 'lucide-react-native';

const CheckInScreen = ({ route, navigation }) => {
  const { schedule } = route.params || {};

  if (!schedule) {
    // If screen opened without schedule, show a message and go back.
    setTimeout(() => {
      Alert.alert('Error', 'Data jadwal tidak ditemukan.');
      navigation.goBack();
    }, 50);
    return null;
  }
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Izin lokasi diperlukan untuk check-in');
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation(location);
    } catch (error) {
      Alert.alert('Error', 'Gagal mendapatkan lokasi saat ini');
    }
  };

  const handleCheckIn = async () => {
    if (!currentLocation) {
      Alert.alert('Tunggu', 'Sedang mengambil lokasi terbaru...');
      return;
    }

    setLoading(true);
    try {
      const response = await visitService.checkIn(
        schedule.id,
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        {
          accuracy: currentLocation.coords.accuracy,
          isMockLocation: currentLocation.mocked || false,
        }
      );

      if (response.success) {
        Alert.alert(
          'Berhasil',
          response.message,
          [
            {
              text: 'Isi Data Kunjungan',
              onPress: () => {
                navigation.replace('VisitForm', {
                  schedule: {
                    ...schedule,
                    status: 'in_progress',
                    visit_log: {
                      id: response.data.visit_log_id,
                      checkin_at: new Date().toISOString(),
                    },
                  },
                  visitLogId: response.data.visit_log_id,
                  latitude: currentLocation.coords.latitude,
                  longitude: currentLocation.coords.longitude
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Gagal', response.message);
      }
    } catch (error) {
      if (!error.response) {
        // Assume network error if no response
        await offlineQueue.addItem('/visit/checkin', 'post', {
          visit_schedule_id: schedule.id,
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          accuracy: currentLocation.coords.accuracy,
          is_mock_location: currentLocation.mocked || false,
        });
      } else {
        Alert.alert('Error', error.response?.data?.message || 'Terjadi kesalahan sistem');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.storeCard}>
        <Text style={styles.storeLabel}>Target Kunjungan:</Text>
        <Text style={styles.storeName}>{schedule.store.name}</Text>
        <Text style={styles.storeAddress}>{schedule.store.address}</Text>
      </View>

      <View style={styles.locationCard}>
        <MapPin size={24} color="#1E40AF" />
        <View style={{ flex: 1 }}>
          <Text style={styles.locationTitle}>Lokasi Anda Sekarang</Text>
          {currentLocation ? (
            <Text style={styles.coordinates}>
              {currentLocation.coords.latitude.toFixed(6)}, {currentLocation.coords.longitude.toFixed(6)}
            </Text>
          ) : (
            <Text style={styles.loadingLocation}>Mencari sinyal GPS...</Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.mainBtn, loading && styles.btnDisabled]}
          onPress={handleCheckIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Check size={20} color="#fff" />
              <Text style={styles.btnText}>Konfirmasi Check-in</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.secondaryBtnText}>Batal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  storeCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  storeLabel: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
  },
  storeName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  storeAddress: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    lineHeight: 20,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 20,
    borderRadius: 16,
    gap: 15,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 4,
  },
  coordinates: {
    fontSize: 15,
    color: '#2563EB',
    fontFamily: 'monospace',
  },
  loadingLocation: {
    fontSize: 14,
    color: '#60A5FA',
    fontStyle: 'italic',
  },
  actions: {
    marginTop: 'auto',
    gap: 12,
    paddingBottom: 20,
  },
  mainBtn: {
    backgroundColor: '#1E40AF',
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  secondaryBtn: {
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  }
});

export default CheckInScreen;
