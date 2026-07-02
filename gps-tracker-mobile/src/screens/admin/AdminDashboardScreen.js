import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  BarChart3,
  ChevronRight,
  LogOut,
  MapPin,
  Store,
  UserCircle,
  Users,
  UsersRound,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { canVisitStores, getRoleDisplayName, getRoleName } from '../../utils/roles';
import AppScreen from '../../components/ui/AppScreen';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import { colors, radii, shadows, spacing } from '../../styles/theme';

const AdminDashboardScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const roleName = getRoleName(user) || 'admin';
  const canManageUsersAndBranches = ['admin', 'superadmin'].includes(roleName);
  const canManageStores = roleName === 'superadmin';
  const canVisit = canVisitStores(user);

  const menuItems = useMemo(() => ([
    ...(canVisit ? [{
      title: 'Kunjungan Saya',
      subtitle: 'Mulai visit, ringkasan, dan lokasi pribadi',
      icon: <MapPin size={24} color={colors.primary} />,
      screen: 'Home',
    }] : []),
    ...(canManageUsersAndBranches ? [
      {
        title: 'Manajemen User',
        subtitle: 'Kelola data area manager, sales, dan admin cabang',
        icon: <Users size={24} color={colors.primary} />,
        screen: 'UserList',
      },
      {
        title: 'Manajemen Cabang',
        subtitle: 'Atur unit bisnis, area kerja, dan lokasi cabang',
        icon: <UsersRound size={24} color={colors.primary} />,
        screen: 'TeamList',
      },
    ] : []),
    ...(canManageStores ? [
      {
        title: 'Manajemen Toko',
        subtitle: 'Master toko read-only dari SAP',
        icon: <Store size={24} color={colors.primary} />,
        screen: 'StoreList',
      },
    ] : []),
    {
      title: 'Monitoring Kunjungan',
      subtitle: 'Pantau posisi sales dan cabang real-time',
      icon: <MapPin size={24} color={colors.primary} />,
      screen: 'LiveMap',
    },
    {
      title: 'Ringkasan & Warning',
      subtitle: 'Lihat progres visit dan audit warning per cabang',
      icon: <BarChart3 size={24} color={colors.primary} />,
      screen: 'TeamSummary',
    },
    {
      title: 'Profil Saya',
      subtitle: 'Ubah profile, foto, password, dan keluar akun',
      icon: <UserCircle size={24} color={colors.primary} />,
      screen: 'Profile',
    },
  ]), [canManageStores, canManageUsersAndBranches, canVisit]);

  const quickStats = [
    { label: 'Role', value: getRoleDisplayName(roleName), tone: colors.primary },
    { label: 'Akses Visit', value: canVisit ? 'Ya' : 'Tidak', tone: canVisit ? colors.success : colors.warning },
  ];

  const openMenu = (screen) => {
    navigation.navigate(screen);
  };

  return (
    <AppScreen>
      <PageHeader
        variant="hero"
        title={`Selamat datang, ${user?.name || 'Admin'}`}
        subtitle={canManageStores
          ? 'Pusat kendali untuk user, cabang, toko, dan monitoring harian.'
          : 'Pusat kendali untuk user, cabang, dan monitoring harian.'}
        eyebrow="Admin Console"
        right={(
          <TouchableOpacity onPress={logout} style={styles.logoutIcon} activeOpacity={0.85}>
            <LogOut size={18} color="#fff" />
          </TouchableOpacity>
        )}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsRow}>
          {quickStats.map((item) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={item.value}
              tone={item.tone}
              icon={<View style={[styles.statDot, { backgroundColor: item.tone }]} />}
            />
          ))}
        </View>

        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.menuCard}
              onPress={() => openMenu(item.screen)}
              activeOpacity={0.9}
            >
              <View style={styles.iconContainer}>{item.icon}</View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <ChevronRight size={18} color={colors.textSoft} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  logoutIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  menuList: {
    gap: spacing.sm,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  menuSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
});

export default AdminDashboardScreen;
