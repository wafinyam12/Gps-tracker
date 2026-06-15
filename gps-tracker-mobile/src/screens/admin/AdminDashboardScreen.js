import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Users, UsersRound, LogOut, ChevronRight, BarChart3, MapPin } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { canVisitStores, getRoleName } from '../../utils/roles';

const AdminDashboardScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const roleName = getRoleName(user) || 'admin';
  const isAdmin = roleName === 'admin';
  const canVisit = canVisitStores(user);

  const menuItems = [
    ...(canVisit ? [
      {
        title: 'Kunjungan Saya',
        subtitle: 'Jadwal, check-in, dan lokasi pribadi',
        icon: <MapPin size={24} color="#1E40AF" />,
        screen: 'Home',
      },
    ] : []),
    ...(isAdmin ? [
      {
        title: 'Manajemen User',
        subtitle: 'Kelola data sales, supervisor, dan admin',
        icon: <Users size={24} color="#1E40AF" />,
        screen: 'UserList',
      },
      {
        title: 'Manajemen Team',
        subtitle: 'Atur unit bisnis dan area kerja',
        icon: <UsersRound size={24} color="#1E40AF" />,
        screen: 'TeamList',
      },
    ] : []),
    {
      title: 'Monitoring Kunjungan',
      subtitle: 'Pantau posisi sales real-time',
      icon: <MapPin size={24} color="#1E40AF" />,
      screen: 'LiveMap',
    },
    {
      title: 'Ringkasan & Anomali',
      subtitle: 'Lihat progres tim dan peringatan',
      icon: <BarChart3 size={24} color="#1E40AF" />,
      screen: 'TeamSummary',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Selamat Datang,</Text>
          <Text style={styles.userName}>{user?.name || 'Admin'}</Text>
          <Text style={styles.userRole}>{roleName.toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <LogOut size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Dashboard Menu</Text>

        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuCard}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={styles.iconContainer}>{item.icon}</View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <ChevronRight size={20} color="#94A3B8" />
          </TouchableOpacity>
        ))}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Team</Text>
            <Text style={styles.statValue}>-</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>User Aktif</Text>
            <Text style={styles.statValue}>-</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#1E40AF',
    padding: 24,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  welcomeText: {
    color: '#BFDBFE',
    fontSize: 14,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userRole: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  logoutBtn: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 12,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    marginRight: 16,
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginTop: 4,
  },
});

export default AdminDashboardScreen;
