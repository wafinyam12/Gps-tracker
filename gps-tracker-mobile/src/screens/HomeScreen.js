import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { visitService } from '../api/services/visitService';
import { scheduleService } from '../api/services/scheduleService';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FileText, MapPin, Clock, PlusCircle, User, Navigation } from 'lucide-react-native';
import { Image } from 'react-native';
import { canVisitStores } from '../utils/roles';

const HomeScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { isTracking, startTracking } = useLocationTracker();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const canVisit = canVisitStores(user);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      
      // User lapangan mengambil jadwal miliknya; admin memakai jadwal tanggal.
      if (canVisit) {
        response = await visitService.getTodaySchedules();
      } else {
        // Admin panggil /schedule/date dengan tanggal hari ini.
        response = await scheduleService.getScheduleByDate({ 
          date: new Date().toISOString().split('T')[0] 
        });
      }
      
      setSchedules(response.data?.schedules || []);
    } catch (error) {
      // Log error untuk debugging, tapi jangan crash - tampilkan list kosong
      console.log('Fetch schedules error:', error.response?.status, error.response?.data);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [canVisit]);

  useEffect(() => {
    if (canVisit) {
      startTracking();
    }
  }, [user?.id, canVisit, startTracking]);

  useFocusEffect(
    useCallback(() => {
      fetchSchedules();
    }, [fetchSchedules])
  );

  const handleScheduleAction = (item) => {
    if (item.status === 'pending') {
      navigation.navigate('CheckIn', { schedule: item });
      return;
    }

    if (['in_progress', 'completed'].includes(item.status) && item.visit_log?.id) {
      navigation.navigate('VisitForm', {
        schedule: item,
        visitLogId: item.visit_log.id,
      });
    }
  };

  const handleAddVisit = () => {
    const activeVisit = schedules.find((item) => item.status === 'in_progress' && item.visit_log?.id);
    if (activeVisit) {
      navigation.navigate('VisitForm', {
        schedule: activeVisit,
        visitLogId: activeVisit.visit_log.id,
      });
      return;
    }

    navigation.navigate('StartVisit');
  };

  const getActionLabel = (item) => {
    if (item.status === 'pending') return 'Mulai Kunjungan';
    if (item.status === 'in_progress') return 'Isi Data Kunjungan';
    if (item.status === 'completed') return 'Detail Kunjungan';
    return item.status.toUpperCase();
  };

  const canOpenVisitAction = (item) => {
    if (item.status === 'pending') return true;
    return ['in_progress', 'completed'].includes(item.status) && Boolean(item.visit_log?.id);
  };

  const renderScheduleItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.storeName}>{item.store.name}</Text>
          {item.user && <Text style={styles.salesName}>{item.user.name}</Text>}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <MapPin size={16} color="#6B7280" />
          <Text style={styles.infoText}>{item.store.address}</Text>
        </View>
        <View style={styles.infoRow}>
          <Clock size={16} color="#6B7280" />
          <Text style={styles.infoText}>Urutan: {item.sequence}</Text>
        </View>
      </View>

      {canVisit && (
        <TouchableOpacity
          style={[
            styles.btn,
            item.status === 'completed'
              ? styles.btnSecondary
              : canOpenVisitAction(item)
                ? styles.btnPrimary
                : styles.btnDisabled,
          ]}
          onPress={() => handleScheduleAction(item)}
          disabled={!canOpenVisitAction(item)}
      >
        <FileText size={18} color={item.status === 'completed' ? '#1E40AF' : canOpenVisitAction(item) ? '#fff' : '#4B5563'} />
        <Text style={[styles.btnText, item.status === 'completed' ? { color: '#1E40AF' } : canOpenVisitAction(item) ? { color: '#fff' } : { color: '#4B5563' }]}>
          {getActionLabel(item)}
        </Text>
      </TouchableOpacity>
      )}
    </View>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#D1FAE5';
      case 'in_progress': return '#DBEAFE';
      case 'skipped': return '#F3F4F6';
      default: return '#FEF3C7';
    }
  };

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
        <View style={styles.userInfo}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}> 
            {user?.profile_photo_url || user?.avatar_url ? (
              <Image source={{ uri: user.profile_photo_url || user.avatar_url }} style={styles.profileImage} />
            ) : (
              <User size={24} color="#fff" />
            )}
          </TouchableOpacity>
          <View>
            <Text style={styles.userName}>{user?.name || 'Sales'}</Text>
            <Text style={styles.userTeam}>{user?.team?.name || 'No Team'}</Text>
          </View>
        </View>
        <View style={styles.trackingStatus}>
          <View style={[styles.dot, { backgroundColor: isTracking ? '#10B981' : '#EF4444' }]} />
          <Text style={styles.trackingText}>
            {isTracking ? 'GPS Aktif' : 'GPS Mati'}
          </Text>
        </View>
        
      </View>
      <View style={styles.actionBar}>
        {!canVisit && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('LiveMap')}>
            <MapPin size={18} color="#1E40AF" />
            <Text style={styles.actionLabel}>Peta</Text>
          </TouchableOpacity>
        )}
        
        {canVisit && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleAddVisit}>
            <PlusCircle size={18} color="#1E40AF" />
            <Text style={styles.actionLabel}>Tambah Kunjungan</Text>
          </TouchableOpacity>
        )}

        {canVisit && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('MyLocation')}>
            <Navigation size={18} color="#1E40AF" />
            <Text style={styles.actionLabel}>Lokasi Saya</Text>
          </TouchableOpacity>
        )}
        
        {canVisit && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('MySummary')}>
            <Clock size={18} color="#1E40AF" />
            <Text style={styles.actionLabel}>Ringkasan</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Jadwal Kunjungan</Text>
        <FlatList
          data={schedules}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderScheduleItem}
          onRefresh={fetchSchedules}
          refreshing={loading}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
        <Text style={styles.emptyText}>Belum ada kunjungan hari ini. Ketuk Tambah Kunjungan untuk mulai.</Text>
          }
        />
      </View>
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
    backgroundColor: '#1E40AF',
    padding: 24,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userTeam: {
    color: '#BFDBFE',
    fontSize: 12,
  },
  trackingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trackingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  profileBtn: {
    position: 'absolute',
    top: 64,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 8,
    borderRadius: 20,
  },
  profileImage: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -12,
    borderRadius: 12,
    elevation: 2,
  },
  actionBtn: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  actionLabel: { fontSize: 12, color: '#1E293B', marginTop: 4, textAlign: 'center' },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  storeName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1,
  },
  salesName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
  },
  cardBody: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  btn: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: '#1E40AF',
  },
  btnSecondary: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  btnDisabled: {
    backgroundColor: '#f1f5f9',
  },
  btnText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 60,
    color: '#94a3b8',
    fontSize: 16,
  },
});

export default HomeScreen;
