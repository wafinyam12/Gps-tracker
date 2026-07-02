import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronDown, ChevronRight, ChevronUp, Filter, User, UserCheck, UserPlus, UserX } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import { userService } from '../../api/services/userService';
import AppScreen from '../../components/ui/AppScreen';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import Surface from '../../components/ui/Surface';
import EmptyState from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { colors, radii, shadows, spacing } from '../../styles/theme';
import { getRoleDisplayName, getRoleName } from '../../utils/roles';

const STATUS_OPTIONS = [
  { label: 'Semua Status', value: 'all' },
  { label: 'Aktif', value: 'active' },
  { label: 'Nonaktif', value: 'inactive' },
];

const ROLE_TONES = {
  sales: { background: colors.primarySoft, text: colors.primary },
  spv: { background: colors.accentSoft, text: colors.warning },
  manager: { background: colors.successSoft, text: colors.success },
  admin: { background: colors.surfaceMuted, text: colors.primaryDark },
  superadmin: { background: colors.backgroundAlt, text: colors.info },
  default: { background: colors.surfaceMuted, text: colors.textMuted },
};

const getRoleLabel = (role) => getRoleDisplayName(role);

const getRoleTone = (role) => ROLE_TONES[role] || ROLE_TONES.default;

const getTeamName = (user, currentRole) => user.branch?.name || user.team?.name || (currentRole === 'superadmin' ? 'Semua cabang' : 'Tanpa cabang');

const getRoleOptions = (isSuperAdmin) => (
  isSuperAdmin
    ? [
        { label: 'Semua Role', value: 'all' },
        { label: 'Sales', value: 'sales' },
        { label: 'Area Manager', value: 'spv' },
        { label: 'Manager', value: 'manager' },
        { label: 'Admin Cabang', value: 'admin' },
        { label: 'Super Admin', value: 'superadmin' },
      ]
    : [
        { label: 'Semua Role', value: 'all' },
        { label: 'Sales', value: 'sales' },
      ]
);

const formatLastSeen = (value) => {
  if (!value) {
    return 'Belum ada riwayat login';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Belum ada riwayat login';
  }

  const datePart = date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${datePart} - ${timePart}`;
};

const UserListScreen = () => {
  const navigation = useNavigation();
  const { user: currentUser } = useAuth();
  const currentRole = getRoleName(currentUser);
  const isSuperAdmin = currentRole === 'superadmin';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [teamOptions, setTeamOptions] = useState([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [togglingUserId, setTogglingUserId] = useState(null);
  const filtersRef = useRef({
    search: '',
    roleFilter: 'all',
    statusFilter: 'all',
    branchFilter: 'all',
  });
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    filtersRef.current = {
      search: search.trim(),
      roleFilter,
      statusFilter,
      branchFilter,
    };
  }, [search, roleFilter, statusFilter, branchFilter]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setBranchFilter('all');
      setTeamOptions([]);
      return undefined;
    }

    let isMounted = true;

    const loadBranchOptions = async () => {
      try {
        const response = await userService.getTeams({ per_page: 100 });
        const payload = response.data?.data;
        const list = Array.isArray(payload) ? payload : payload?.data || [];

        if (isMounted) {
          setTeamOptions(list);
        }
      } catch (error) {
        if (isMounted) {
          setTeamOptions([]);
        }
      }
    };

    loadBranchOptions();

    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin]);

  const loadUsers = useCallback(async ({ showLoader = false } = {}) => {
    const {
      search: currentSearch,
      roleFilter: currentRoleFilter,
      statusFilter: currentStatusFilter,
      branchFilter: currentBranchFilter,
    } = filtersRef.current;

    if (showLoader) {
      setLoading(true);
    }

    try {
      const params = { per_page: 100 };
      if (currentSearch) {
        params.search = currentSearch;
      }
      if (currentRoleFilter !== 'all') {
        params.role = currentRoleFilter;
      }
      if (currentStatusFilter !== 'all') {
        params.is_active = currentStatusFilter === 'active';
      }
      if (isSuperAdmin && currentBranchFilter !== 'all') {
        params.team_id = currentBranchFilter;
      }

      const response = await userService.getUsers(params);
      const payload = response.data?.data;
      const list = Array.isArray(payload) ? payload : payload?.data || [];
      const total = Number(response.data?.meta?.total);

      setUsers(list);
      setTotalCount(Number.isFinite(total) ? total : list.length);
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil data user');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      await loadUsers({ showLoader: true });
      if (isMounted) {
        hasLoadedOnce.current = true;
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [loadUsers]);

  useEffect(() => {
    if (!hasLoadedOnce.current) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      loadUsers();
    }, 300);

    return () => clearTimeout(timeout);
  }, [branchFilter, loadUsers, roleFilter, search, statusFilter]);

  const hasActiveFilters = useMemo(
    () => search.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all' || (isSuperAdmin && branchFilter !== 'all'),
    [branchFilter, isSuperAdmin, roleFilter, search, statusFilter],
  );
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count += 1;
    if (roleFilter !== 'all') count += 1;
    if (statusFilter !== 'all') count += 1;
    if (isSuperAdmin && branchFilter !== 'all') count += 1;
    return count;
  }, [branchFilter, isSuperAdmin, roleFilter, search, statusFilter]);

  const activeCount = useMemo(() => users.filter((item) => item.is_active).length, [users]);
  const inactiveCount = useMemo(() => users.length - activeCount, [users, activeCount]);
  const isTruncated = totalCount > users.length;

  const summaryHint = useMemo(() => {
    if (isTruncated) {
      return isSuperAdmin && branchFilter !== 'all'
        ? `Menampilkan ${users.length} dari ${totalCount} user pada cabang terpilih.`
        : `Menampilkan ${users.length} dari ${totalCount} user. Persempit filter untuk melihat lebih spesifik.`;
    }

    if (users.length === 0) {
      return hasActiveFilters
        ? 'Tidak ada user yang cocok dengan filter saat ini.'
        : 'Tambahkan user baru untuk mulai mengelola akses tim.';
    }

    return isSuperAdmin
      ? 'Ketuk user untuk edit. Super admin dapat memfilter berdasarkan cabang dan role.'
      : 'Ketuk user untuk edit, lalu gunakan tombol status untuk ubah akses dengan cepat.';
  }, [branchFilter, hasActiveFilters, isSuperAdmin, isTruncated, totalCount, users.length]);

  const roleOptions = useMemo(() => getRoleOptions(isSuperAdmin), [isSuperAdmin]);

  const resetFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
    setBranchFilter('all');
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const handleToggleActive = (targetUser) => {
    if (currentUser?.id === targetUser.id) {
      Alert.alert('Info', 'Akun Anda tidak bisa dinonaktifkan dari layar ini.');
      return;
    }

    const actionLabel = targetUser.is_active ? 'menonaktifkan' : 'mengaktifkan';
    Alert.alert(
      targetUser.is_active ? 'Nonaktifkan User' : 'Aktifkan User',
      `Yakin ingin ${actionLabel} ${targetUser.name}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: targetUser.is_active ? 'Nonaktifkan' : 'Aktifkan',
          style: targetUser.is_active ? 'destructive' : 'default',
          onPress: async () => {
            setTogglingUserId(targetUser.id);
            try {
              await userService.toggleActiveUser(targetUser.id);
              await loadUsers();
            } catch (error) {
              const msg = error.response?.data?.message || 'Gagal memperbarui status user';
              Alert.alert('Error', msg);
            } finally {
              setTogglingUserId(null);
            }
          },
        },
      ],
    );
  };

  const renderUserItem = ({ item }) => {
    const role = item.role || item.roles?.[0]?.name || 'sales';
    const roleLabel = getRoleLabel(role);
    const roleTone = getRoleTone(role);
    const branchName = getTeamName(item, currentRole);
    const isCurrentUser = currentUser?.id === item.id;
    const lastSeenText = formatLastSeen(item.last_seen_at);

    return (
      <View style={styles.userCard}>
        <TouchableOpacity
          style={styles.userMain}
          onPress={() => navigation.navigate('UserForm', { userId: item.id })}
          activeOpacity={0.9}
        >
          <View style={styles.avatarContainer}>
            <User size={22} color={colors.primary} />
          </View>

          <View style={styles.userInfo}>
            <View style={styles.userTitleRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: roleTone.background }]}>
                <Text style={[styles.roleBadgeText, { color: roleTone.text }]}>{roleLabel}</Text>
              </View>
            </View>

            <Text style={styles.userDetails} numberOfLines={1}>
              {branchName}
            </Text>

            <Text style={styles.userMeta} numberOfLines={1}>
              @{item.username || '-'}
              {item.employee_id ? ` - ${item.employee_id}` : ''}
              {item.email ? ` - ${item.email}` : ''}
            </Text>

            <Text style={styles.userSeen} numberOfLines={1}>
              {item.last_seen_at ? `Aktif terakhir ${lastSeenText}` : 'Belum ada riwayat login'}
            </Text>
          </View>

          <ChevronRight size={18} color={colors.textSoft} />
        </TouchableOpacity>

        <View style={styles.userAction}>
          <View style={[styles.statusBadge, { backgroundColor: item.is_active ? colors.successSoft : colors.dangerSoft }]}>
            <Text style={[styles.statusText, { color: item.is_active ? colors.success : colors.danger }]}>
              {item.is_active ? 'AKTIF' : 'NONAKTIF'}
            </Text>
          </View>

          {isCurrentUser ? (
            <View style={styles.selfBadge}>
              <Text style={styles.selfBadgeText}>Akun Anda</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.quickActionBtn,
                item.is_active ? styles.quickActionDanger : styles.quickActionSuccess,
              ]}
              onPress={() => handleToggleActive(item)}
              activeOpacity={0.85}
              disabled={togglingUserId === item.id}
            >
              {togglingUserId === item.id ? (
                <ActivityIndicator size="small" color={item.is_active ? colors.danger : colors.success} />
              ) : (
                <>
                  {item.is_active ? (
                    <UserX size={14} color={colors.danger} />
                  ) : (
                    <UserCheck size={14} color={colors.success} />
                  )}
                  <Text
                    style={[
                      styles.quickActionText,
                      item.is_active ? styles.quickActionDangerText : styles.quickActionSuccessText,
                    ]}
                  >
                    {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const emptyState = hasActiveFilters
    ? {
        title: 'Tidak ada hasil yang cocok',
        description: 'Coba ubah kata kunci atau reset filter untuk melihat user lain.',
        actionLabel: 'Reset Filter',
        onAction: resetFilters,
      }
    : {
        title: 'Belum ada user',
        description: 'Tambahkan user baru untuk mulai mengelola akses tim.',
        actionLabel: 'Tambah User',
        onAction: () => navigation.navigate('UserForm'),
      };

  return (
    <AppScreen>
      <PageHeader
        title="Manajemen User"
        subtitle={isSuperAdmin
          ? 'Cari, filter per cabang, tambah, dan edit akun sales, area manager, maupun admin cabang.'
          : 'Kelola akun sales di cabang Anda.'}
        onBack={() => navigation.goBack()}
        right={(
          <TouchableOpacity style={styles.fabMini} onPress={() => navigation.navigate('UserForm')} activeOpacity={0.85}>
            <UserPlus size={18} color="#fff" />
          </TouchableOpacity>
        )}
      />

      <View style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.topSection}>
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder="Cari nama, username, email, atau NIK..."
                onSubmitEditing={() => loadUsers()}
              />

              <Surface style={styles.toolbarCard}>
                <View style={styles.toolbarHeader}>
                  <View style={styles.toolbarTitleWrap}>
                    <View style={styles.toolbarTitleRow}>
                      <Filter size={14} color={colors.primary} />
                      <Text style={styles.toolbarTitle}>Ringkasan & filter</Text>
                      {activeFilterCount > 0 && (
                        <View style={styles.filterCountBadge}>
                          <Text style={styles.filterCountText}>{activeFilterCount} aktif</Text>
                        </View>
                      )}
                    </View>
                    {(filtersExpanded || hasActiveFilters) && (
                      <Text style={styles.toolbarSubtitle}>
                        {filtersExpanded
                          ? 'Pilih cabang, role, atau status sesuai kebutuhan.'
                          : 'Filter aktif, ringkasan tetap disembunyikan.'}
                      </Text>
                    )}
                  </View>

                  <View style={styles.toolbarActions}>
                    {hasActiveFilters && (
                      <TouchableOpacity style={styles.resetButton} onPress={resetFilters} activeOpacity={0.85}>
                        <Text style={styles.resetButtonText}>Reset</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.toggleButton}
                      onPress={() => setFiltersExpanded((value) => !value)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.toggleButtonText}>
                        {filtersExpanded ? 'Sembunyikan' : 'Tampilkan'}
                      </Text>
                      {filtersExpanded ? (
                        <ChevronUp size={14} color={colors.primary} />
                      ) : (
                        <ChevronDown size={14} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {filtersExpanded && (
                  <>
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryPrimary}>
                        <Text style={styles.summaryLabel}>User tampil</Text>
                        <Text style={styles.summaryValue}>{users.length}</Text>
                      </View>

                      <View style={styles.summaryStat}>
                        <Text style={styles.summaryStatValue}>{activeCount}</Text>
                        <Text style={styles.summaryStatLabel}>Aktif</Text>
                      </View>

                      <View style={styles.summaryStat}>
                        <Text style={styles.summaryStatValue}>{inactiveCount}</Text>
                        <Text style={styles.summaryStatLabel}>Nonaktif</Text>
                      </View>
                    </View>

                    <Text style={styles.summaryHint}>{summaryHint}</Text>

                    {isSuperAdmin && (
                      <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>Cabang</Text>
                        <View style={styles.filterPickerContainer}>
                          <Picker
                            selectedValue={branchFilter}
                            onValueChange={setBranchFilter}
                          >
                            <Picker.Item label="Semua Cabang" value="all" />
                            {teamOptions.map((team) => (
                              <Picker.Item key={team.id} label={team.name} value={team.id.toString()} />
                            ))}
                          </Picker>
                        </View>
                      </View>
                    )}

                    {isSuperAdmin && (
                      <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>Role</Text>
                        <View style={styles.chipWrap}>
                          {roleOptions.map((option) => {
                            const selected = roleFilter === option.value;

                            return (
                              <TouchableOpacity
                                key={option.value}
                                style={[styles.filterChip, selected && styles.filterChipActive]}
                                onPress={() => setRoleFilter(option.value)}
                                activeOpacity={0.85}
                              >
                                <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                                  {option.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    <View style={styles.filterGroup}>
                      <Text style={styles.filterLabel}>Status</Text>
                      <View style={styles.chipWrap}>
                        {STATUS_OPTIONS.map((option) => {
                          const selected = statusFilter === option.value;

                          return (
                            <TouchableOpacity
                              key={option.value}
                              style={[styles.filterChip, selected && styles.filterChipActive]}
                              onPress={() => setStatusFilter(option.value)}
                              activeOpacity={0.85}
                            >
                              <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </>
                )}
              </Surface>
            </View>

            <FlatList
              data={users}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderUserItem}
              onRefresh={onRefresh}
              refreshing={refreshing}
              contentContainerStyle={styles.list}
              ListEmptyComponent={(
                <EmptyState
                  title={emptyState.title}
                  description={emptyState.description}
                  icon={<User size={22} color={colors.primary} />}
                  actionLabel={emptyState.actionLabel}
                  onAction={emptyState.onAction}
                />
              )}
            />
          </>
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
  topSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  toolbarCard: {
    gap: spacing.md,
  },
  toolbarHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  toolbarTitleWrap: {
    flex: 1,
    gap: 4,
  },
  toolbarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  toolbarTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  toolbarSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  filterCountBadge: {
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  resetButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  resetButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  summaryPrimary: {
    flex: 1.2,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    padding: 14,
    justifyContent: 'space-between',
    minHeight: 88,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  summaryStat: {
    flex: 0.9,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  summaryStatValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    color: colors.text,
  },
  summaryStatLabel: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
  },
  summaryHint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  filterGroup: {
    gap: spacing.sm,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterPickerContainer: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 110,
  },
  userCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.soft,
  },
  userMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  userName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  userDetails: {
    fontSize: 12,
    color: colors.textMuted,
  },
  userMeta: {
    fontSize: 11,
    color: colors.textSoft,
  },
  userSeen: {
    fontSize: 11,
    color: colors.textSoft,
  },
  userAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  quickActionDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
  },
  quickActionSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successSoft,
  },
  quickActionText: {
    fontSize: 10,
    fontWeight: '900',
  },
  quickActionDangerText: {
    color: colors.danger,
  },
  quickActionSuccessText: {
    color: colors.success,
  },
  selfBadge: {
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selfBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textMuted,
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

export default UserListScreen;
