import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';

const tones = {
  success: [visitColors.success, visitColors.successTint],
  warning: [visitColors.warning, visitColors.warningTint],
  danger: [visitColors.danger, visitColors.dangerTint],
  neutral: [visitColors.primary, visitColors.primaryTint],
};

const VisitStatusBadge = ({ label, tone = 'neutral' }) => {
  const [foreground, background] = tones[tone] || tones.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: visitRadii.pill,
    paddingHorizontal: visitSpacing.md,
    paddingVertical: visitSpacing.xs,
  },
  label: { ...visitType.caption },
});

export default VisitStatusBadge;
