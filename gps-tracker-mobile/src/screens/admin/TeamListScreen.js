import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, MapPin, Plus, UsersRound } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../api/services/userService';
import AppScreen from '../../components/ui/AppScreen';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import Surface from '../../components/ui/Surface';
import EmptyState from '../../components/ui/EmptyState';
import { colors, radii, shadows, spacing } from '../../styles/theme';
import { getRoleName } from '../../utils/roles';

const TeamListScreen = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const { user } = useAuth();
  const currentRole = getRoleName(user);
  const canCreateTeam = currentRole === 'superadmin';

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const response = await userService.getTeams({ search });
      const payload = response.data?.data;
      setTeams(Array.isArray(payload) ? payload : payload?.data || []);
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil data cabang');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const teamCount = useMemo(() => teams.length, [teams]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTeams();
  };

  const renderTeamItem = ({ item }) => (
    <TouchableOpacity
      style={styles.teamCard}
      onPress={() => navigation.navigate('TeamForm', { teamId: item.id })}
      activeOpacity={0.9}
    >
      <View style={styles.iconContainer}>
        <UsersRound size={22} color={colors.primary} />
      </View>
      <View style={styles.teamInfo}>
        <Text style={styles.teamName}>{item.name}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.teamCode}>{item.code}</Text>
          <MapPin size={12} color={colors.textSoft} style={styles.dotIcon} />
          <Text style={styles.areaText}>{item.area || 'Semua Area'}</Text>
        </View>
        <Text style={styles.dbSapText}>DB SAP: {item.db_sap || '-'}</Text>
        <Text style={styles.memberCount}>{item.members_count || 0} anggota</Text>
        <Text style={styles.locationText}>
          {item.has_location
            ? `Lokasi tersimpan${item.latitude != null && item.longitude != null ? ` (${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)})` : ''}`
            : 'Belum ada lokasi cabang'}
        </Text>
      </View>
      <View style={styles.teamAction}>
        <View style={[styles.statusBadge, { backgroundColor: item.is_active ? colors.successSoft : colors.dangerSoft }]}>
          <Text style={[styles.statusText, { color: item.is_active ? colors.success : colors.danger }]}>
            {item.is_active ? 'AKTIF' : 'NONAKTIF'}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textSoft} />
      </View>
    </TouchableOpacity>
  );

  return (
    <AppScreen>
      <PageHeader
        title="Manajemen Cabang"
        subtitle={canCreateTeam ? 'Kelola cabang dan lokasi operasional.' : 'Kelola cabang operasional Anda.'}
        onBack={() => navigation.goBack()}
        right={canCreateTeam ? (
          <TouchableOpacity style={styles.fabMini} onPress={() => navigation.navigate('TeamForm')} activeOpacity={0.85}>
            <Plus size={18} color="#fff" />
          </TouchableOpacity>
        ) : null}
      />

      <View style={styles.container}>
        <View style={styles.searchSection}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Cari nama atau kode cabang..."
            onSubmitEditing={fetchTeams}
          />
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={teams}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderTeamItem}
            onRefresh={onRefresh}
            refreshing={refreshing}
            contentContainerStyle={styles.list}
            ListHeaderComponent={(
              <Surface style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total cabang</Text>
                <Text style={styles.summaryValue}>{teamCount}</Text>
              </Surface>
            )}
            ListEmptyComponent={(
              <EmptyState
                title="Tidak ada cabang yang ditemukan"
                description={canCreateTeam
                  ? 'Coba ubah kata kunci pencarian atau tambahkan cabang baru.'
                  : 'Coba ubah kata kunci pencarian atau hubungi superadmin jika cabang belum muncul.'}
                icon={<UsersRound size={22} color={colors.primary} />}
                actionLabel={canCreateTeam ? 'Tambah Cabang' : undefined}
                onAction={canCreateTeam ? () => navigation.navigate('TeamForm') : undefined}
              />
            )}
          />
        )}

      </View>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 110,
  },
  summaryCard: {
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    marginTop: 4,
  },
  teamCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
    flexWrap: 'wrap',
  },
  teamCode: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '900',
  },
  dotIcon: {
    marginTop: 1,
  },
  areaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dbSapText: {
    fontSize: 11,
    color: colors.textSoft,
    marginTop: 4,
  },
  memberCount: {
    fontSize: 11,
    color: colors.textSoft,
    marginTop: 4,
  },
  locationText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  teamAction: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
  },
  fabMini: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TeamListScreen;
