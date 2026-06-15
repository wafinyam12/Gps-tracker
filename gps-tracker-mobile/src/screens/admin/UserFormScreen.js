import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator } from 'react-native';
import { userService } from '../../api/services/userService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Save, Trash2 } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';

const UserFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params || {};
  const isEdit = !!userId;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    employee_id: '',
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

  const fetchTeams = async () => {
    try {
      const response = await userService.getTeams();
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
        email: user.email,
        password: '',
        phone: user.phone || '',
        employee_id: user.employee_id || '',
        team_id: user.team?.id?.toString() || '',
        role: user.roles?.[0]?.name || 'sales',
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
    if (!form.name || !form.email || (!isEdit && !form.password)) {
      Alert.alert('Error', 'Nama, Email, dan Password wajib diisi');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await userService.updateUser(userId, form);
      } else {
        await userService.createUser(form);
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
              Alert.alert('Error', 'Gagal menghapus user');
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
        <Text style={styles.headerTitle}>{isEdit ? 'Edit User' : 'User Baru'}</Text>
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
          <Text style={styles.label}>Nama Lengkap *</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(val) => setForm({ ...form, name: val })}
            placeholder="Contoh: John Doe"
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
          <Text style={styles.label}>{isEdit ? 'Password (Kosongkan jika tidak diubah)' : 'Password *'}</Text>
          <TextInput
            style={styles.input}
            value={form.password}
            onChangeText={(val) => setForm({ ...form, password: val })}
            placeholder="Minimal 8 karakter"
            secureTextEntry
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nomor Telepon</Text>
          <TextInput
            style={styles.input}
            value={form.phone}
            onChangeText={(val) => setForm({ ...form, phone: val })}
            placeholder="0812..."
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Role *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={form.role}
              onValueChange={(val) => setForm({ ...form, role: val })}
            >
              <Picker.Item label="Sales" value="sales" />
              <Picker.Item label="Supervisor" value="spv" />
              <Picker.Item label="Admin" value="admin" />
            </Picker>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Team</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={form.team_id}
              onValueChange={(val) => setForm({ ...form, team_id: val })}
            >
              <Picker.Item label="Tanpa Team" value="" />
              {teams.map((team) => (
                <Picker.Item key={team.id} label={team.name} value={team.id.toString()} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.switchGroup}>
          <View>
            <Text style={styles.label}>Status Aktif</Text>
            <Text style={styles.subLabel}>User dapat login jika aktif</Text>
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
            <Text style={styles.deleteBtnText}>Hapus User</Text>
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
  pickerContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
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

export default UserFormScreen;
