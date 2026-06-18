import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ArrowRight, Clock, MapPin, Navigation, PlusCircle, User } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { reportService } from '../api/services/reportService';
import { canVisitStores } from '../utils/roles';

const HomeScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { isTracking, startTracking } = useLocationTracker();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const canVisit = canVisitStores(user);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await reportService.targetToday();
      const payload = response.data?.data || response.data || {};
      setSummary(payload);
    } catch (error) {
      console.log('Fetch summary error:', error.response?.data || error);
      setSummary(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (canVisit) {
      startTracking();
    }
  }, [canVisit, startTracking]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchSummary();
    }, [fetchSummary])
  );

  const stats = summary?.stats || {};
  const visits = Array.isArray(summary?.visits) ? summary.visits : [];
  const openVisit = summary?.open_visit || null;
  const warnings = Array.isArray(summary?.warnings) ? summary.warnings : [];

  const handleOpenVisit = () => {
    if (openVisit?.visit_log_id) {
      navigation.navigate('VisitForm', { visitLogId: openVisit.visit_log_id });
      return;
    }

    navigation.navigate('StartVisit');
  };

  const handleVisitPress = (visit) => {
    if (visit?.id) {
      navigation.navigate('VisitForm', { visitLogId: visit.id });
    }
  };

  const summaryCards = useMemo(() => ([
    {
      label: 'Target',
      value: stats.target_visits ?? 0,
      tone: '#1E40AF',
    },
    {
      label: 'Toko Unik',
      value: stats.unique_visits ?? 0,
      tone: '#047857',
    },
    {
      label: 'Duplicate',
      value: stats.duplicate_visits ?? 0,
      tone: '#B45309',
    },
    {
      label: 'Progress',
      value: `${stats.completion_pct ?? 0}%`,
      tone: '#7C3AED',
    },
  ]), [stats]);

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
        <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
          {user?.profile_photo_url || user?.avatar_url ? (
            <Image source={{ uri: user.profile_photo_url || user.avatar_url }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileFallback}>
              <User size={22} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <Text style={styles.userName}>{user?.name || 'Sales'}</Text>
          <Text style={styles.userTeam}>{user?.team?.name || 'No Team'}</Text>
        </View>

        <View style={styles.trackingPill}>
          <View style={[styles.dot, { backgroundColor: isTracking ? '#10B981' : '#EF4444' }]} />
          <Text style={styles.trackingText}>{isTracking ? 'GPS Aktif' : 'GPS Mati'}</Text>
        </View>
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleOpenVisit}>
          <PlusCircle size={18} color="#1E40AF" />
          <Text style={styles.actionLabel}>{openVisit ? 'Lanjut Visit' : 'Mulai Visit'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('MyLocation')}>
          <Navigation size={18} color="#1E40AF" />
          <Text style={styles.actionLabel}>Lokasi Saya</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('MySummary')}>
          <Clock size={18} color="#1E40AF" />
          <Text style={styles.actionLabel}>Ringkasan</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={styles.content}
        data={visits}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <>
            <View style={styles.summaryGrid}>
              {summaryCards.map((item) => (
                <View key={item.label} style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                  <Text style={[styles.summaryValue, { color: item.tone }]}>{item.value}</Text>
                </View>
              ))}
            </View>

            {openVisit && (
              <TouchableOpacity style={styles.openVisitCard} onPress={handleOpenVisit}>
                <View style={styles.openVisitCopy}>
                  <Text style={styles.openVisitLabel}>Visit aktif</Text>
                  <Text style={styles.openVisitTitle} numberOfLines={1}>
                    {openVisit.store?.name || 'Toko'}
                  </Text>
                  <Text style={styles.openVisitMeta} numberOfLines={1}>
                    {openVisit.store?.branch || openVisit.store?.address || 'Detail belum tersedia'}
                  </Text>
                </View>
                <ArrowRight size={18} color="#1E40AF" />
              </TouchableOpacity>
            )}

            {warnings.length > 0 && (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Warning audit</Text>
                {warnings.slice(0, 2).map((warning, index) => (
                  <Text key={`${warning.date || index}-${index}`} style={styles.warningText}>
                    {warning.message || `Hari ${warning.date} belum mencapai target.`}
                  </Text>
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>Visit Terbaru</Text>
          </>
        }
        renderItem={({ item }) => {
          const isDuplicate = Boolean(item.is_duplicate);
          const isCounted = Boolean(item.counted_as_target);

          return (
            <TouchableOpacity style={styles.visitCard} onPress={() => handleVisitPress(item)}>
              <View style={styles.visitHeader}>
                <View style={styles.visitTitleWrap}>
                  <Text style={styles.visitTitle} numberOfLines={1}>{item.store?.name || 'Toko'}</Text>
                  <Text style={styles.visitMeta} numberOfLines={1}>
                    {item.store?.branch || item.store?.address || 'Belum ada detail'}
                  </Text>
                </View>
                <View style={[styles.badge, isDuplicate ? styles.badgeDuplicate : styles.badgeNormal]}>
                  <Text style={styles.badgeText}>{isDuplicate ? 'DUPLICATE' : (isCounted ? 'VALID' : 'TIDAK HITUNG')}</Text>
                </View>
              </View>

              <View style={styles.visitMetaRow}>
                <MapPin size={14} color="#64748B" />
          <Text style={styles.visitMetaText}>
                  {item.visit_date || '-'} {item.checkin_at ? `- ${new Date(item.checkin_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </Text>
              </View>

              <Text style={styles.visitResult}>
                Hasil: {item.visit_result || 'belum disubmit'}
              </Text>
            </TouchableOpacity>
          );
        }}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchSummary();
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Belum ada visit tercatat hari ini.</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileBtn: {
    width: 42,
    height: 42,
  },
  profileFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  headerCopy: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  userTeam: {
    color: '#DBEAFE',
    fontSize: 12,
    marginTop: 2,
  },
  trackingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trackingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  actionBar: {
    marginHorizontal: 16,
    marginTop: -10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    elevation: 2,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  actionLabel: {
    fontSize: 12,
    color: '#1E293B',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  summaryGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  openVisitCard: {
    marginTop: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openVisitCopy: {
    flex: 1,
    paddingRight: 8,
  },
  openVisitLabel: {
    fontSize: 11,
    color: '#1E40AF',
    fontWeight: '700',
  },
  openVisitTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 3,
  },
  openVisitMeta: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  warningCard: {
    marginTop: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 6,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 4,
  },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  visitCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  visitHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  visitTitleWrap: {
    flex: 1,
  },
  visitTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  visitMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeNormal: {
    backgroundColor: '#DCFCE7',
  },
  badgeDuplicate: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
  },
  visitMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  visitMetaText: {
    fontSize: 12,
    color: '#64748B',
  },
  visitResult: {
    fontSize: 13,
    color: '#1E293B',
    marginTop: 8,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});

export default HomeScreen;
