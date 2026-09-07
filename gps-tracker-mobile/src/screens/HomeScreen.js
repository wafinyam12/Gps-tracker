import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ArrowRight,
  Clock,
  MapPin,
  Navigation,
  PlusCircle,
  User,
  AlertTriangle,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { reportService } from '../api/services/reportService';
import { canVisitStores } from '../utils/roles';
import { canOpenRoute, openMapRoute } from '../utils/maps';
import { getVisitResultLabel } from '../utils/visitOptions';
import PhotoPreviewModal from '../components/PhotoPreviewModal';
import AppScreen from '../components/ui/AppScreen';
import Surface from '../components/ui/Surface';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import AppButton from '../components/ui/AppButton';
import { colors, radii, shadows, spacing } from '../styles/theme';

const HomeScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { isTracking, startTracking } = useLocationTracker();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);
  const [photoPreviewIndex, setPhotoPreviewIndex] = useState(0);
  const [photoPreviewItems, setPhotoPreviewItems] = useState([]);

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
      navigation.navigate('VisitForm', {
        visitLogId: visit.id,
        ...(visit.checkout_at ? { mode: 'detail' } : {}),
      });
    }
  };

  const handleOpenRoute = async (store) => {
    try {
      const opened = await openMapRoute(store);

      if (!opened) {
        Alert.alert('Rute Belum Tersedia', 'Koordinat toko belum tersedia.');
        return;
      }
    } catch (error) {
      console.log('Open route error:', error.message);
      Alert.alert('Gagal Membuka Maps', 'Tidak bisa membuka Google Maps dari perangkat ini.');
    }
  };

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

  const summaryCards = useMemo(() => ([
    {
      label: 'Target',
      value: stats.target_visits ?? 0,
      tone: colors.primary,
      hint: 'Visit harian',
    },
    {
      label: 'Toko Unik',
      value: stats.unique_visits ?? 0,
      tone: colors.success,
      hint: 'Hasil valid',
    },
    {
      label: 'Duplicate',
      value: stats.duplicate_visits ?? 0,
      tone: colors.warning,
      hint: 'Perlu cek ulang',
    },
    {
      label: 'Progress',
      value: `${stats.completion_pct ?? 0}%`,
      tone: colors.purple,
      hint: 'Pencapaian target',
    },
  ]), [stats]);

  const actionTiles = [
    {
      label: openVisit ? 'Lanjut Visit' : 'Mulai Visit',
      icon: <PlusCircle size={18} color={colors.primary} />,
      onPress: handleOpenVisit,
    },
    {
      label: 'Lokasi Saya',
      icon: <Navigation size={18} color={colors.primary} />,
      onPress: () => navigation.navigate('MyLocation'),
    },
    {
      label: 'Ringkasan',
      icon: <Clock size={18} color={colors.primary} />,
      onPress: () => navigation.navigate('MySummary'),
    },
  ];

  if (loading) {
    return (
      <AppScreen>
        <View style={styles.center}>
          <Surface style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Memuat dashboard...</Text>
          </Surface>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        data={visits}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchSummary();
        }}
        ListHeaderComponent={(
          <>
            <Surface style={styles.heroCard}>
              <View style={styles.heroRow}>
                <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
                  {user?.photo ? (
                    <Image source={{ uri: user.photo }} style={styles.profileImage} />
                  ) : (
                    <View style={styles.profileFallback}>
                      <User size={22} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.heroCopy}>
                  <Text style={styles.greeting}>Selamat datang</Text>
                  <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Sales'}</Text>
                  <Text style={styles.userTeam} numberOfLines={1}>
                    {user?.branch?.name || user?.team?.name || 'Tanpa Cabang'}
                  </Text>
                </View>

                <View style={[styles.trackingPill, isTracking ? styles.trackingOn : styles.trackingOff]}>
                  <View style={[styles.dot, { backgroundColor: isTracking ? '#10B981' : '#F43F5E' }]} />
                  <Text style={styles.trackingText}>{isTracking ? 'GPS Aktif' : 'GPS Mati'}</Text>
                </View>
              </View>

              <Text style={styles.heroNote}>
                Fokus ke visit harian, data lokal otomatis tersinkron, dan akses menyesuaikan role Anda.
              </Text>
            </Surface>

            <View style={styles.actionGrid}>
              {actionTiles.map((item) => (
                <TouchableOpacity key={item.label} style={styles.actionTile} onPress={item.onPress}>
                  <View style={styles.actionIcon}>{item.icon}</View>
                  <Text style={styles.actionLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ringkasan Hari Ini</Text>
              <Text style={styles.sectionMeta}>
                {summary?.period?.date || 'Hari ini'}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statsScroll}
            >
              {summaryCards.map((item) => (
                <StatCard
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  hint={item.hint}
                  tone={item.tone}
                  icon={<View style={[styles.statDot, { backgroundColor: item.tone }]} />}
                  style={styles.statCard}
                />
              ))}
            </ScrollView>

            {openVisit && (
              <Surface style={styles.openVisitCard}>
                <View style={styles.openVisitCopy}>
                  <Text style={styles.openVisitLabel}>Visit aktif</Text>
                  <Text style={styles.openVisitTitle} numberOfLines={1}>
                    {openVisit.store?.name || 'Toko'}
                  </Text>
                  <Text style={styles.openVisitMeta} numberOfLines={1}>
                    {openVisit.store?.branch || openVisit.store?.address || 'Detail belum tersedia'}
                  </Text>
                </View>
                <View style={styles.openVisitActions}>
                  {canOpenRoute(openVisit.store) && (
                    <AppButton
                      label="Rute"
                      onPress={() => handleOpenRoute(openVisit.store)}
                      fullWidth={false}
                      variant="soft"
                      icon={<Navigation size={16} color={colors.primary} />}
                    />
                  )}
                  <AppButton
                    label="Buka"
                    onPress={handleOpenVisit}
                    fullWidth={false}
                    variant="secondary"
                    icon={<ArrowRight size={16} color={colors.primary} />}
                  />
                </View>
              </Surface>
            )}

            {warnings.length > 0 && (
              <Surface style={styles.warningCard}>
                <View style={styles.warningHeader}>
                  <AlertTriangle size={18} color={colors.warning} />
                  <Text style={styles.warningTitle}>Audit Warning</Text>
                </View>
                {warnings.slice(0, 2).map((warning, index) => (
                  <Text key={`${warning.date || index}-${index}`} style={styles.warningText}>
                    {warning.message || `Hari ${warning.date} belum mencapai target.`}
                  </Text>
                ))}
              </Surface>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Visit Terbaru</Text>
              <Text style={styles.sectionMeta}>{visits.length} item</Text>
            </View>
          </>
        )}
        renderItem={({ item }) => {
          const isDuplicate = Boolean(item.is_duplicate);
          const isCounted = Boolean(item.counted_as_target);
          const photoPreviews = Array.isArray(item.photos_preview) ? item.photos_preview : [];
          const photoCount = Number(item.photos_count || 0);

          return (
            <TouchableOpacity activeOpacity={0.9} onPress={() => handleVisitPress(item)}>
              <Surface style={styles.visitCard}>
                <View style={styles.visitHeader}>
                  <View style={styles.visitTitleWrap}>
                    <Text style={styles.visitTitle} numberOfLines={1}>{item.store?.name || 'Toko'}</Text>
                    <Text style={styles.visitMeta} numberOfLines={1}>
                      {item.store?.branch || item.store?.address || 'Belum ada detail'}
                    </Text>
                  </View>
                  <View style={[styles.badge, isDuplicate ? styles.badgeDuplicate : styles.badgeNormal]}>
                    <Text style={styles.badgeText}>
                      {isDuplicate ? 'DUPLICATE' : (isCounted ? 'VALID' : 'TIDAK HITUNG')}
                    </Text>
                  </View>
                </View>

                <View style={styles.visitMetaRow}>
                  <MapPin size={14} color={colors.textMuted} />
                  <Text style={styles.visitMetaText}>
                    {item.visit_date || '-'} {item.checkin_at ? `- ${new Date(item.checkin_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </Text>
                </View>

                <Text style={styles.visitResult}>
                  Hasil: {getVisitResultLabel(item.visit_result)}
                </Text>

                {canOpenRoute(item.store) && (
                  <TouchableOpacity
                    style={styles.routeButton}
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      handleOpenRoute(item.store);
                    }}
                    activeOpacity={0.85}
                  >
                    <Navigation size={14} color={colors.primary} />
                    <Text style={styles.routeButtonText}>Rute</Text>
                  </TouchableOpacity>
                )}

                {photoCount > 0 && (
                  <View style={styles.photoSection}>
                    <Text style={styles.photoLabel}>{photoCount} foto</Text>
                    <View style={styles.photoPreviewRow}>
                      {photoPreviews.map((photo, index) => (
                        <TouchableOpacity
                          key={photo.id}
                          activeOpacity={0.9}
                          onPress={(event) => {
                            event?.stopPropagation?.();
                            openPhotoPreview(photoPreviews, index);
                          }}
                        >
                          <Image
                            source={{ uri: photo.url }}
                            style={styles.photoThumb}
                          />
                        </TouchableOpacity>
                      ))}
                      {photoCount > photoPreviews.length && (
                        <View style={[styles.photoThumb, styles.photoThumbMore]}>
                          <Text style={styles.photoThumbMoreText}>
                            +{photoCount - photoPreviews.length}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.detailLinkRow}>
                  <Text style={styles.detailLinkText}>Lihat detail input</Text>
                  <ArrowRight size={14} color={colors.primary} />
                </View>
              </Surface>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={(
          <EmptyState
            title="Belum ada visit tercatat"
            description="Saat Anda memulai visit hari ini, ringkasan dan daftar transaksi akan tampil di sini."
            icon={<Clock size={22} color={colors.primary} />}
            actionLabel={openVisit ? 'Lanjut Visit' : 'Mulai Visit'}
            onAction={handleOpenVisit}
          />
        )}
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
  list: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingCard: {
    alignItems: 'center',
    gap: 12,
    minWidth: 220,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 16,
    ...shadows.card,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileBtn: {
    width: 52,
    height: 52,
  },
  profileFallback: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  profileImage: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroCopy: {
    flex: 1,
  },
  greeting: {
    color: '#BFE3DD',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  userTeam: {
    color: '#D9F3EE',
    fontSize: 13,
    marginTop: 2,
  },
  trackingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  trackingOn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  trackingOff: {
    backgroundColor: 'rgba(244, 63, 94, 0.16)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trackingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  heroNote: {
    marginTop: 14,
    color: '#D9F3EE',
    fontSize: 13,
    lineHeight: 19,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  actionTile: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 132,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  sectionMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
  },
  statsScroll: {
    gap: 10,
    paddingRight: 4,
    marginBottom: 18,
  },
  statCard: {
    width: 154,
    flex: 0,
  },
  statDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  openVisitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  openVisitCopy: {
    flex: 1,
    gap: 4,
  },
  openVisitActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  openVisitLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: colors.warning,
    letterSpacing: 0.4,
  },
  openVisitTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  openVisitMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  warningCard: {
    marginBottom: 16,
    gap: 8,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.warning,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  visitCard: {
    marginBottom: 12,
    gap: 10,
  },
  visitHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  visitTitleWrap: {
    flex: 1,
    gap: 2,
  },
  visitTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  visitMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  badgeNormal: {
    backgroundColor: colors.successSoft,
  },
  badgeDuplicate: {
    backgroundColor: colors.warningSoft,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.4,
  },
  visitMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  visitMetaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  visitResult: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '700',
  },
  routeButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  routeButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  detailLinkRow: {
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLinkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  photoSection: {
    gap: 8,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  photoThumbMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  photoThumbMoreText: {
    color: colors.primary,
    fontWeight: '900',
  },
});

export default HomeScreen;
