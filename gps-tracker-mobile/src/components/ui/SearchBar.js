import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { colors, radii, spacing, shadows } from '../../styles/theme';

const SearchBar = ({
  value,
  onChangeText,
  placeholder = 'Cari...',
  onSubmitEditing,
  autoFocus = false,
}) => (
  <View style={styles.wrap}>
    <View style={styles.iconWrap}>
      <Search size={18} color={colors.textSoft} />
    </View>
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor={colors.textSoft}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmitEditing}
      autoCapitalize="none"
      autoCorrect={false}
      autoFocus={autoFocus}
      returnKeyType="search"
    />
    {!!value && (
      <TouchableOpacity style={styles.clearBtn} onPress={() => onChangeText('')}>
        <X size={16} color={colors.textSoft} />
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...shadows.soft,
  },
  iconWrap: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 14,
    color: colors.text,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    marginLeft: spacing.xs,
  },
});

export default SearchBar;
