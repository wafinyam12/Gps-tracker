import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { colors, radii, spacing, shadows } from '../../styles/theme';

const PageHeader = ({
  title,
  subtitle,
  eyebrow,
  onBack,
  right,
  variant = 'surface',
  compact = false,
  style,
  titleStyle,
  subtitleStyle,
}) => {
  const isHero = variant === 'hero';

  return (
    <View style={[
      styles.container,
      isHero ? styles.hero : styles.surface,
      compact && styles.compact,
      style,
    ]}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity
            style={[styles.backButton, isHero && styles.backButtonHero]}
            onPress={onBack}
            activeOpacity={0.85}
          >
            <ArrowLeft size={18} color={isHero ? '#fff' : colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backSpacer} />
        )}

        <View style={styles.copy}>
          {!!eyebrow && (
            <Text style={[styles.eyebrow, isHero && styles.eyebrowHero]}>{eyebrow}</Text>
          )}
          <Text style={[styles.title, isHero && styles.titleHero, titleStyle]} numberOfLines={2}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[styles.subtitle, isHero && styles.subtitleHero, subtitleStyle]} numberOfLines={3}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.rightSlot}>
          {right}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  hero: {
    backgroundColor: colors.primaryDark,
    ...shadows.card,
  },
  surface: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.soft,
  },
  compact: {
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  backButtonHero: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  backSpacer: {
    width: 38,
    height: 38,
  },
  copy: {
    flex: 1,
    gap: 4,
    paddingTop: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  eyebrowHero: {
    color: colors.primarySoft,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.text,
  },
  titleHero: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  subtitleHero: {
    color: '#D5E7E3',
  },
  rightSlot: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 40,
  },
});

export default PageHeader;
