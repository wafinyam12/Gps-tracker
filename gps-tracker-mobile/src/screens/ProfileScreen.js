import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { User, LogOut } from 'lucide-react-native';

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    Alert.alert('Keluar', 'Anda yakin ingin logout?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: async () => {
        await logout();
      } },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <User size={48} color="#1E293B" />
        <Text style={styles.name}>{user?.name || 'Sales'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  header: { alignItems: 'center', marginTop: 60, marginBottom: 30 },
  name: { marginTop: 12, fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  email: { marginTop: 6, fontSize: 14, color: '#64748b' },
  actions: { paddingTop: 20 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ef4444', padding: 12, borderRadius: 10, justifyContent: 'center' },
  logoutText: { color: '#fff', marginLeft: 8, fontWeight: 'bold' },
});

export default ProfileScreen;
