import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../../styles/theme';

const variants = {
  primary: {
    backgroundColor: colors.primary,
    textColor: '#FFFFFF',
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    textColor: colors.primary,
    borderColor: colors.border,
  },
  soft: {
    backgroundColor: colors.primarySoft,
    textColor: colors.primaryDark,
    borderColor: colors.primarySoft,
  },
  destructive: {
    backgroundColor: colors.danger,
    textColor: '#FFFFFF',
    borderColor: colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
    textColor: colors.primary,
    borderColor: 'transparent',
  },
};

const AppButton = ({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  fullWidth = true,
}) => {
  const current = variants[variant] || variants.primary;
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        { backgroundColor: current.backgroundColor, borderColor: current.borderColor },
        !fullWidth && styles.inline,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={current.textColor} />
      ) : (
        <>
          {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
          <Text style={[styles.label, { color: current.textColor }, textStyle]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    borderRadius: radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  inline: {
    alignSelf: 'flex-start',
  },
  disabled: {
    opacity: 0.7,
  },
  iconWrap: {
    marginRight: -2,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
  },
});

export default AppButton;
