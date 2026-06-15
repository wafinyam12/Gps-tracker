import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { userService } from '../../api/services/userService';
import { Plus, Search, ChevronRight, UsersRound, MapPin } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const TeamListScreen = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const response = await userService.getTeams({ search });
      const payload = response.data?.data;
      setTeams(Array.isArray(payload) ? payload : payload?.data || []);
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil data team');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTeams();
  };

  const renderTeamItem = ({ item }) => (
    <TouchableOpacity
      style={styles.teamCard}
      onPress={() => navigation.navigate('TeamForm', { teamId: item.id })}
    >
      <View style={styles.iconContainer}>
        <UsersRound size={24} color="#1E40AF" />
      </View>
      <View style={styles.teamInfo}>
        <Text style={styles.teamName}>{item.name}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.teamCode}>{item.code}</Text>
          <Text style={styles.dot}> • </Text>
          <MapPin size={12} color="#94A3B8" />
          <Text style={styles.areaText}>{item.area || 'Semua Area'}</Text>
        </View>
        <Text style={styles.memberCount}>{item.members_count || 0} Anggota</Text>
      </View>
      <View style={styles.teamAction}>
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
            placeholder="Cari nama atau kode team..."
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchTeams}
          />
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTeamItem}
          onRefresh={onRefresh}
          refreshing={refreshing}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Tidak ada team yang ditemukan.</Text>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('TeamForm')}
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
  teamCard: {
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
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  teamCode: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: 'bold',
  },
  dot: {
    fontSize: 12,
    color: '#94a3b8',
  },
  areaText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  memberCount: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  teamAction: {
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

export default TeamListScreen;
