import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { canVisitStores } from './roles';

const LOCATION_TRACKING_TASK = 'background-location-tracking';

const normalizeBearing = (heading) => (
  typeof heading === 'number' && heading >= 0 && heading <= 360 ? heading : null
);

const getStoredUser = async () => {
  const storedUser = await SecureStore.getItemAsync('user_data');
  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch (e) {
    console.log('Failed parsing stored user for background tracking', e.message);
    return null;
  }
};

// 1. Definisikan Task yang akan dijalankan di background
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.log('Background location error:', error.message);
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0];
    if (location) {
      try {
        const user = await getStoredUser();
        if (!canVisitStores(user)) {
          return;
        }

        // Ping ke server
        await apiClient.post('/location/ping', {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          speed: location.coords.speed,
          bearing: normalizeBearing(location.coords.heading),
          recorded_at: new Date(location.timestamp).toISOString(),
          is_mock_location: location.mocked || false,
        });
      } catch (e) {
        console.log('Background ping failed', e.message);
      }
    }
  }
});

// 2. Fungsi untuk menyalakan background tracking
export const startBackgroundTracking = async () => {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus === 'granted') {
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus === 'granted') {
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 300000, // Tiap 5 menit jika background untuk hemat baterai
        distanceInterval: 50,  // Atau tiap 50 meter
        foregroundService: {
          notificationTitle: "GPS Tracker Aktif",
          notificationBody: "Melacak posisi sales untuk jadwal kunjungan",
          notificationColor: "#FF0000",
        },
      });
      console.log('Background tracking started');
    }
  }
};

// 3. Fungsi untuk mematikan
export const stopBackgroundTracking = async () => {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    console.log('Background tracking stopped');
  }
};
