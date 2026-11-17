import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowRight, Camera, Navigation } from 'lucide-react-native';
import { canOpenRoute } from '../../utils/maps';
import { getVisitResultLabel } from '../../utils/visitOptions';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';
import VisitStatusBadge from './VisitStatusBadge';

const timeLabel = (visit) => {
  if (!visit?.checkin_at) return visit?.visit_date || '-';
  const parsed = new Date(visit.checkin_at);
  const time = Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return [visit.visit_date, time].filter(Boolean).join(' · ');
};

const VisitHistoryRow = ({ visit, onOpen, onRoute, onPhotoPress }) => {
  const photos = Array.isArray(visit?.photos_preview) ? visit.photos_preview : [];
  const photoCount = Number(visit?.photos_count || 0);
  const badge = visit?.is_duplicate
    ? { label: 'Duplikat', tone: 'warning' }
    : visit?.counted_as_target
      ? { label: 'Terhitung', tone: 'success' }
      : { label: 'Tidak dihitung', tone: 'neutral' };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Buka kunjungan ${visit?.store?.name || 'toko'}`}
        activeOpacity={0.85}
        onPress={() => onOpen?.(visit)}
        style={styles.main}
      >
        <View style={styles.top}>
          <View style={styles.storeCopy}>
            <Text style={styles.storeName}>{visit?.store?.name || 'Toko'}</Text>
            <Text style={styles.address}>{visit?.store?.branch || visit?.store?.address || 'Detail toko belum tersedia'}</Text>
          </View>
          <VisitStatusBadge {...badge} />
        </View>
        <Text style={styles.meta}>{timeLabel(visit)} · {visit?.checkout_at ? 'Selesai' : 'Aktif'}</Text>
        <Text style={styles.result}>Hasil: {getVisitResultLabel(visit?.visit_result)}</Text>
        {visit?.notes ? <Text style={styles.notes} numberOfLines={2}>{visit.notes}</Text> : null}
        <View style={styles.detail}>
          <Text style={styles.detailText}>Lihat detail</Text>
          <ArrowRight size={16} color={visitColors.primary} />
        </View>
      </TouchableOpacity>

      {((onRoute && canOpenRoute(visit?.store)) || photoCount > 0) ? (
        <View style={styles.extra}>
          {onRoute && canOpenRoute(visit?.store) ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => onRoute?.(visit.store)} style={styles.route}>
              <Navigation size={16} color={visitColors.primary} />
              <Text style={styles.routeText}>Rute</Text>
            </TouchableOpacity>
          ) : null}
          {photoCount > 0 ? (
            <View style={styles.photos}>
              <Camera size={16} color={visitColors.mutedInk} />
              <Text style={styles.photoCount}>{photoCount} foto</Text>
              {photos.map((photo, index) => (
                <TouchableOpacity
                  key={photo.id || `${photo.url}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Lihat foto ${index + 1}`}
                  onPress={() => onPhotoPress?.(photos, index)}
                  style={styles.thumbButton}
                >
                  <Image source={{ uri: photo.url }} style={styles.thumb} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: visitColors.surface,
    borderColor: visitColors.border,
    borderWidth: 1,
    borderRadius: visitRadii.card,
    marginBottom: visitSpacing.sm,
    overflow: 'hidden',
  },
  main: { padding: visitSpacing.card },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: visitSpacing.sm },
  storeCopy: { flex: 1, minWidth: 0 },
  storeName: { ...visitType.section, color: visitColors.ink },
  address: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  meta: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.sm },
  result: { ...visitType.body, color: visitColors.ink, marginTop: visitSpacing.xs },
  notes: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  detail: { flexDirection: 'row', alignItems: 'center', gap: visitSpacing.xs, marginTop: visitSpacing.sm },
  detailText: { ...visitType.label, color: visitColors.primary },
  extra: {
    borderTopWidth: 1,
    borderTopColor: visitColors.border,
    paddingHorizontal: visitSpacing.card,
    paddingVertical: visitSpacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: visitSpacing.md,
  },
  route: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.xs },
  routeText: { ...visitType.label, color: visitColors.primary },
  photos: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: visitSpacing.xs },
  photoCount: { ...visitType.caption, color: visitColors.mutedInk, marginRight: visitSpacing.xs },
  thumbButton: { width: 44, height: 44 },
  thumb: { width: 44, height: 44, borderRadius: visitRadii.control },
});

export default VisitHistoryRow;
