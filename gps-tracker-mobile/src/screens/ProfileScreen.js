import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Edit3, KeyRound, LogOut, Mail, MapPin, ShieldCheck, User } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getRoleDisplayName, getRoleName } from '../utils/roles';
import { profileService } from '../api/services/profileService';
import AppScreen from '../components/ui/AppScreen';
import PageHeader from '../components/ui/PageHeader';
import Surface from '../components/ui/Surface';
import AppButton from '../components/ui/AppButton';
import { colors, radii, shadows, spacing } from '../styles/theme';

const getErrorMessage = (error, fallback) => {
  const errors = error.response?.data?.errors;
  const firstError = errors && Object.values(errors).flat().filter(Boolean)[0];

  return firstError || error.response?.data?.message || fallback;
};

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, logout, updateStoredUser } = useAuth();
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [passwordExpanded, setPasswordExpanded] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  });

  const roleName = getRoleName(user) || 'member';
  const branchName = user?.branch?.name || user?.team?.name || (roleName === 'superadmin' ? 'Semua cabang' : '-');
  const initials = useMemo(() => {
    const parts = String(user?.name || 'U').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'U';
  }, [user?.name]);

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      username: user?.username || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
  }, [user]);

  const updateProfileField = (field, value) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
  };

  const updatePasswordField = (field, value) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  };

  const handleLogout = async () => {
    Alert.alert('Keluar akun', 'Anda yakin ingin logout dari perangkat ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Izin Dibutuhkan', 'Izinkan akses galeri untuk memilih foto profile.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    setPhotoUploading(true);
    try {
      const response = await profileService.updatePhoto(result.assets[0]);
      const freshUser = response.data?.user;

      if (freshUser) {
        await updateStoredUser(freshUser);
      }

      Alert.alert('Sukses', 'Foto profile berhasil diperbarui.');
    } catch (error) {
      Alert.alert('Gagal', getErrorMessage(error, 'Gagal mengupload foto profile.'));
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim() || !profileForm.username.trim() || !profileForm.email.trim()) {
      Alert.alert('Lengkapi Data', 'Nama, username, dan email wajib diisi.');
      return;
    }

    setProfileSaving(true);
    try {
      const response = await profileService.updateProfile({
        name: profileForm.name.trim(),
        username: profileForm.username.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
      });
      const freshUser = response.data?.user;

      if (freshUser) {
        await updateStoredUser(freshUser);
      }

      setProfileExpanded(false);
      Alert.alert('Sukses', 'Profile berhasil diperbarui.');
    } catch (error) {
      Alert.alert('Gagal', getErrorMessage(error, 'Gagal menyimpan profile.'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current_password || !passwordForm.password || !passwordForm.password_confirmation) {
      Alert.alert('Lengkapi Data', 'Password lama, password baru, dan konfirmasi wajib diisi.');
      return;
    }

    if (passwordForm.password.length < 8) {
      Alert.alert('Password Kurang', 'Password baru minimal 8 karakter.');
      return;
    }

    if (passwordForm.password !== passwordForm.password_confirmation) {
      Alert.alert('Konfirmasi Tidak Sama', 'Konfirmasi password baru tidak sama.');
      return;
    }

    setPasswordSaving(true);
    try {
      await profileService.changePassword(passwordForm);
      setPasswordForm({
        current_password: '',
        password: '',
        password_confirmation: '',
      });
      setPasswordExpanded(false);
      Alert.alert('Sukses', 'Password berhasil diperbarui.');
    } catch (error) {
      Alert.alert('Gagal', getErrorMessage(error, 'Gagal mengubah password.'));
    } finally {
      setPasswordSaving(false);
    }
  };

  const infoRows = [
    { label: 'Username', value: user?.username || '-', icon: <User size={16} color={colors.primary} /> },
    { label: 'Email', value: user?.email || '-', icon: <Mail size={16} color={colors.primary} /> },
    { label: 'Role', value: getRoleDisplayName(roleName), icon: <ShieldCheck size={16} color={colors.primary} /> },
    { label: 'Cabang', value: branchName, icon: <MapPin size={16} color={colors.primary} /> },
  ];

  return (
    <AppScreen>
      <PageHeader
        title="Profil Saya"
        subtitle="Kelola identitas akun dan keluar dari session jika selesai."
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Surface style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handlePickPhoto}
              disabled={photoUploading}
              activeOpacity={0.85}
            >
              {photoUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Camera size={15} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{user?.name || 'Sales'}</Text>
          <Text style={styles.username}>{user?.username ? `@${user.username}` : ''}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{getRoleDisplayName(roleName)}</Text>
          </View>
        </Surface>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, profileExpanded && styles.actionButtonActive]}
            onPress={() => setProfileExpanded((value) => !value)}
            activeOpacity={0.85}
          >
            <Edit3 size={16} color={profileExpanded ? '#fff' : colors.primary} />
            <Text style={[styles.actionButtonText, profileExpanded && styles.actionButtonTextActive]}>
              Edit Profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, passwordExpanded && styles.actionButtonActive]}
            onPress={() => setPasswordExpanded((value) => !value)}
            activeOpacity={0.85}
          >
            <KeyRound size={16} color={passwordExpanded ? '#fff' : colors.primary} />
            <Text style={[styles.actionButtonText, passwordExpanded && styles.actionButtonTextActive]}>
              Ubah Password
            </Text>
          </TouchableOpacity>
        </View>

        {profileExpanded && (
          <Surface style={styles.formCard}>
            <Text style={styles.formTitle}>Edit Profile</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nama Lengkap</Text>
              <TextInput
                style={styles.input}
                value={profileForm.name}
                onChangeText={(value) => updateProfileField('name', value)}
                placeholder="Nama lengkap"
                placeholderTextColor={colors.textSoft}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={profileForm.username}
                onChangeText={(value) => updateProfileField('username', value)}
                placeholder="username"
                placeholderTextColor={colors.textSoft}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={profileForm.email}
                onChangeText={(value) => updateProfileField('email', value)}
                placeholder="email@contoh.com"
                placeholderTextColor={colors.textSoft}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>No HP</Text>
              <TextInput
                style={styles.input}
                value={profileForm.phone}
                onChangeText={(value) => updateProfileField('phone', value)}
                placeholder="0812..."
                placeholderTextColor={colors.textSoft}
                keyboardType="phone-pad"
              />
            </View>
            <AppButton
              label="Simpan Profile"
              onPress={handleSaveProfile}
              loading={profileSaving}
              icon={<Edit3 size={16} color="#fff" />}
            />
          </Surface>
        )}

        {passwordExpanded && (
          <Surface style={styles.formCard}>
            <Text style={styles.formTitle}>Ubah Password</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password Lama</Text>
              <TextInput
                style={styles.input}
                value={passwordForm.current_password}
                onChangeText={(value) => updatePasswordField('current_password', value)}
                placeholder="Password saat ini"
                placeholderTextColor={colors.textSoft}
                secureTextEntry
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password Baru</Text>
              <TextInput
                style={styles.input}
                value={passwordForm.password}
                onChangeText={(value) => updatePasswordField('password', value)}
                placeholder="Minimal 8 karakter"
                placeholderTextColor={colors.textSoft}
                secureTextEntry
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Konfirmasi Password Baru</Text>
              <TextInput
                style={styles.input}
                value={passwordForm.password_confirmation}
                onChangeText={(value) => updatePasswordField('password_confirmation', value)}
                placeholder="Ulangi password baru"
                placeholderTextColor={colors.textSoft}
                secureTextEntry
              />
            </View>
            <AppButton
              label="Ubah Password"
              onPress={handleChangePassword}
              loading={passwordSaving}
              icon={<KeyRound size={16} color="#fff" />}
            />
          </Surface>
        )}

        <View style={styles.infoGrid}>
          {infoRows.map((item) => (
            <Surface key={item.label} style={styles.infoCard}>
              <View style={styles.infoIcon}>{item.icon}</View>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue} numberOfLines={2}>{item.value}</Text>
            </Surface>
          ))}
        </View>

        <Surface style={styles.noteCard}>
          <Text style={styles.noteTitle}>Catatan akun</Text>
          <Text style={styles.noteText}>
            Session tersimpan aman di perangkat dan akan dipakai ulang saat aplikasi dibuka kembali.
          </Text>
        </Surface>

        <AppButton
          label="Logout"
          onPress={handleLogout}
          variant="destructive"
          icon={<LogOut size={18} color="#fff" />}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 28,
  },
  heroCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: radii.full,
    ...shadows.card,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: radii.full,
  },
  avatarFallback: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  cameraButton: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  username: {
    fontSize: 13,
    color: colors.textMuted,
  },
  roleBadge: {
    marginTop: 2,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
  },
  actionButtonTextActive: {
    color: '#fff',
  },
  formCard: {
    gap: spacing.md,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoCard: {
    width: '48%',
    gap: 6,
    minHeight: 112,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    fontWeight: '800',
  },
  noteCard: {
    gap: 8,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  logoutBtn: {
    marginTop: 4,
  },
});

export default ProfileScreen;
