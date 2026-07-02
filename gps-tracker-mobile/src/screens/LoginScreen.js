import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Lock, MapPin, Navigation, ShieldCheck, User } from 'lucide-react-native';
import AppScreen from '../components/ui/AppScreen';
import Surface from '../components/ui/Surface';
import AppButton from '../components/ui/AppButton';
import { colors, radii, shadows } from '../styles/theme';

const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const { login } = useAuth();

  const highlights = useMemo(() => ([
    { icon: <ShieldCheck size={16} color="#fff" />, label: 'Akun aman' },
    { icon: <MapPin size={16} color="#fff" />, label: 'Tracking lokasi' },
    { icon: <Navigation size={16} color="#fff" />, label: 'Quick visit' },
  ]), []);

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownSeconds(0);
      return undefined;
    }

    const updateCooldown = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownSeconds(remaining);

      if (remaining <= 0) {
        setCooldownUntil(null);
      }
    };

    updateCooldown();
    const intervalId = setInterval(updateCooldown, 1000);

    return () => clearInterval(intervalId);
  }, [cooldownUntil]);

  const formatCountdown = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');

    return `${minutes}:${seconds}`;
  };

  const handleLogin = async () => {
    if (isSubmitting || cooldownSeconds > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(username.trim(), password, 'Mobile Device');

      if (result.success) {
        setCooldownUntil(null);
        Alert.alert('Login Berhasil', 'Selamat datang!');
        return;
      }

      Alert.alert('Login Gagal', result.message);

      if (result.status === 429 && result.retryAfterSeconds && result.retryAfterSeconds > 0) {
        setCooldownUntil(Date.now() + (result.retryAfterSeconds * 1000));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const loginDisabled = isSubmitting || cooldownSeconds > 0;
  const loginTitle = cooldownSeconds > 0
    ? `Coba lagi ${formatCountdown(cooldownSeconds)}`
    : isSubmitting
      ? 'Memproses...'
      : 'Login';

  return (
    <AppScreen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Navigation size={14} color="#fff" />
              <Text style={styles.heroBadgeText}>Field Sales Companion</Text>
            </View>
            <Text style={styles.heroTitle}>
              Login cepat untuk mulai visit, monitoring, dan laporan harian.
            </Text>
           

            <View style={styles.highlightsRow}>
              {highlights.map((item) => (
                <View key={item.label} style={styles.highlightChip}>
                  {item.icon}
                  <Text style={styles.highlightText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <Surface style={styles.formCard}>
            <Text style={styles.formTitle}>Masuk ke akun</Text>
           

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username / Email</Text>
              <View style={styles.inputContainer}>
                <User size={18} color={colors.textSoft} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="contoh: sales-satu atau sales1@gps.test"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={colors.textSoft}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={18} color={colors.textSoft} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={colors.textSoft}
                />
              </View>
            </View>

            <AppButton
              label={loginTitle}
              onPress={handleLogin}
              disabled={loginDisabled}
              loading={isSubmitting}
              style={styles.loginButton}
            />

            {cooldownSeconds > 0 ? (
              <Text style={styles.cooldownText}>
                Terlalu banyak percobaan login. Silakan coba lagi dalam {formatCountdown(cooldownSeconds)}.
              </Text>
            ) : (
              <Text style={styles.helperText}>
                Gunakan username atau email yang terdaftar. Login yang berhasil akan langsung diarahkan sesuai role.
              </Text>
            )}
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: 20,
    ...shadows.card,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  brand: {
    marginTop: 14,
    color: '#D9F3EE',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 8,
    color: '#fff',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 8,
    color: '#D9F3EE',
    fontSize: 13,
    lineHeight: 19,
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  highlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  highlightText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  formCard: {
    gap: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  formSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceMuted,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    minHeight: 50,
    fontSize: 15,
    color: colors.text,
  },
  loginButton: {
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
  cooldownText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.warning,
    textAlign: 'center',
    fontWeight: '700',
  },
});

export default LoginScreen;
