import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { getRoleName } from './src/utils/roles';
import './src/utils/backgroundTracker';

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


const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
  </Stack.Navigator>
);

const AppStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Home"
      component={HomeScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="StartVisit"
      component={StartVisitScreen}
      options={{ title: 'Tambah Kunjungan' }}
    />
    <Stack.Screen
      name="PhotoUpload"
      component={CameraScreen} // Renamed to PhotoUpload for clarity
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="VisitForm"
      component={VisitFormScreen}
      options={{ title: 'Data Kunjungan' }}
    />
    <Stack.Screen
      name="VisitPhotoGallery"
      component={VisitPhotoGalleryScreen}
      options={{ title: 'Galeri Foto Kunjungan' }}
    />
    <Stack.Screen
      name="LiveMap"
      component={LiveMapScreen}
      options={{ title: 'Live Monitoring' }}
    />
    <Stack.Screen
      name="SalesDetail"
      component={SalesDetailScreen}
      options={{ title: 'Detail Sales' }}
    />
    <Stack.Screen
      name="TeamSummary"
      component={TeamSummaryScreen}
      options={{ title: 'Ringkasan Tim' }}
    />
    <Stack.Screen
      name="Alerts"
      component={AlertListScreen}
      options={{ title: 'Anomali Kunjungan' }}
    />
    <Stack.Screen
      name="MySummary"
      component={MySummaryScreen}
      options={{ title: 'Ringkasan Saya' }}
    />
    <Stack.Screen
      name="MyLocation"
      component={MyLocationScreen}
      options={{ title: 'Lokasi Saya' }}
    />
    <Stack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ title: 'Profil' }}
    />
  </Stack.Navigator>
);

const AdminStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="AdminDashboard"
      component={AdminDashboardScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="UserList"
      component={UserListScreen}
      options={{ title: 'Manajemen User' }}
    />
    <Stack.Screen
      name="UserForm"
      component={UserFormScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="TeamList"
      component={TeamListScreen}
      options={{ title: 'Manajemen Team' }}
    />
    <Stack.Screen
      name="TeamForm"
      component={TeamFormScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="StoreList"
      component={StoreListScreen}
      options={{ title: 'Manajemen Toko' }}
    />
    <Stack.Screen
      name="LiveMap"
      component={LiveMapScreen}
      options={{ title: 'Live Monitoring' }}
    />
    <Stack.Screen
      name="SalesDetail"
      component={SalesDetailScreen}
      options={{ title: 'Detail Sales' }}
    />
    <Stack.Screen
      name="TeamSummary"
      component={TeamSummaryScreen}
      options={{ title: 'Ringkasan Tim' }}
    />
    <Stack.Screen
      name="Alerts"
      component={AlertListScreen}
      options={{ title: 'Anomali Kunjungan' }}
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
      options={{ title: 'Tambah Kunjungan' }}
    />
    <Stack.Screen
      name="PhotoUpload"
      component={CameraScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="VisitForm"
      component={VisitFormScreen}
      options={{ title: 'Data Kunjungan' }}
    />
    <Stack.Screen
      name="VisitPhotoGallery"
      component={VisitPhotoGalleryScreen}
      options={{ title: 'Galeri Foto Kunjungan' }}
    />
    <Stack.Screen
      name="MySummary"
      component={MySummaryScreen}
      options={{ title: 'Ringkasan Saya' }}
    />
    <Stack.Screen
      name="MyLocation"
      component={MyLocationScreen}
      options={{ title: 'Lokasi Saya' }}
    />
    <Stack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ title: 'Profil' }}
    />
  </Stack.Navigator>
);

const RootNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // Cek role untuk menentukan stack yang ditampilkan
  const roleName = getRoleName(user);
  const isAdminOrSpv = ['admin', 'spv'].includes(roleName);

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
