import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { buildVisitLocationAuditRows } from '../../utils/visitLocationAudit';
import { getVisitDurationPresentation } from '../../utils/visitDurationPresentation';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';
import VisitStatusBadge from './VisitStatusBadge';

const VisitLocationAudit = ({ visit, locationStatus, locationStatusLabel, checkinDistance, checkinRadius, store }) => {
  const [expanded, setExpanded] = useState(false);
  if (!visit) return null;

  const tone = locationStatus === 'valid' ? 'success' : locationStatus === 'mock' ? 'danger' : locationStatus === 'outside_radius' ? 'warning' : 'neutral';
  const rows = buildVisitLocationAuditRows({ visit, store, checkinDistance, checkinRadius });
  const duration = getVisitDurationPresentation(visit);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.copy}>
          <Text style={styles.title}>Validasi lokasi check-in</Text>
          <Text style={styles.verdict}>{locationStatusLabel}</Text>
        </View>
        <VisitStatusBadge label={locationStatus === 'valid' ? 'Valid' : locationStatus === 'mock' ? 'GPS tidak valid' : locationStatus === 'outside_radius' ? 'Di luar radius' : 'Belum diketahui'} tone={tone} />
      </View>
      {visit.checkout_at ? (
        <View style={styles.presence}>
          <Text style={styles.presenceTitle}>Waktu di area customer · {duration.statusLabel}</Text>
          <Text style={styles.detailText}>Durasi sesi: {duration.durationLabel}</Text>
          <Text style={styles.detailText}>Estimasi dalam radius: {duration.insideLabel}</Text>
          <Text style={styles.detailText}>Estimasi di luar radius: {duration.outsideLabel}</Text>
          <Text style={styles.detailText}>Tidak terukur: {duration.unmeasuredLabel}</Text>
          <Text style={styles.detailText}>Checkout: {duration.checkoutLabel}</Text>
          <Text style={styles.hint}>Angka ini perkiraan dari sampel GPS, bukan bukti posisi setiap detik.</Text>
        </View>
      ) : null}
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((current) => !current)} style={styles.toggle}>
        <Text style={styles.toggleText}>{expanded ? 'Sembunyikan detail lokasi' : 'Lihat detail lokasi'}</Text>
        {expanded ? <ChevronUp size={18} color={visitColors.primary} /> : <ChevronDown size={18} color={visitColors.primary} />}
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.details}>
          {rows.map((row) => <Text key={row} style={styles.detailText}>{row}</Text>)}
          {locationStatus === 'unknown' && !store?.has_location ? (
            <Text style={styles.hint}>Koordinat toko belum tersedia. Jika check-in memenuhi syarat akurasi, titik ini dapat menjadi observasi awal setelah checkout.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, padding: visitSpacing.card, marginTop: visitSpacing.sm },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: visitSpacing.sm },
  copy: { flex: 1, minWidth: 0 },
  title: { ...visitType.label, color: visitColors.ink },
  verdict: { ...visitType.body, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  toggle: { minHeight: 44, borderTopWidth: 1, borderTopColor: visitColors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: visitSpacing.sm },
  toggleText: { ...visitType.label, color: visitColors.primary },
  details: { paddingTop: visitSpacing.xs, gap: visitSpacing.sm },
  detailText: { ...visitType.caption, color: visitColors.ink },
  hint: { ...visitType.caption, color: visitColors.warning, marginTop: visitSpacing.xs },
  presence: { borderTopWidth: 1, borderTopColor: visitColors.border, marginTop: visitSpacing.sm, paddingTop: visitSpacing.sm, gap: visitSpacing.xs },
  presenceTitle: { ...visitType.label, color: visitColors.ink },
});

export default VisitLocationAudit;
