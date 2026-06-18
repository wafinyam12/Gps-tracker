import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TextInput } from 'react-native';
import { storeService } from '../../api/services/storeService';
import { Search, MapPin, ShieldCheck } from 'lucide-react-native';

const StoreListScreen = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

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
    <View style={styles.storeCard}>
      <View style={styles.iconContainer}>
        <MapPin size={24} color="#1E40AF" />
      </View>
      <View style={styles.storeInfo}>
        <Text style={styles.storeName}>{item.name}</Text>
        <Text style={styles.storeAddress} numberOfLines={1}>{item.address || 'No Address'}</Text>
        <View style={styles.tagRow}>
          <Text style={styles.storeCode}>{item.external_bp_code || item.code}</Text>
          {!!item.branch && <Text style={styles.branchText}>{item.branch}</Text>}
          {item.has_location ? (
            <View style={styles.locationBadge}>
              <ShieldCheck size={10} color="#166534" />
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
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? '#D1FAE5' : '#FEE2E2' }]}>
          <Text style={[styles.statusText, { color: item.status === 'active' ? '#065F46' : '#991B1B' }]}>
            {item.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama, kode, atau alamat..."
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      ) : (
        <FlatList
          data={filteredStores}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderStoreItem}
          onRefresh={onRefresh}
          refreshing={refreshing}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Tidak ada toko yang ditemukan.</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSection: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  storeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  storeAddress: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 8,
  },
  storeCode: {
    fontSize: 11,
    color: '#1E40AF',
    fontWeight: 'bold',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  branchText: {
    fontSize: 11,
    color: '#334155',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  locationBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#166534',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#92400E',
  },
  storeAction: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 60,
    color: '#94a3b8',
    fontSize: 14,
  },
});

export default StoreListScreen;
