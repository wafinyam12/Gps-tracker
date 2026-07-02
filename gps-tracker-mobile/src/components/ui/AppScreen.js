import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../styles/theme';

const AppScreen = ({ children, style, contentStyle, edges = ['top', 'left', 'right'] }) => (
  <SafeAreaView edges={edges} style={[styles.safe, style]}>
    <View style={[styles.content, contentStyle]}>{children}</View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
    paddingBottom: Platform.OS === 'android' ? 24 : 0,
  },
});

export default AppScreen;
