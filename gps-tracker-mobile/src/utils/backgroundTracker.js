import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { canTrackLocation } from './roles';
import { offlineQueue } from './offlineQueue';
import { visitSampleQueue } from './visitSampleQueue';
import { visitTrackingOptions } from './visitSampleQueueCore';
import { logEvent } from './diagnosticLogger';

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
    logEvent('tracking.stored_user_parse_failed', { error_code: e?.code });
    return null;
  }
};

// 1. Definisikan Task yang akan dijalankan di background
if (typeof TaskManager.isTaskDefined !== 'function' || !TaskManager.isTaskDefined(LOCATION_TRACKING_TASK)) {
  TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
    if (error) {
      logEvent('tracking.background_task_failed', { error_code: error?.code });
      return;
    }
    if (data) {
      const { locations } = data;
      const location = locations?.[locations.length - 1];
      if (location) {
        try {
          const user = await getStoredUser();
          if (!canTrackLocation(user)) {
            return;
          }
          const consent = await SecureStore.getItemAsync(`background_location_consent_${user.id}`);
          if (consent !== 'accepted') {
            await stopBackgroundTracking();
            return;
          }

          for (const sampleLocation of locations) {
            try {
              await visitSampleQueue.capture(String(user.id), sampleLocation);
            } catch (storageError) {
              logEvent('tracking.visit_sample_save_failed', { error_code: storageError?.code });
            }
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
          logEvent('tracking.background_ping_failed', { status: e.response?.status, error_code: e.code });
        }
        try {
          const user = await getStoredUser();
          if (canTrackLocation(user)) {
            await offlineQueue.processQueue({ silent: true });
            await visitSampleQueue.flush(String(user.id));
          }
        } catch (syncError) {
          logEvent('tracking.visit_sample_sync_failed', { status: syncError?.response?.status, error_code: syncError?.code });
        }
      }
    }
  });
}

// 2. Fungsi untuk menyalakan background tracking
export const startBackgroundTracking = async () => {
  try {
    const user = await getStoredUser();
    if (!canTrackLocation(user)) return false;
    const consent = await SecureStore.getItemAsync(`background_location_consent_${user.id}`);
    if (consent !== 'accepted') return false;
    const activeVisit = await visitSampleQueue.activeVisit(String(user.id));
    const mode = activeVisit ? 'visit' : 'general';
    const modeKey = `location_tracking_mode_${user.id}`;
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    if (started && await SecureStore.getItemAsync(modeKey) === mode) {
      return true;
    }
    if (started) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    }

    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      logEvent('tracking.permission_denied', { permission: 'foreground', result: foregroundStatus });
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      logEvent('tracking.permission_denied', { permission: 'background', result: backgroundStatus });
      return false;
    }

    const cadence = visitTrackingOptions(Boolean(activeVisit));
    await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
      accuracy: cadence.accuracy === 'high' ? Location.Accuracy.High : Location.Accuracy.Balanced,
      timeInterval: cadence.timeInterval,
      distanceInterval: cadence.distanceInterval,
      foregroundService: {
        notificationTitle: "GPS Tracker Aktif",
        notificationBody: "Melacak posisi untuk visit harian",
        notificationColor: "#456F68",
      },
    });
    await SecureStore.setItemAsync(modeKey, mode);
    logEvent('tracking.started');

    return true;
  } catch (e) {
    logEvent('tracking.start_failed', { error_code: e?.code });
    return false;
  }
};

// 3. Fungsi untuk mematikan
export const stopBackgroundTracking = async () => {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      logEvent('tracking.stopped');
    }
    return true;
  } catch (e) {
    logEvent('tracking.stop_failed', { error_code: e?.code });
    return false;
  }
};

export const isBackgroundTrackingActive = () => Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
