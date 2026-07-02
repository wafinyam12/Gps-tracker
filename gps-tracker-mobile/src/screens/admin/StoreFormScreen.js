import React, { useState, useEffect } from 'react';
import { Platform, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator } from 'react-native';
import { storeService } from '../../api/services/storeService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Save, Trash2, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';

const StoreFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { storeId } = route.params || {};
  const isEdit = !!storeId;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [form, setForm] = useState({
    code: '',
    name: '',
    address: '',
    area: '',
    city: '',
    latitude: '',
    longitude: '',
    geofence_radius: '100',
    pic_name: '',
    pic_phone: '',
    status: 'active',
    is_priority: false,
  });

  useEffect(() => {
    if (isEdit) {
      fetchStoreDetail();
    }
  }, []);

  const fetchStoreDetail = async () => {
    try {
      const response = await storeService.getStore(storeId);
      const store = response.data?.data;
      setForm({
        code: store.code,
        name: store.name,
        address: store.address || '',
        area: store.area || '',
        city: store.city || '',
        latitude: store.latitude?.toString() || '',
        longitude: store.longitude?.toString() || '',
        geofence_radius: store.geofence_radius?.toString() || '100',
        pic_name: store.pic_name || '',
        pic_phone: store.pic_phone || '',
        status: store.status,
        is_priority: store.is_priority,
      });
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil detail toko');
      navigation.goBack();
    } finally {
      setInitialLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Izin lokasi diperlukan untuk mengambil koordinat');
      return;
    }

    setLoading(true);
    try {
      let location = await Location.getCurrentPositionAsync({});
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
    if (!form.name || !form.code || !form.latitude || !form.longitude) {
      Alert.alert('Error', 'Nama, Kode, Latitude, dan Longitude wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        geofence_radius: parseInt(form.geofence_radius),
      };

      if (isEdit) {
        await storeService.updateStore(storeId, payload);
      } else {
        await storeService.createStore(payload);
      }
      Alert.alert('Sukses', `Toko berhasil ${isEdit ? 'diupdate' : 'dibuat'}`);
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
      'Apakah Anda yakin ingin menghapus toko ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await storeService.deleteStore(storeId);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Gagal menghapus toko');
            }
          }
        }
      ]
    );
  };

  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Toko' : 'Toko Baru'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#0F766E" />
          ) : (
            <Save size={24} color="#0F766E" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form}>
        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
            <Text style={styles.label}>Kode Toko *</Text>
            <TextInput
              style={styles.input}
              value={form.code}
              onChangeText={(val) => setForm({ ...form, code: val })}
              placeholder="STR-001"
              autoCapitalize="characters"
            />
          </View>
          <View style={styles.switchGroupInline}>
            <Text style={styles.label}>Priority</Text>
            <Switch
              value={form.is_priority}
              onValueChange={(val) => setForm({ ...form, is_priority: val })}
              trackColor={{ false: '#CBD5E1', true: '#9CCFC7' }}
              thumbColor={form.is_priority ? '#0F766E' : '#F1F5F9'}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nama Toko *</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(val) => setForm({ ...form, name: val })}
            placeholder="Contoh: Toko Maju Jaya"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Alamat Lengkap</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.address}
            onChangeText={(val) => setForm({ ...form, address: val })}
            placeholder="Alamat lengkap toko..."
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
            <Text style={styles.label}>Area</Text>
            <TextInput
              style={styles.input}
              value={form.area}
              onChangeText={(val) => setForm({ ...form, area: val })}
              placeholder="Contoh: Pusat"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Kota</Text>
            <TextInput
              style={styles.input}
              value={form.city}
              onChangeText={(val) => setForm({ ...form, city: val })}
              placeholder="Contoh: Jakarta"
            />
          </View>
        </View>

        <View style={styles.locationSection}>
          <View style={styles.locationHeader}>
            <Text style={styles.label}>Koordinat GPS *</Text>
            <TouchableOpacity style={styles.locationBtn} onPress={getCurrentLocation}>
              <MapPin size={14} color="#0F766E" />
              <Text style={styles.locationBtnText}>Gunakan Lokasi Saat Ini</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
              <TextInput
                style={styles.input}
                value={form.latitude}
                onChangeText={(val) => setForm({ ...form, latitude: val })}
                placeholder="Latitude"
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <TextInput
                style={styles.input}
                value={form.longitude}
                onChangeText={(val) => setForm({ ...form, longitude: val })}
                placeholder="Longitude"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Radius Geofence (Meter)</Text>
          <TextInput
            style={styles.input}
            value={form.geofence_radius}
            onChangeText={(val) => setForm({ ...form, geofence_radius: val })}
            placeholder="Default: 100"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nama PIC / Pemilik</Text>
          <TextInput
            style={styles.input}
            value={form.pic_name}
            onChangeText={(val) => setForm({ ...form, pic_name: val })}
            placeholder="Nama kontak di toko"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Telepon PIC</Text>
          <TextInput
            style={styles.input}
            value={form.pic_phone}
            onChangeText={(val) => setForm({ ...form, pic_phone: val })}
            placeholder="0812..."
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.switchGroup}>
          <View>
            <Text style={styles.label}>Status Toko Aktif</Text>
            <Text style={styles.subLabel}>Toko nonaktif tidak akan muncul di daftar toko</Text>
          </View>
          <Switch
            value={form.status === 'active'}
            onValueChange={(val) => setForm({ ...form, status: val ? 'active' : 'inactive' })}
            trackColor={{ false: '#CBD5E1', true: '#9CCFC7' }}
            thumbColor={form.status === 'active' ? '#0F766E' : '#F1F5F9'}
          />
        </View>

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Trash2 size={20} color="#EF4444" />
            <Text style={styles.deleteBtnText}>Hapus Toko</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: Platform.OS === 'android' ? 64 : 40 }} />
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
    paddingTop: Platform.OS === 'android' ? 24 : 0,
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
  inputRow: {
    flexDirection: 'row',
    marginBottom: 0,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchGroupInline: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  locationSection: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D9F3EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  locationBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0F766E',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
    marginBottom: 20,
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

export default StoreFormScreen;
