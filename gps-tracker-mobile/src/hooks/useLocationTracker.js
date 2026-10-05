import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { canTrackLocation } from '../utils/roles';
import { logEvent } from '../utils/diagnosticLogger';

const normalizeBearing = (heading) => (
  typeof heading === 'number' && heading >= 0 && heading <= 360 ? heading : null
);

export const useLocationTracker = () => {
  const { user, locationConsentGranted } = useAuth();
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const subscriptionRef = useRef(null);

  const canTrack = canTrackLocation(user);

  const stopTracking = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const pingLocation = useCallback(async (loc) => {
    if (!canTrack || !locationConsentGranted) {
      return;
    }

    try {
      await apiClient.post('/location/ping', {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        bearing: normalizeBearing(loc.coords.heading),
        recorded_at: new Date(loc.timestamp).toISOString(),
        is_mock_location: loc.mocked || false,
      });
    } catch (e) {
      logEvent('tracking.foreground_ping_failed', { status: e.response?.status, error_code: e.code });
    }
  }, [canTrack, locationConsentGranted]);

  const startTracking = useCallback(async () => {
    if (!canTrack || !locationConsentGranted) {
      stopTracking();
      return null;
    }

    const consent = await SecureStore.getItemAsync(`background_location_consent_${user?.id}`);
    if (consent !== 'accepted') {
      return null;
    }

    if (subscriptionRef.current) {
      return subscriptionRef.current;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('Izin lokasi ditolak.');
      setIsTracking(false);
      return null;
    }

    setErrorMsg(null);
    setIsTracking(true);

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000,
        distanceInterval: 10,
      },
      (newLocation) => {
        setLocation(newLocation);
        pingLocation(newLocation);
      }
    );

    subscriptionRef.current = subscription;
    return subscription;
  }, [canTrack, locationConsentGranted, pingLocation, stopTracking, user?.id]);

  useEffect(() => {
    if (!canTrack || !locationConsentGranted) {
      stopTracking();
    }
  }, [canTrack, locationConsentGranted, stopTracking]);

  useEffect(() => stopTracking, [stopTracking]);

  return { location, errorMsg, isTracking, startTracking, stopTracking };
};
