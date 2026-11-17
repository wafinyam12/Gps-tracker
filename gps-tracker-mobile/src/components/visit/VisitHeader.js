import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';

const VisitHeader = ({ title, subtitle, onBack, right, status }) => (
  <View style={styles.header}>
    <View style={styles.row}>
      {onBack ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={onBack}
          style={styles.back}
        >
          <ArrowLeft size={20} color={visitColors.primary} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
    {status ? <View style={styles.status}>{status}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  header: {
    backgroundColor: visitColors.surface,
    borderBottomColor: visitColors.border,
    borderBottomWidth: 1,
    paddingHorizontal: visitSpacing.page,
    paddingTop: visitSpacing.sm,
    paddingBottom: visitSpacing.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: visitSpacing.md },
  back: {
    width: 44,
    height: 44,
    borderRadius: visitRadii.control,
    backgroundColor: visitColors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  title: { ...visitType.page, color: visitColors.ink },
  subtitle: { ...visitType.body, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  right: { minWidth: 44, alignItems: 'flex-end' },
  status: { marginTop: visitSpacing.sm },
});

export default VisitHeader;
