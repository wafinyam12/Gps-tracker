import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, BarChart3, LogOut, MapPin, UserCircle, Users, UsersRound } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { getRoleDisplayName, getRoleName } from '../../utils/roles';
import { getMonitoringDashboardActions } from '../../utils/monitoringDashboardPresentation';
import AppScreen from '../../components/ui/AppScreen';
import VisitHeader from '../../components/visit/VisitHeader';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';

const ACTIONS = {
  Home: { title: 'Kunjungan saya', detail: 'Lanjutkan kunjungan dan lihat hasil pribadi', Icon: MapPin },
  UserList: { title: 'Manajemen User', detail: 'Siapkan akun Sales untuk kunjungan', Icon: Users },
  TeamList: { title: 'Manajemen Cabang', detail: 'Atur penempatan dan data cabang', Icon: UsersRound },
  TeamSummary: { title: 'Ringkasan kunjungan', detail: 'Target, progres Sales, dan peringatan', Icon: BarChart3 },
  Profile: { title: 'Profil saya', detail: 'Data akun dan keamanan', Icon: UserCircle },
};

const AdminDashboardScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const roleName = getRoleName(user);
  const actions = getMonitoringDashboardActions(roleName);
  const firstName = (user?.name || getRoleDisplayName(roleName)).trim().split(/\s+/)[0];
  const branchName = user?.branch?.name || user?.team?.name
    || (roleName === 'superadmin' ? 'Semua cabang' : 'Cabang belum tersedia');
  const isManagerRole = roleName === 'spv' || roleName === 'manager';

  const logoutButton = (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Keluar dari akun" onPress={logout} style={styles.logoutButton}>
      <LogOut size={20} color={visitColors.primary} />
    </TouchableOpacity>
  );

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      <VisitHeader
        title={'Halo, ' + firstName}
        subtitle={getRoleDisplayName(roleName) + ' · ' + branchName}
        right={logoutButton}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          {isManagerRole ? 'Pantau tim dan hasil kunjungan dari satu tempat.' : 'Siapkan akun, cabang, dan pantau kunjungan.'}
        </Text>

        {actions.includes('LiveMap') ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Buka monitoring posisi Sales"
            onPress={() => navigation.navigate('LiveMap')}
            style={styles.primaryAction}
            activeOpacity={0.85}
          >
            <View style={styles.primaryCopy}>
              <Text style={styles.primaryTitle}>Pantau posisi Sales</Text>
              <Text style={styles.primaryDetail}>Lihat posisi terakhir dan toko di peta</Text>
            </View>
            <ArrowRight size={22} color={visitColors.surface} />
          </TouchableOpacity>
        ) : null}

        <Text style={styles.sectionTitle}>{isManagerRole ? 'Akses cepat' : 'Kelola dan tinjau'}</Text>
        <View style={styles.actionList}>
          {actions.filter((route) => route !== 'LiveMap').map((route) => {
            const action = ACTIONS[route];
            const Icon = action.Icon;
            return (
              <TouchableOpacity
                key={route}
                accessibilityRole="button"
                accessibilityLabel={action.title}
                onPress={() => navigation.navigate(route)}
                style={styles.actionRow}
                activeOpacity={0.85}
              >
                <View style={styles.actionIcon}><Icon size={20} color={visitColors.primary} /></View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDetail}>{action.detail}</Text>
                </View>
                <ArrowRight size={18} color={visitColors.primary} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas },
  screenContent: { paddingTop: 0, paddingBottom: 0 },
  content: { paddingHorizontal: visitSpacing.page, paddingTop: visitSpacing.section, paddingBottom: visitSpacing.sectionLarge },
  logoutButton: { width: 44, height: 44, borderRadius: visitRadii.control, backgroundColor: visitColors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  intro: { ...visitType.body, color: visitColors.mutedInk },
  primaryAction: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.card, padding: visitSpacing.card, marginTop: visitSpacing.section, borderRadius: visitRadii.large, backgroundColor: visitColors.primary },
  primaryCopy: { flex: 1, minWidth: 0 },
  primaryTitle: { ...visitType.section, color: visitColors.surface },
  primaryDetail: { ...visitType.body, color: visitColors.surface, marginTop: visitSpacing.xs },
  sectionTitle: { ...visitType.section, color: visitColors.ink, marginTop: visitSpacing.sectionLarge, marginBottom: visitSpacing.sm },
  actionList: { gap: visitSpacing.sm },
  actionRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.md, padding: visitSpacing.card, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, backgroundColor: visitColors.surface },
  actionIcon: { width: 44, height: 44, borderRadius: visitRadii.control, backgroundColor: visitColors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { ...visitType.label, color: visitColors.ink },
  actionDetail: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
});

export default AdminDashboardScreen;
