import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Navigation } from 'lucide-react-native';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';
import VisitStatusBadge from './VisitStatusBadge';

const VisitStoreSummary = ({ storeName, storeAddress, branch, timeline, status, onRoute }) => (
  <View style={styles.card}>
    <View style={styles.top}>
      <View style={styles.copy}>
        <Text style={styles.label}>Toko yang dikunjungi</Text>
        <Text style={styles.name}>{storeName || 'Toko'}</Text>
      </View>
      <VisitStatusBadge label={status || 'Aktif'} tone={status === 'Selesai' ? 'success' : 'neutral'} />
    </View>
    {storeAddress ? <Text style={styles.address}>{storeAddress}</Text> : null}
    {branch ? <Text style={styles.branch}>{branch}</Text> : null}
    {timeline ? <Text style={styles.timeline}>{timeline}</Text> : null}
    {onRoute ? (
      <TouchableOpacity accessibilityRole="button" onPress={onRoute} style={styles.route}>
        <Navigation size={16} color={visitColors.primary} />
        <Text style={styles.routeText}>Buka rute toko</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, padding: visitSpacing.card },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: visitSpacing.sm },
  copy: { flex: 1, minWidth: 0 },
  label: { ...visitType.caption, color: visitColors.mutedInk },
  name: { ...visitType.section, color: visitColors.ink, marginTop: visitSpacing.xs },
  address: { ...visitType.body, color: visitColors.mutedInk, marginTop: visitSpacing.sm },
  branch: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  timeline: { ...visitType.caption, color: visitColors.ink, marginTop: visitSpacing.sm },
  route: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.xs, marginTop: visitSpacing.sm, borderTopWidth: 1, borderTopColor: visitColors.border },
  routeText: { ...visitType.label, color: visitColors.primary },
});

export default VisitStoreSummary;
