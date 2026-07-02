import React, { useCallback, useMemo, useState } from 'react';
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
import { reportService } from '../api/services/reportService';
import { ArrowRight, AlertTriangle, CalendarDays, Clock, Target } from 'lucide-react-native';
import PhotoPreviewModal from '../components/PhotoPreviewModal';
import AppScreen from '../components/ui/AppScreen';
import PageHeader from '../components/ui/PageHeader';

const MySummaryScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);
  const [photoPreviewIndex, setPhotoPreviewIndex] = useState(0);
  const [photoPreviewItems, setPhotoPreviewItems] = useState([]);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await reportService.targetToday();
      setSummary(response.data?.data || response.data || null);
    } catch (error) {
      console.log('Fetch summary error:', error.response?.data || error);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSummary = useCallback(() => {
    setLoading(true);
    fetchSummary();
  }, [fetchSummary]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchSummary();
    }, [fetchSummary])
  );

  const stats = summary?.stats || {};
  const visits = Array.isArray(summary?.visits) ? summary.visits : [];
  const warnings = Array.isArray(summary?.warnings) ? summary.warnings : [];
  const openVisit = summary?.open_visit || null;

  const cards = useMemo(() => ([
    { label: 'Target', value: stats.target_visits ?? 0, icon: <Target size={18} color="#0F766E" /> },
    { label: 'Toko Unik', value: stats.unique_visits ?? 0, icon: <CalendarDays size={18} color="#047857" /> },
    { label: 'Duplicate', value: stats.duplicate_visits ?? 0, icon: <Clock size={18} color="#B45309" /> },
    { label: 'Progress', value: `${stats.completion_pct ?? 0}%`, icon: <ArrowRight size={18} color="#4F46E5" /> },
  ]), [stats]);

  const openPhotoPreview = (items, index = 0) => {
    const normalized = Array.isArray(items) ? items.filter((item) => item?.url) : [];
    if (normalized.length === 0) {
      return;
    }

    setPhotoPreviewItems(normalized);
    setPhotoPreviewIndex(index);
    setPhotoPreviewVisible(true);
  };

  const closePhotoPreview = () => {
    setPhotoPreviewVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  return (
    <AppScreen>
      <PageHeader
        variant="hero"
        eyebrow="Ringkasan"
        title="Ringkasan Saya"
        subtitle="Pantau target harian, visit aktif, dan riwayat terbaru."
        onBack={() => navigation.goBack()}
      />

      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={visits}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={(
          <>
            <View style={styles.cardGrid}>
              {cards.map((item) => (
                <View key={item.label} style={styles.card}>
                  <View style={styles.cardIcon}>{item.icon}</View>
                  <Text style={styles.cardLabel}>{item.label}</Text>
                  <Text style={styles.cardValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            {openVisit && (
              <TouchableOpacity
                style={styles.openVisitCard}
                onPress={() => navigation.navigate('VisitForm', { visitLogId: openVisit.visit_log_id })}
              >
                <View style={styles.openVisitCopy}>
                  <Text style={styles.sectionLabel}>Visit aktif</Text>
                  <Text style={styles.openVisitTitle} numberOfLines={1}>
                    {openVisit.store?.name || 'Toko'}
                  </Text>
                  <Text style={styles.openVisitMeta} numberOfLines={1}>
                    {openVisit.store?.branch || openVisit.store?.address || 'Detail belum tersedia'}
                  </Text>
                </View>
                <ArrowRight size={18} color="#0F766E" />
              </TouchableOpacity>
            )}

            {warnings.length > 0 && (
              <View style={styles.warningCard}>
                <View style={styles.warningHeader}>
                  <AlertTriangle size={18} color="#B45309" />
                  <Text style={styles.warningTitle}>Audit Warning</Text>
                </View>
                {warnings.slice(0, 3).map((warning, index) => (
                  <Text key={`${warning.date || index}-${index}`} style={styles.warningText}>
                    {warning.message || `Hari ${warning.date} belum mencapai target.`}
                  </Text>
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>Visit Terbaru</Text>
          </>
        )}
        renderItem={({ item }) => (
          <View style={styles.visitCard}>
            <View style={styles.visitTopRow}>
              <View style={styles.visitCopy}>
                <Text style={styles.visitTitle}>{item.store?.name || 'Toko'}</Text>
                <Text style={styles.visitMeta}>{item.store?.branch || item.store?.address || '-'}</Text>
              </View>
              <View style={[styles.badge, item.is_duplicate ? styles.badgeDuplicate : styles.badgeNormal]}>
                <Text style={styles.badgeText}>{item.is_duplicate ? 'DUPLICATE' : (item.counted_as_target ? 'VALID' : 'CHECK')}</Text>
              </View>
            </View>

            <Text style={styles.visitInfo}>
              {item.visit_date || '-'} {item.checkin_at ? `- ${new Date(item.checkin_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </Text>
            <Text style={styles.visitInfo}>Hasil: {item.visit_result || 'belum disubmit'}</Text>
            {!!item.notes && <Text style={styles.visitNotes} numberOfLines={2}>{item.notes}</Text>}

            {Number(item.photos_count || 0) > 0 && (
              <View style={styles.photoSection}>
                <Text style={styles.photoLabel}>{item.photos_count} foto</Text>
                <View style={styles.photoPreviewRow}>
                  {(Array.isArray(item.photos_preview) ? item.photos_preview : []).map((photo, index) => (
                    <TouchableOpacity
                      key={photo.id}
                      activeOpacity={0.9}
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        openPhotoPreview(item.photos_preview, index);
                      }}
                    >
                      <Image
                        source={{ uri: photo.url }}
                        style={styles.photoThumb}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Belum ada visit tercatat pada periode ini.</Text>
          </View>
        )}
        refreshing={loading}
        onRefresh={refreshSummary}
        ListFooterComponent={<View style={{ height: 24 }} />}
      />

      <PhotoPreviewModal
        visible={photoPreviewVisible}
        photos={photoPreviewItems}
        initialIndex={photoPreviewIndex}
        title="Foto Kunjungan"
        onClose={closePhotoPreview}
      />
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
  },
  cardIcon: {
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  cardValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  openVisitCard: {
    marginTop: 14,
    backgroundColor: '#E7F1EF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFE3DD',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  openVisitCopy: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#0F766E',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  openVisitTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 4,
  },
  openVisitMeta: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  warningCard: {
    marginTop: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
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
    fontWeight: '800',
    color: '#1E293B',
  },
  visitCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  visitTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  visitCopy: {
    flex: 1,
  },
  visitTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  visitMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  visitInfo: {
    fontSize: 12,
    color: '#475569',
    marginTop: 6,
  },
  visitNotes: {
    fontSize: 12,
    color: '#1E293B',
    marginTop: 8,
    lineHeight: 17,
  },
  photoSection: {
    marginTop: 10,
  },
  photoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 6,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
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
    fontWeight: '800',
    color: '#1E293B',
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

export default MySummaryScreen;
