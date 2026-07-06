import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Navigation } from 'lucide-react-native';
import AppScreen from '../components/ui/AppScreen';
import Surface from '../components/ui/Surface';
import { colors, radii, shadows } from '../styles/theme';

const LoadingScreen = () => {
  return (
    <AppScreen>
      <View style={styles.container}>
        <Surface style={styles.card}>
          <View style={styles.brandMark}>
            <Navigation size={22} color="#fff" />
          </View>
          <Text style={styles.title}>Sales Daily</Text>
          <Text style={styles.subtitle}>Menyiapkan session, sinkronisasi data, dan akses role Anda.</Text>

          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Memuat aplikasi...</Text>
        </Surface>
      </View>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 14,
    ...shadows.card,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
  },
});

export default LoadingScreen;
