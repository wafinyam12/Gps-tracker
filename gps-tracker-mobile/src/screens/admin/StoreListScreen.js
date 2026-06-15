import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { storeService } from '../../api/services/storeService';
import { Plus, Search, MapPin, ChevronRight, Filter } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const StoreListScreen = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const response = await storeService.getStores({ search });
      setStores(response.data?.data || []);
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil data toko');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStores();
  };

  const renderStoreItem = ({ item }) => (
    <TouchableOpacity
      style={styles.storeCard}
      onPress={() => navigation.navigate('StoreForm', { storeId: item.id })}
    >
      <View style={styles.iconContainer}>
        <MapPin size={24} color="#1E40AF" />
      </View>
      <View style={styles.storeInfo}>
        <Text style={styles.storeName}>{item.name}</Text>
        <Text style={styles.storeAddress} numberOfLines={1}>{item.address || 'No Address'}</Text>
        <View style={styles.tagRow}>
          <Text style={styles.storeCode}>{item.code}</Text>
          {item.is_priority && (
            <View style={styles.priorityBadge}>
              <Text style={styles.priorityText}>PRIORITY</Text>
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
        <ChevronRight size={18} color="#94A3B8" />
      </View>
    </TouchableOpacity>
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
            onSubmitEditing={fetchStores}
          />
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      ) : (
        <FlatList
          data={stores}
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

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('StoreForm')}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>
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
  priorityBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 9,
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#1E40AF',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 60,
    color: '#94a3b8',
    fontSize: 14,
  },
});

export default StoreListScreen;
