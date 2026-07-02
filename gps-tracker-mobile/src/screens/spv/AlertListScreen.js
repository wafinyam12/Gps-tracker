import React, { useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, AlertTriangle, User, CheckCircle } from 'lucide-react-native';
import { reportService } from '../../api/services/reportService';
import { getJakartaDateString } from '../../utils/date';

const AlertListScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    fetchWarnings();
  }, []);

  const fetchWarnings = async () => {
    setLoading(true);
    try {
      const yesterday = getJakartaDateString(-1);
      const response = await reportService.targetSummary({
        date_from: yesterday,
        date_to: yesterday,
      });

      const payload = response.data?.data || response.data || {};
      setWarnings(Array.isArray(payload.warnings) ? payload.warnings : []);
    } catch (error) {
      console.log('Error fetching warnings', error.response?.data || error);
      Alert.alert('Error', 'Gagal mengambil data warning');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('SalesDetail', { userId: item.user_id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <User size={20} color="#EF4444" />
          <Text style={styles.userName}>{item.name}</Text>
        </View>
        <AlertTriangle size={20} color="#EF4444" />
      </View>

      <Text style={styles.metaText}>Tanggal: {item.date}</Text>
      <Text style={styles.metaText}>Target: {item.target_visits} | Unik: {item.unique_visits} | Duplicate: {item.duplicate_visits}</Text>
      <Text style={styles.anomalyText}>{item.message}</Text>
      <Text style={styles.tapText}>Ketuk untuk lihat detail sales {'>'}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Warning Audit</Text>
      </View>

      <FlatList
        data={warnings}
        keyExtractor={(item, index) => `${item.user_id}-${item.date}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <CheckCircle size={48} color="#10B981" />
            <Text style={styles.emptyText}>Tidak ada warning audit untuk hari kemarin.</Text>
          </View>
        }
        onRefresh={fetchWarnings}
        refreshing={loading}
      />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  list: {
    padding: 20,
    paddingBottom: Platform.OS === 'android' ? 64 : 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  metaText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  anomalyText: {
    fontSize: 13,
    color: '#7C2D12',
    marginTop: 8,
    lineHeight: 18,
  },
  tapText: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});

export default AlertListScreen;
