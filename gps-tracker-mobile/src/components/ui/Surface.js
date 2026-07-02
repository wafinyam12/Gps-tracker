import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radii, spacing, shadows } from '../../styles/theme';

const Surface = ({ children, style, padded = true, tone = 'default' }) => (
  <View style={[
    styles.base,
    tone === 'muted' && styles.muted,
    padded && styles.padded,
    style,
  ]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
  },
  padded: {
    padding: spacing.lg,
  },
});

export default Surface;
