import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { canVisitStores } from '../utils/roles';

const normalizeBearing = (heading) => (
  typeof heading === 'number' && heading >= 0 && heading <= 360 ? heading : null
);

export const useLocationTracker = () => {
  const { user } = useAuth();
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const subscriptionRef = useRef(null);

  const canTrack = canVisitStores(user);

  const stopTracking = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const pingLocation = useCallback(async (loc) => {
    if (!canTrack) {
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
      console.log('Failed to ping location', e.response?.status, e.response?.data || e.message);
    }
  }, [canTrack]);

  const startTracking = useCallback(async () => {
    if (!canTrack) {
      stopTracking();
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
  }, [canTrack, pingLocation, stopTracking]);

  useEffect(() => {
    if (!canTrack) {
      stopTracking();
    }
  }, [canTrack, stopTracking]);

  useEffect(() => stopTracking, [stopTracking]);

  return { location, errorMsg, isTracking, startTracking, stopTracking };
};
