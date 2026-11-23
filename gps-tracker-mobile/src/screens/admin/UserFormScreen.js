import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
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
import VisitHeader from '../../components/visit/VisitHeader';
import Surface from '../../components/ui/Surface';
import PasswordInput from '../../components/ui/PasswordInput';
import { useAuth } from '../../context/AuthContext';
import { normalizePhoneNumber } from '../../utils/phone';
import { formatUserValidationError, getUserFieldErrors } from '../../utils/userFormValidation';
import { acceptsSapCode, requiresSapCode, sapCodeForPayload } from '../../utils/userSapCode';
import { getRoleName } from '../../utils/roles';
import { colors, radii, spacing } from '../../styles/theme';
import { logEvent } from '../../utils/diagnosticLogger';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';

const FieldError = ({ message }) => message ? <Text style={styles.fieldError}>{message}</Text> : null;

const UserFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params || {};
  const isEdit = !!userId;
  const { user: currentUser } = useAuth();
  const currentRole = getRoleName(currentUser);
  const isSuperAdmin = currentRole === 'superadmin';
  const isBranchAdmin = currentRole === 'admin';
  const isEditingSelf = isEdit && String(currentUser?.id) === String(userId);
  const currentBranchId = currentUser?.branch?.id?.toString() || currentUser?.team?.id?.toString() || '';

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveError, setSaveError] = useState('');
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

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    setSaveError('');
  };

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
      logEvent('admin.user_form_branches_load_failed', { status: error.response?.status, error_code: error?.code });
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
      logEvent('admin.user_load_failed', { status: error.response?.status, error_code: error?.code });
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

    if (requiresSapCode(form.role) && !trimmedSlpCode) {
      Alert.alert('Error', 'Kode sales SAP wajib diisi untuk role Sales');
      return;
    }

    setLoading(true);
    setFieldErrors({});
    setSaveError('');
    logEvent('admin.user_save_started', { action: isEdit ? 'update' : 'create' });
    try {
      const payload = {
        ...form,
        name: trimmedName,
        username: trimmedUsername,
        email: trimmedEmail,
        password: trimmedPassword,
        phone: normalizedPhone,
        employee_id: trimmedEmployeeId,
        slpCode: sapCodeForPayload(form.role, trimmedSlpCode),
        team_id: isBranchAdmin ? currentBranchId : (['sales', 'spv', 'admin'].includes(form.role) ? form.team_id : ''),
      };

      if (isEdit) {
        await userService.updateUser(userId, payload);
      } else {
        await userService.createUser(payload);
      }
      logEvent('admin.user_save_succeeded', { action: isEdit ? 'update' : 'create' });
      Alert.alert('Sukses', `User berhasil ${isEdit ? 'diupdate' : 'dibuat'}`);
      navigation.goBack();
    } catch (error) {
      logEvent('admin.user_save_failed', { action: isEdit ? 'update' : 'create', status: error.response?.status, error_code: error?.code });
      const msg = formatUserValidationError(error.response?.data);
      const errors = getUserFieldErrors(error.response?.data);
      setFieldErrors(errors);
      setSaveError(Object.keys(errors).length > 0 ? 'Periksa kolom yang ditandai sebelum menyimpan.' : msg);
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
              logEvent('admin.user_delete_succeeded');
              navigation.goBack();
            } catch (error) {
              logEvent('admin.user_delete_failed', { status: error.response?.status, error_code: error?.code });
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
      <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      <VisitHeader
        title={isEdit ? 'Edit user' : 'User baru'}
        subtitle={isBranchAdmin
          ? 'Akun Sales cabang Anda'
          : 'Identitas, akses, dan penugasan'}
        onBack={() => navigation.goBack()}
        right={(
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Simpan user" style={styles.savePill} onPress={handleSave} disabled={loading} activeOpacity={0.85}>
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

      <KeyboardAvoidingView style={styles.form} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.form} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Surface tone="muted" style={styles.banner}>
          <Text style={styles.bannerTitle}>{isEdit ? 'Edit data user' : 'User baru'}</Text>
          <Text style={styles.bannerText}>
            {isEdit
              ? 'Perbarui data yang diperlukan saja. Password boleh dikosongkan jika tidak berubah.'
              : 'Isi data dasar dulu, lalu tentukan role dan cabang sebelum menyimpan.'}
          </Text>
        </Surface>

        {saveError ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{saveError}</Text></View> : null}

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
              onChangeText={(val) => updateField('name', val)}
              placeholder="Contoh: John Doe"
            />
            <FieldError message={fieldErrors.name} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username *</Text>
            <TextInput
              style={styles.input}
              value={form.username}
              onChangeText={(val) => updateField('username', val)}
              placeholder="Contoh: john-doe"
              autoCapitalize="none"
            />
            <FieldError message={fieldErrors.username} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(val) => updateField('email', val)}
              placeholder="johndoe@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FieldError message={fieldErrors.email} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>NIK / Employee ID</Text>
            <TextInput
              style={styles.input}
              value={form.employee_id}
              onChangeText={(val) => updateField('employee_id', val)}
              placeholder="Contoh: 123456"
            />
            <FieldError message={fieldErrors.employee_id} />
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
              onChangeText={(val) => updateField('phone', val)}
              placeholder="0812..."
              keyboardType="phone-pad"
            />
            <FieldError message={fieldErrors.phone} />
            <Text style={styles.subLabel}>Akan disimpan dalam format +62 jika diawali 0.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{isEdit ? 'Password (Kosongkan jika tidak diubah)' : 'Password *'}</Text>
            <PasswordInput
              label="password user"
              style={styles.input}
              value={form.password}
              onChangeText={(val) => updateField('password', val)}
              placeholder="Minimal 8 karakter"
            />
            <FieldError message={fieldErrors.password} />
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
                  onValueChange={(val) => {
                    setForm({
                      ...form,
                      role: val,
                      team_id: ['sales', 'spv', 'admin'].includes(val) ? form.team_id : '',
                      slpCode: acceptsSapCode(val) ? form.slpCode : '',
                    });
                    setFieldErrors((previous) => ({ ...previous, role: undefined, team_id: undefined }));
                    setSaveError('');
                  }}
                >
                  <Picker.Item label="Sales" value="sales" />
                  <Picker.Item label="Area Manager" value="spv" />
                  <Picker.Item label="Manager" value="manager" />
                  <Picker.Item label="Admin Cabang" value="admin" />
                  <Picker.Item label="Super Admin" value="superadmin" />
                </Picker>
              </View>
              <FieldError message={fieldErrors.role} />
            </View>
          )}

          {acceptsSapCode(form.role) && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kode Sales SAP{requiresSapCode(form.role) ? ' *' : ' (opsional)'}</Text>
              <TextInput
                style={styles.input}
                value={form.slpCode}
                onChangeText={(val) => updateField('slpCode', val)}
                placeholder="Contoh: 48"
                autoCapitalize="characters"
              />
              <FieldError message={fieldErrors.slpCode} />
              <Text style={styles.subLabel}>
                {form.role === 'spv'
                  ? 'Isi jika Area Manager mempunyai customer SAP atas nama sendiri.'
                  : 'Dipakai untuk mengambil customer dan outstanding dari SAP.'}
              </Text>
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
                  onValueChange={(val) => updateField('team_id', val)}
                >
                  <Picker.Item label="Pilih Cabang" value="" />
                  {teams.map((team) => (
                    <Picker.Item key={team.id} label={team.name} value={team.id.toString()} />
                  ))}
                </Picker>
              </View>
              <FieldError message={fieldErrors.team_id} />
            </View>
          )}

          {isEditingSelf ? (
            <View style={styles.infoBox}>
              <Text style={styles.label}>Status Aktif</Text>
              <Text style={styles.subLabel}>Akun Anda tidak dapat dinonaktifkan dari layar ini.</Text>
            </View>
          ) : (
            <View style={styles.switchGroup}>
              <View>
                <Text style={styles.label}>Status Aktif</Text>
                <Text style={styles.subLabel}>User dapat login jika aktif</Text>
              </View>
              <Switch
                value={form.is_active}
                onValueChange={(val) => updateField('is_active', val)}
                trackColor={{ false: colors.surfaceStrong, true: colors.primarySoft }}
                thumbColor={form.is_active ? colors.primary : colors.surface}
              />
              <FieldError message={fieldErrors.is_active} />
            </View>
          )}
        </Surface>

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Trash2 size={20} color={colors.danger} />
            <Text style={styles.deleteBtnText}>Hapus User</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas },
  screenContent: { paddingTop: 0, paddingBottom: 0 },
  errorBanner: { padding: visitSpacing.card, borderRadius: visitRadii.card, backgroundColor: visitColors.dangerTint },
  errorBannerText: { ...visitType.body, color: visitColors.danger },
  fieldError: { ...visitType.caption, color: visitColors.danger, marginTop: visitSpacing.xs, flexBasis: '100%' },
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
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: visitRadii.control,
    backgroundColor: visitColors.primaryTint,
    borderWidth: 1,
    borderColor: visitColors.primaryTint,
  },
  savePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: visitColors.primary,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: visitSpacing.page,
    paddingBottom: visitSpacing.sectionLarge,
    gap: visitSpacing.md,
  },
  banner: {
    gap: 6,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: visitColors.ink,
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
    fontWeight: '600',
    color: visitColors.ink,
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
    flexWrap: 'wrap',
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
