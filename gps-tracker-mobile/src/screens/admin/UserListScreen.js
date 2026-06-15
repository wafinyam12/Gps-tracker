import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { userService } from '../../api/services/userService';
import { UserPlus, Search, Filter, ChevronRight, User } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const UserListScreen = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await userService.getUsers({ search });
      setUsers(response.data?.data || []);
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil data user');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => navigation.navigate('UserForm', { userId: item.id })}
    >
      <View style={styles.avatarContainer}>
        <User size={24} color="#64748B" />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userDetails}>
          {item.roles?.[0]?.name?.toUpperCase()} • {item.team?.name || 'Tanpa Tim'}
        </Text>
        <Text style={styles.employeeId}>{item.employee_id || '-'}</Text>
      </View>
      <View style={styles.userAction}>
        <View style={[styles.statusBadge, { backgroundColor: item.is_active ? '#D1FAE5' : '#FEE2E2' }]}>
          <Text style={[styles.statusText, { color: item.is_active ? '#065F46' : '#991B1B' }]}>
            {item.is_active ? 'AKTIF' : 'NONAKTIF'}
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
            placeholder="Cari nama, email, atau NIK..."
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchUsers}
          />
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Filter size={20} color="#1E40AF" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderUserItem}
          onRefresh={onRefresh}
          refreshing={refreshing}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Tidak ada user yang ditemukan.</Text>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('UserForm')}
      >
        <UserPlus size={24} color="#fff" />
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
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
  },
  searchBar: {
    flex: 1,
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
  filterBtn: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 12,
    justifyContent: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  userCard: {
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
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  userDetails: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  employeeId: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  userAction: {
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

export default UserListScreen;
