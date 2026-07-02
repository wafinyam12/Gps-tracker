import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { storeService } from '../../api/services/storeService';
import { MapPin, ShieldCheck } from 'lucide-react-native';
import AppScreen from '../../components/ui/AppScreen';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import Surface from '../../components/ui/Surface';
import EmptyState from '../../components/ui/EmptyState';
import { colors, radii, shadows, spacing } from '../../styles/theme';

const StoreListScreen = () => {
  const navigation = useNavigation();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const response = await storeService.getStores();
      setStores(response.data?.data || response.data || []);
    } catch (error) {
      console.log('Fetch stores error:', error.response?.data || error);
      Alert.alert('Error', 'Gagal mengambil data toko');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const filteredStores = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return stores;
    }

    return stores.filter((store) => {
      const fields = [
        store.name,
        store.code,
        store.external_bp_code,
        store.address,
        store.branch,
      ];

      return fields.some((field) => field && field.toLowerCase().includes(keyword));
    });
  }, [search, stores]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStores();
  };

  const renderStoreItem = ({ item }) => (
    <Surface style={styles.storeCard}>
      <View style={styles.iconContainer}>
        <MapPin size={22} color={colors.primary} />
      </View>
      <View style={styles.storeInfo}>
        <Text style={styles.storeName}>{item.name}</Text>
        <Text style={styles.storeAddress} numberOfLines={1}>{item.address || 'Alamat belum tersedia'}</Text>
        <View style={styles.tagRow}>
          <Text style={styles.storeCode}>{item.external_bp_code || item.code}</Text>
          {!!item.branch && <Text style={styles.branchText}>{item.branch}</Text>}
          {item.has_location ? (
            <View style={styles.locationBadge}>
              <ShieldCheck size={10} color={colors.success} />
              <Text style={styles.locationBadgeText}>Lokasi Lokal</Text>
            </View>
          ) : (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>Koordinat Belum Ada</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.storeAction}>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? colors.successSoft : colors.dangerSoft }]}>
          <Text style={[styles.statusText, { color: item.status === 'active' ? colors.success : colors.danger }]}>
            {item.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
          </Text>
        </View>
      </View>
    </Surface>
  );

  return (
    <AppScreen>
      <PageHeader
        title="Manajemen Toko"
        subtitle="Master toko read-only dari SAP dan lokasi lokal."
        onBack={() => navigation.goBack()}
      />

      <View style={styles.container}>
        <View style={styles.searchSection}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Cari nama, kode, atau alamat..."
            onSubmitEditing={fetchStores}
          />
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredStores}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderStoreItem}
            onRefresh={onRefresh}
            refreshing={refreshing}
            contentContainerStyle={styles.list}
            ListHeaderComponent={(
              <Surface style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total toko</Text>
                <Text style={styles.summaryValue}>{filteredStores.length}</Text>
              </Surface>
            )}
            ListEmptyComponent={(
              <EmptyState
                title="Tidak ada toko yang ditemukan"
                description="Coba ubah kata kunci pencarian."
                icon={<MapPin size={22} color={colors.primary} />}
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
    paddingBottom: 32,
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
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  storeAddress: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  storeCode: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '900',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  branchText: {
    fontSize: 11,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  locationBadgeText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '800',
  },
  pendingBadge: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  pendingBadgeText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '800',
  },
  storeAction: {
    alignItems: 'flex-end',
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
});

export default StoreListScreen;
