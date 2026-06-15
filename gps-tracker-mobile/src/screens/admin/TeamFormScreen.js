import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator } from 'react-native';
import { userService } from '../../api/services/userService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Save, Trash2 } from 'lucide-react-native';

const TeamFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { teamId } = route.params || {};
  const isEdit = !!teamId;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [form, setForm] = useState({
    name: '',
    code: '',
    area: '',
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
        is_active: team.is_active,
      });
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil detail team');
      navigation.goBack();
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.code) {
      Alert.alert('Error', 'Nama dan Kode Team wajib diisi');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await userService.updateTeam(teamId, form);
      } else {
        await userService.createTeam(form);
      }
      Alert.alert('Sukses', `Team berhasil ${isEdit ? 'diupdate' : 'dibuat'}`);
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
      'Apakah Anda yakin ingin menghapus team ini?',
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
              const msg = error.response?.data?.message || 'Gagal menghapus team';
              Alert.alert('Error', msg);
            }
          }
        }
      ]
    );
  };

  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Team' : 'Team Baru'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#1E40AF" />
          ) : (
            <Save size={24} color="#1E40AF" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nama Team *</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(val) => setForm({ ...form, name: val })}
            placeholder="Contoh: Team Jakarta Pusat"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Kode Team *</Text>
          <TextInput
            style={styles.input}
            value={form.code}
            onChangeText={(val) => setForm({ ...form, code: val })}
            placeholder="Contoh: JKP-01"
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

        <View style={styles.switchGroup}>
          <View>
            <Text style={styles.label}>Status Aktif</Text>
            <Text style={styles.subLabel}>Team aktif dapat dipilih untuk user</Text>
          </View>
          <Switch
            value={form.is_active}
            onValueChange={(val) => setForm({ ...form, is_active: val })}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
            thumbColor={form.is_active ? '#1E40AF' : '#F1F5F9'}
          />
        </View>

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Trash2 size={20} color="#EF4444" />
            <Text style={styles.deleteBtnText}>Hapus Team</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  form: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 8,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
});

export default TeamFormScreen;
