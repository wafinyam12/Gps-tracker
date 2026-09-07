import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import NetInfo from '@react-native-community/netinfo';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { canAccessMonitoring } from './src/utils/roles';
import './src/utils/backgroundTracker';
import './src/utils/offlineSyncTask';
import { offlineQueue } from './src/utils/offlineQueue';
import { registerOfflineSyncTask } from './src/utils/offlineSyncTask';
import { colors } from './src/styles/theme';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import LoadingScreen from './src/screens/LoadingScreen';
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import StartVisitScreen from './src/screens/StartVisitScreen';
import VisitFormScreen from './src/screens/VisitFormScreen';
import VisitPhotoGalleryScreen from './src/screens/VisitPhotoGalleryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MyLocationScreen from './src/screens/MyLocationScreen';

// Admin Screens
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';
import UserListScreen from './src/screens/admin/UserListScreen';
import UserFormScreen from './src/screens/admin/UserFormScreen';
import TeamListScreen from './src/screens/admin/TeamListScreen';
import TeamFormScreen from './src/screens/admin/TeamFormScreen';
import StoreListScreen from './src/screens/admin/StoreListScreen';

// SPV Screens
import LiveMapScreen from './src/screens/spv/LiveMapScreen';
import SalesDetailScreen from './src/screens/spv/SalesDetailScreen';
import TeamSummaryScreen from './src/screens/spv/TeamSummaryScreen';
import AlertListScreen from './src/screens/spv/AlertListScreen';
import MySummaryScreen from './src/screens/MySummaryScreen';

const Stack = createStackNavigator();

const sharedScreenOptions = {
  headerBackTitleVisible: false,
  headerTitleAlign: 'center',
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  headerStyle: {
    backgroundColor: colors.surface,
    shadowColor: 'transparent',
    elevation: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
};


const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
  </Stack.Navigator>
);

const AppStack = () => (
  <Stack.Navigator screenOptions={sharedScreenOptions}>
    <Stack.Screen
      name="Home"
      component={HomeScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="StartVisit"
      component={StartVisitScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="PhotoUpload"
      component={CameraScreen} // Renamed to PhotoUpload for clarity
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="VisitForm"
      component={VisitFormScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="VisitPhotoGallery"
      component={VisitPhotoGalleryScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="LiveMap"
      component={LiveMapScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="SalesDetail"
      component={SalesDetailScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="TeamSummary"
      component={TeamSummaryScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Alerts"
      component={AlertListScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="MySummary"
      component={MySummaryScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="MyLocation"
      component={MyLocationScreen}
      options={{ title: 'Lokasi Saya' }}
    />
    <Stack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ headerShown: false }}
    />
  </Stack.Navigator>
);

const AdminStack = () => (
  <Stack.Navigator screenOptions={sharedScreenOptions}>
    <Stack.Screen
      name="AdminDashboard"
      component={AdminDashboardScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="UserList"
      component={UserListScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="UserForm"
      component={UserFormScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="TeamList"
      component={TeamListScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="TeamForm"
      component={TeamFormScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="StoreList"
      component={StoreListScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="LiveMap"
      component={LiveMapScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="SalesDetail"
      component={SalesDetailScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="TeamSummary"
      component={TeamSummaryScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Alerts"
      component={AlertListScreen}
      options={{ headerShown: false }}
    />
    {/* Admin also needs access to monitoring features */}
    <Stack.Screen
      name="Home"
      component={HomeScreen}
      options={{ title: 'Monitoring Kunjungan' }}
    />
    <Stack.Screen
      name="StartVisit"
      component={StartVisitScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="PhotoUpload"
      component={CameraScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="VisitForm"
      component={VisitFormScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="VisitPhotoGallery"
      component={VisitPhotoGalleryScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="MySummary"
      component={MySummaryScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="MyLocation"
      component={MyLocationScreen}
      options={{ title: 'Lokasi Saya' }}
    />
    <Stack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ headerShown: false }}
    />
  </Stack.Navigator>
);

const RootNavigator = () => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const syncWhenReachable = (state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        offlineQueue.processQueue({ silent: true });
      }
    };

    registerOfflineSyncTask();
    NetInfo.fetch().then(syncWhenReachable).catch(() => {});
    const networkSubscription = NetInfo.addEventListener(syncWhenReachable);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        offlineQueue.processQueue({ silent: true });
      }
    });

    return () => {
      networkSubscription();
      appStateSubscription.remove();
    };
  }, [user?.id]);

  if (loading) {
    return <LoadingScreen />;
  }

  const isAdminOrSpv = canAccessMonitoring(user);

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack />
      ) : isAdminOrSpv ? (
        <AdminStack />
      ) : (
        <AppStack />
      )}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
