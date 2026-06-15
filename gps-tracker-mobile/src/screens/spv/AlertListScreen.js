import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { scheduleService } from '../../api/services/scheduleService';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, AlertTriangle, MapPin, Clock, User } from 'lucide-react-native';
import moment from 'moment';

const AlertListScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [anomalies, setAnomalies] = useState([]);

  useEffect(() => {
    fetchAnomalies();
  }, []);

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      // Mengambil data hari ini dan memfilter anomali di client side (v1)
      const formattedDate = moment().format('YYYY-MM-DD');
      const response = await scheduleService.getTeamSummary({ date: formattedDate });

      const salesData = response.data?.data?.sales || [];
      const allAnomalies = [];

      salesData.forEach(sales => {
        // Cari mock location atau invalid checkins dari data summary
        if (sales.summary.mock_detected > 0 || sales.summary.total > sales.summary.valid_checkins) {
          allAnomalies.push({
            id: sales.user_id,
            name: sales.name,
            team: sales.team?.name,
            mockCount: sales.summary.mock_detected,
            invalidCount: sales.summary.total - sales.summary.valid_checkins,
            lastSeen: sales.last_seen_at,
          });
        }
      });

      setAnomalies(allAnomalies);
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil data anomali');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('SalesDetail', { userId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <User size={20} color="#EF4444" />
          <Text style={styles.userName}>{item.name}</Text>
        </View>
        <AlertTriangle size={20} color="#EF4444" />
      </View>

      <View style={styles.anomalyDetails}>
        {item.mockCount > 0 && (
          <View style={styles.anomalyItem}>
            <View style={styles.dot} />
            <Text style={styles.anomalyText}>Terdeteksi {item.mockCount} penggunaan Mock GPS / Lokasi Palsu</Text>
          </View>
        )}
        {item.invalidCount > 0 && (
          <View style={styles.anomalyItem}>
            <View style={styles.dot} />
            <Text style={styles.anomalyText}>{item.invalidCount} Check-in dilakukan di luar radius toko</Text>
          </View>
        )}
      </View>

      <Text style={styles.tapText}>Ketuk untuk lihat detail pergerakan {'>'}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Anomali Kunjungan</Text>
      </View>

      <FlatList
        data={anomalies}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <CheckCircle size={48} color="#10B981" />
            <Text style={styles.emptyText}>Tidak ada anomali terdeteksi hari ini.</Text>
          </View>
        }
        onRefresh={fetchAnomalies}
        refreshing={loading}
      />
    </View>
  );
};

// Re-using CheckCircle from lucide-react-native
import { CheckCircle } from 'lucide-react-native';

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
    paddingTop: 60,
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
    marginBottom: 12,
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
  anomalyDetails: {
    marginBottom: 12,
    gap: 8,
  },
  anomalyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginTop: 6,
  },
  anomalyText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
    lineHeight: 18,
  },
  tapText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
});

export default AlertListScreen;
