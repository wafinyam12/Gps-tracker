import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { userService } from '../../api/services/userService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Save, Trash2 } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import AppScreen from '../../components/ui/AppScreen';
import PageHeader from '../../components/ui/PageHeader';
import Surface from '../../components/ui/Surface';
import { useAuth } from '../../context/AuthContext';
import { normalizePhoneNumber } from '../../utils/phone';
import { getRoleName } from '../../utils/roles';
import { colors, radii, spacing } from '../../styles/theme';

const UserFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params || {};
  const isEdit = !!userId;
  const { user: currentUser } = useAuth();
  const currentRole = getRoleName(currentUser);
  const isSuperAdmin = currentRole === 'superadmin';
  const isBranchAdmin = currentRole === 'admin';
  const currentBranchId = currentUser?.branch?.id?.toString() || currentUser?.team?.id?.toString() || '';

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    employee_id: '',
    slpCode: '',
    team_id: '',
    role: 'sales',
    is_active: true,
  });

  useEffect(() => {
    fetchTeams();
    if (isEdit) {
      fetchUserDetail();
    }
  }, []);

  useEffect(() => {
    if (!isBranchAdmin || !currentBranchId) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      role: 'sales',
      team_id: currentBranchId,
    }));
  }, [currentBranchId, isBranchAdmin]);

  const fetchTeams = async () => {
    try {
      const response = await userService.getTeams({ per_page: 100 });
      const payload = response.data?.data;
      setTeams(Array.isArray(payload) ? payload : payload?.data || []);
    } catch (error) {
      console.log('Error fetching teams', error);
    }
  };

  const fetchUserDetail = async () => {
    try {
      const response = await userService.getUser(userId);
      const user = response.data?.data;
      setForm({
        name: user.name,
        username: user.username || '',
        email: user.email,
        password: '',
        phone: user.phone || '',
        employee_id: user.employee_id || '',
        slpCode: user.slp_code || user.slpCode || '',
        team_id: user.branch?.id?.toString() || user.team?.id?.toString() || '',
        role: user.role || user.roles?.[0]?.name || 'sales',
        is_active: user.is_active,
      });
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil detail user');
      navigation.goBack();
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();
    const trimmedUsername = form.username.trim();
    const trimmedEmail = form.email.trim();
    const trimmedPassword = form.password.trim();
    const trimmedEmployeeId = form.employee_id.trim();
    const trimmedSlpCode = form.slpCode.trim();
    const normalizedPhone = normalizePhoneNumber(form.phone);
    const resolvedTeamId = isBranchAdmin ? currentBranchId : form.team_id;

    if (!trimmedName || !trimmedUsername || !trimmedEmail || (!isEdit && !trimmedPassword)) {
      Alert.alert('Error', 'Nama, Username, Email, dan Password wajib diisi');
      return;
    }

    if (isSuperAdmin && ['sales', 'spv', 'admin'].includes(form.role) && !resolvedTeamId) {
      Alert.alert('Error', 'Cabang wajib dipilih untuk role ini');
      return;
    }

    if (isBranchAdmin && !resolvedTeamId) {
      Alert.alert('Error', 'Cabang admin belum ditentukan');
      return;
    }

    if (form.role === 'sales' && !trimmedSlpCode) {
      Alert.alert('Error', 'Kode sales SAP wajib diisi untuk role Sales');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        name: trimmedName,
        username: trimmedUsername,
        email: trimmedEmail,
        password: trimmedPassword,
        phone: normalizedPhone,
        employee_id: trimmedEmployeeId,
        slpCode: form.role === 'sales' ? trimmedSlpCode : null,
        team_id: isBranchAdmin ? currentBranchId : (['sales', 'spv', 'admin'].includes(form.role) ? form.team_id : ''),
      };

      if (isEdit) {
        await userService.updateUser(userId, payload);
      } else {
        await userService.createUser(payload);
      }
      Alert.alert('Sukses', `User berhasil ${isEdit ? 'diupdate' : 'dibuat'}`);
      navigation.goBack();
    } catch (error) {
      const msg = error.response?.data?.message || 'Terjadi kesalahan saat menyimpan data';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Konfirmasi Hapus',
      'Apakah Anda yakin ingin menghapus user ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await userService.deleteUser(userId);
              navigation.goBack();
            } catch (error) {
              const msg = error.response?.data?.message || 'Gagal menghapus user';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  };

  if (initialLoading) {
    return (
      <AppScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PageHeader
        title={isEdit ? 'Edit User' : 'User Baru'}
        subtitle={isBranchAdmin
          ? 'Admin cabang hanya dapat mengelola sales di cabangnya.'
          : 'Atur identitas, akses, role, dan cabang user.'}
        onBack={() => navigation.goBack()}
        right={(
          <TouchableOpacity style={styles.savePill} onPress={handleSave} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Save size={16} color={colors.primary} />
                <Text style={styles.savePillText}>Simpan</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      />

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <Surface tone="muted" style={styles.banner}>
          <Text style={styles.bannerTitle}>{isEdit ? 'Edit data user' : 'User baru'}</Text>
          <Text style={styles.bannerText}>
            {isEdit
              ? 'Perbarui data yang diperlukan saja. Password boleh dikosongkan jika tidak berubah.'
              : 'Isi data dasar dulu, lalu tentukan role dan cabang sebelum menyimpan.'}
          </Text>
        </Surface>

        <Surface style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Identitas</Text>
            <Text style={styles.sectionHint}>Data dasar yang dipakai untuk mengenali akun.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nama Lengkap *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(val) => setForm({ ...form, name: val })}
              placeholder="Contoh: John Doe"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username *</Text>
            <TextInput
              style={styles.input}
              value={form.username}
              onChangeText={(val) => setForm({ ...form, username: val })}
              placeholder="Contoh: john-doe"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(val) => setForm({ ...form, email: val })}
              placeholder="johndoe@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>NIK / Employee ID</Text>
            <TextInput
              style={styles.input}
              value={form.employee_id}
              onChangeText={(val) => setForm({ ...form, employee_id: val })}
              placeholder="Contoh: 123456"
            />
          </View>
        </Surface>

        <Surface style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Kontak & Akses</Text>
            <Text style={styles.sectionHint}>Nomor telepon dan password login.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nomor Telepon</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(val) => setForm({ ...form, phone: val })}
              placeholder="0812..."
              keyboardType="phone-pad"
            />
            <Text style={styles.subLabel}>Akan disimpan dalam format +62 jika diawali 0.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{isEdit ? 'Password (Kosongkan jika tidak diubah)' : 'Password *'}</Text>
            <TextInput
              style={styles.input}
              value={form.password}
              onChangeText={(val) => setForm({ ...form, password: val })}
              placeholder="Minimal 8 karakter"
              secureTextEntry
            />
            <Text style={styles.subLabel}>
              {isEdit ? 'Kosongkan jika hanya memperbarui data lain.' : 'Wajib diisi untuk user baru.'}
            </Text>
          </View>
        </Surface>

        <Surface style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Penugasan</Text>
            <Text style={styles.sectionHint}>Role menentukan akses, cabang menentukan area kerja.</Text>
          </View>

          {isBranchAdmin ? (
            <View style={styles.infoBox}>
              <Text style={styles.label}>Role</Text>
              <Text style={styles.subLabel}>Admin cabang hanya dapat mengelola user sales di cabangnya sendiri.</Text>
              <Text style={[styles.label, { marginTop: 12 }]}>Cabang</Text>
              <Text style={styles.branchText}>{currentUser?.branch?.name || currentUser?.team?.name || 'Cabang Anda'}</Text>
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Role *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.role}
                  onValueChange={(val) => setForm({
                    ...form,
                    role: val,
                    team_id: ['sales', 'spv', 'admin'].includes(val) ? form.team_id : '',
                    slpCode: val === 'sales' ? form.slpCode : '',
                  })}
                >
                  <Picker.Item label="Sales" value="sales" />
                  <Picker.Item label="Area Manager" value="spv" />
                  <Picker.Item label="Manager" value="manager" />
                  <Picker.Item label="Admin Cabang" value="admin" />
                  <Picker.Item label="Super Admin" value="superadmin" />
                </Picker>
              </View>
            </View>
          )}

          {form.role === 'sales' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kode Sales SAP *</Text>
              <TextInput
                style={styles.input}
                value={form.slpCode}
                onChangeText={(val) => setForm({ ...form, slpCode: val })}
                placeholder="Contoh: 48"
                autoCapitalize="characters"
              />
              <Text style={styles.subLabel}>Dipakai untuk mengambil customer dan outstanding dari SAP.</Text>
            </View>
          )}

          {isBranchAdmin ? (
            <View style={styles.infoBox}>
              <Text style={styles.label}>Cabang</Text>
              <Text style={styles.subLabel}>User akan otomatis terikat ke cabang admin ini.</Text>
            </View>
          ) : form.role === 'manager' || form.role === 'superadmin' ? (
            <View style={styles.infoBox}>
              <Text style={styles.label}>Cabang</Text>
              <Text style={styles.subLabel}>
                {form.role === 'manager'
                  ? 'Manager tidak terikat ke cabang tertentu.'
                  : 'Super admin tidak wajib terikat ke cabang tertentu.'}
              </Text>
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cabang{['sales', 'spv', 'admin'].includes(form.role) ? ' *' : ''}</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.team_id}
                  onValueChange={(val) => setForm({ ...form, team_id: val })}
                >
                  <Picker.Item label="Pilih Cabang" value="" />
                  {teams.map((team) => (
                    <Picker.Item key={team.id} label={team.name} value={team.id.toString()} />
                  ))}
                </Picker>
              </View>
            </View>
          )}

          <View style={styles.switchGroup}>
            <View>
              <Text style={styles.label}>Status Aktif</Text>
              <Text style={styles.subLabel}>User dapat login jika aktif</Text>
            </View>
            <Switch
              value={form.is_active}
              onValueChange={(val) => setForm({ ...form, is_active: val })}
              trackColor={{ false: colors.surfaceStrong, true: colors.primarySoft }}
              thumbColor={form.is_active ? colors.primary : colors.surface}
            />
          </View>
        </Surface>

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Trash2 size={20} color={colors.danger} />
            <Text style={styles.deleteBtnText}>Hapus User</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  savePillText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  banner: {
    gap: 6,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  sectionCard: {
    gap: 0,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  sectionHint: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSoft,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  subLabel: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textSoft,
    lineHeight: 17,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  pickerContainer: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  infoBox: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  branchText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: 4,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: '#FFF8F8',
  },
  deleteBtnText: {
    color: colors.danger,
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});

export default UserFormScreen;
