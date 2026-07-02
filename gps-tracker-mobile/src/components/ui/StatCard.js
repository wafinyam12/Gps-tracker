import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, shadows } from '../../styles/theme';

const StatCard = ({ label, value, hint, icon, tone = colors.primary, style, valueStyle }) => (
  <View style={[styles.card, style]}>
    <View style={[styles.iconWrap, { backgroundColor: `${tone}18` }]}>
      {icon}
    </View>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, { color: tone }, valueStyle]} numberOfLines={1}>
      {value}
    </Text>
    {!!hint && <Text style={styles.hint}>{hint}</Text>}
  </View>
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 108,
    ...shadows.soft,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.primary,
  },
  hint: {
    marginTop: spacing.xs,
    color: colors.textSoft,
    fontSize: 11,
    lineHeight: 16,
  },
});

export default StatCard;
