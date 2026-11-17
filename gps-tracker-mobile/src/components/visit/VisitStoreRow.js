import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowRight, Navigation } from 'lucide-react-native';
import { canOpenRoute } from '../../utils/maps';
import { getStoreDistanceLabel } from '../../utils/visitStorePresentation';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';

const VisitStoreRow = ({ store, selected, starting, distanceMeters, onSelect, onStart, onRoute }) => {
  const hasCoordinates = canOpenRoute(store);

  return (
    <View style={[styles.card, selected && styles.selected]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Pilih ${store?.name || 'toko'}`}
        disabled={starting}
        onPress={() => onSelect?.(store)}
        activeOpacity={0.85}
        style={styles.main}
      >
        <Text style={styles.code}>{store?.external_bp_code || store?.code || 'Kode SAP belum tersedia'}</Text>
        <Text style={styles.name}>{store?.name || 'Toko'}</Text>
        <Text style={styles.address}>{store?.address || 'Alamat belum tersedia'}</Text>
        <Text style={styles.branch}>{store?.branch || 'Cabang belum tersedia'}</Text>
        <Text style={styles.distance}>{getStoreDistanceLabel(hasCoordinates, distanceMeters)}</Text>
        {store?.geofence_radius ? <Text style={styles.radius}>Radius kunjungan {store.geofence_radius} m</Text> : null}
      </TouchableOpacity>

      <View style={styles.actions}>
        {hasCoordinates ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Rute ke ${store?.name || 'toko'}`}
            disabled={starting}
            onPress={() => onRoute?.(store)}
            style={styles.route}
          >
            <Navigation size={16} color={visitColors.primary} />
            <Text style={styles.routeText}>Rute</Text>
          </TouchableOpacity>
        ) : <View style={styles.routeSpacer} />}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Mulai kunjungan ke ${store?.name || 'toko'}`}
          disabled={starting}
          onPress={() => onStart?.(store)}
          style={[styles.start, starting && styles.disabled]}
        >
          {starting && selected ? (
            <ActivityIndicator size="small" color={visitColors.surface} />
          ) : (
            <>
              <Text style={styles.startText}>Mulai kunjungan</Text>
              <ArrowRight size={16} color={visitColors.surface} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, marginBottom: visitSpacing.sm, overflow: 'hidden' },
  selected: { borderColor: visitColors.primary },
  main: { padding: visitSpacing.card },
  code: { ...visitType.caption, color: visitColors.primary },
  name: { ...visitType.section, color: visitColors.ink, marginTop: visitSpacing.xs },
  address: { ...visitType.body, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  branch: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.sm },
  distance: { ...visitType.caption, color: visitColors.ink, marginTop: visitSpacing.xs },
  radius: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  actions: { borderTopWidth: 1, borderTopColor: visitColors.border, paddingHorizontal: visitSpacing.card, paddingVertical: visitSpacing.sm, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: visitSpacing.sm },
  route: { minHeight: 44, flexDirection: 'row', flexShrink: 0, alignItems: 'center', gap: visitSpacing.xs },
  routeText: { ...visitType.label, color: visitColors.primary },
  routeSpacer: { flex: 1 },
  start: { minHeight: 48, minWidth: 150, flexGrow: 1, flexShrink: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: visitSpacing.xs, borderRadius: visitRadii.control, backgroundColor: visitColors.primary, paddingHorizontal: visitSpacing.md },
  startText: { ...visitType.label, color: visitColors.surface, flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: 0.65 },
});

export default VisitStoreRow;
