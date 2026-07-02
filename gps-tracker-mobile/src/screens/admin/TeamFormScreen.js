import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator } from 'react-native';
import { userService } from '../../api/services/userService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Save, Trash2, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import AppScreen from '../../components/ui/AppScreen';
import PageHeader from '../../components/ui/PageHeader';
import Surface from '../../components/ui/Surface';
import { useAuth } from '../../context/AuthContext';
import { getRoleName } from '../../utils/roles';
import { colors, radii, spacing } from '../../styles/theme';

const TeamFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { teamId } = route.params || {};
  const isEdit = !!teamId;
  const { user } = useAuth();
  const currentRole = getRoleName(user);
  const canDeleteTeam = currentRole === 'superadmin';

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [form, setForm] = useState({
    name: '',
    code: '',
    area: '',
    db_sap: '',
    latitude: '',
    longitude: '',
    is_active: true,
  });

  useEffect(() => {
    if (isEdit) {
      fetchTeamDetail();
    }
  }, []);

  const fetchTeamDetail = async () => {
    try {
      const response = await userService.getTeam(teamId);
      const team = response.data?.data;
      setForm({
        name: team.name,
        code: team.code,
        area: team.area || '',
        db_sap: team.db_sap || '',
        latitude: team.latitude?.toString() || team.location?.latitude?.toString() || '',
        longitude: team.longitude?.toString() || team.location?.longitude?.toString() || '',
        is_active: team.is_active,
      });
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil detail cabang');
      navigation.goBack();
    } finally {
      setInitialLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Izin lokasi diperlukan untuk mengambil koordinat cabang');
      return;
    }

    setLoading(true);
    try {
      const location = await Location.getCurrentPositionAsync({});
      setForm({
        ...form,
        latitude: location.coords.latitude.toString(),
        longitude: location.coords.longitude.toString(),
      });
    } catch (error) {
      Alert.alert('Error', 'Gagal mendapatkan lokasi saat ini');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.code || !form.db_sap || !form.latitude || !form.longitude) {
      Alert.alert('Error', 'Nama, Kode, DB SAP, Latitude, dan Longitude wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        db_sap: form.db_sap.trim().toUpperCase(),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
      };

      if (isEdit) {
        await userService.updateTeam(teamId, payload);
      } else {
        await userService.createTeam(payload);
      }
      Alert.alert('Sukses', `Cabang berhasil ${isEdit ? 'diupdate' : 'dibuat'}`);
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
      'Apakah Anda yakin ingin menghapus cabang ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await userService.deleteTeam(teamId);
              navigation.goBack();
            } catch (error) {
              const msg = error.response?.data?.message || 'Gagal menghapus cabang';
              Alert.alert('Error', msg);
            }
          }
        }
      ]
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
        title={isEdit ? 'Edit Cabang' : 'Cabang Baru'}
        subtitle="Atur identitas cabang, DB SAP, dan titik koordinat operasional."
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
        <Surface style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Informasi Cabang</Text>
            <Text style={styles.sectionHint}>DB SAP akan dipakai saat menarik data customer dan outstanding.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nama Cabang *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(val) => setForm({ ...form, name: val })}
              placeholder="Contoh: Cabang Jakarta Pusat"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Kode Cabang *</Text>
            <TextInput
              style={styles.input}
              value={form.code}
              onChangeText={(val) => setForm({ ...form, code: val })}
              placeholder="Contoh: JKP-01"
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>DB SAP *</Text>
            <TextInput
              style={styles.input}
              value={form.db_sap}
              onChangeText={(val) => setForm({ ...form, db_sap: val })}
              placeholder="Contoh: NEW_KALSEL"
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Area Operasional</Text>
            <TextInput
              style={styles.input}
              value={form.area}
              onChangeText={(val) => setForm({ ...form, area: val })}
              placeholder="Contoh: Jakarta"
            />
          </View>
        </Surface>

        <Surface tone="muted" style={styles.sectionCard}>
          <View style={styles.locationHeader}>
            <View style={styles.locationTitleWrap}>
              <Text style={styles.sectionTitle}>Koordinat Cabang *</Text>
              <Text style={styles.sectionHint}>Simpan titik kantor atau area utama cabang.</Text>
            </View>
            <TouchableOpacity style={styles.locationBtn} onPress={getCurrentLocation} activeOpacity={0.85}>
              <MapPin size={14} color={colors.primary} />
              <Text style={styles.locationBtnText}>Lokasi Saat Ini</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, styles.inputHalf]}>
              <TextInput
                style={styles.input}
                value={form.latitude}
                onChangeText={(val) => setForm({ ...form, latitude: val })}
                placeholder="Latitude"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.inputGroup, styles.inputHalf]}>
              <TextInput
                style={styles.input}
                value={form.longitude}
                onChangeText={(val) => setForm({ ...form, longitude: val })}
                placeholder="Longitude"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </Surface>

        <Surface style={styles.sectionCard}>
          <View style={styles.switchGroup}>
            <View style={styles.switchCopy}>
              <Text style={styles.label}>Status Aktif</Text>
              <Text style={styles.subLabel}>Cabang aktif dapat dipilih untuk user.</Text>
            </View>
            <Switch
              value={form.is_active}
              onValueChange={(val) => setForm({ ...form, is_active: val })}
              trackColor={{ false: colors.surfaceStrong, true: colors.primarySoft }}
              thumbColor={form.is_active ? colors.primary : colors.surface}
            />
          </View>
        </Surface>

        {isEdit && canDeleteTeam && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Trash2 size={20} color={colors.danger} />
            <Text style={styles.deleteBtnText}>Hapus Cabang</Text>
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
  sectionCard: {
    gap: 0,
  },
  sectionHeader: {
    marginBottom: spacing.lg,
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
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputHalf: {
    flex: 1,
    marginBottom: 0,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  locationTitleWrap: {
    flex: 1,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.full,
    flexShrink: 0,
  },
  locationBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
  },
  switchCopy: {
    flex: 1,
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

export default TeamFormScreen;
