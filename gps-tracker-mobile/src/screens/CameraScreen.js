import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image, FlatList } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Camera as CameraIcon, RefreshCcw, X, Check } from 'lucide-react-native';
import { visitService } from '../api/services/visitService';
import * as ImageManipulator from 'expo-image-manipulator';
import { offlineQueue } from '../utils/offlineQueue';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';

const PhotoUploadScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { visitLogId, type, latitude, longitude, takenAt, userId, username } = route.params || {};
  const { user } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Camera not ready.');
      return;
    }

    if (photos.length >= 5) {
      Alert.alert('Limit', 'Anda hanya bisa mengambil maksimal 5 foto.');
      return;
    }

    try {
      const options = { quality: 0.7, base64: false };
      const data = await cameraRef.current.takePictureAsync(options);

      const manipulated = await ImageManipulator.manipulateAsync(
        data.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      setPhotos(prevPhotos => [...prevPhotos, manipulated]);
      setShowPreview(true);
    } catch (error) {
      console.log('Error taking picture:', error);
      Alert.alert('Error', 'Gagal mengambil foto. Coba lagi.');
    }
  };

  const removePhoto = (uri) => {
    setPhotos(prevPhotos => {
      const newPhotos = prevPhotos.filter(p => p.uri !== uri);
      if (newPhotos.length === 0) setShowPreview(false);
      return newPhotos;
    });
  };

  const uploadPhotos = async () => {
    if (photos.length === 0) {
      Alert.alert('Info', 'Silakan ambil foto terlebih dahulu.');
      return;
    }

    setIsProcessing(true);
    try {
      await visitService.uploadPhotos(visitLogId, photos, latitude, longitude, type, {
        takenAt: takenAt || new Date().toISOString(),
        userId: userId || user?.id,
        username: username || user?.name,
      });
      Alert.alert('Berhasil', 'Foto kunjungan berhasil diunggah.');
      navigation.goBack();
    } catch (e) {
      console.log('Upload failed, adding to offline queue:', e.response?.data || e);
      try {
        await offlineQueue.addItem('/visit/photos', 'post', {
          visit_log_id: visitLogId,
          photos: photos.map(p => ({ uri: p.uri, type: type })),
          latitude: latitude,
          longitude: longitude,
          taken_at: takenAt || new Date().toISOString(),
          submitted_by_user_id: userId || user?.id,
          submitted_by_username: username || user?.name,
        }, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        navigation.goBack();
      } catch (offlineError) {
        Alert.alert('Gagal', 'Gagal mengunggah foto dan gagal menyimpan ke antrian offline.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1E40AF" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Aplikasi butuh izin kamera untuk mengambil foto kunjungan.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}><Text style={styles.btnText}>Beri Izin</Text></TouchableOpacity>
      </View>
    );
  }

  if (showPreview) {
    return (
      <View style={styles.container}>
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Pratinjau Foto ({photos.length}/5)</Text>
          <FlatList
            data={photos}
            keyExtractor={(item) => item.uri}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.previewList}
            renderItem={({ item }) => (
              <View style={styles.previewItem}>
                <Image source={{ uri: item.uri }} style={styles.previewImage} />
                <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(item.uri)}>
                  <X size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={[styles.controlBtn, styles.btnCancel]} onPress={() => setShowPreview(false)}>
            <RefreshCcw size={28} color="#fff" />
            <Text style={styles.controlText}>Tambah Lagi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, styles.btnConfirm]}
            onPress={uploadPhotos}
            disabled={isProcessing}
          >
            {isProcessing ? <ActivityIndicator color="#fff" /> : <Check size={28} color="#fff" />}
            <Text style={styles.controlText}>Simpan Semua</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      >
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <X size={30} color="#fff" />
        </TouchableOpacity>

        <View style={styles.cameraOverlay}>
          <Text style={styles.overlayText}>Ambil Foto ({type})</Text>
          <Text style={styles.overlaySubText}>{photos.length} foto diambil</Text>
        </View>

        <View style={styles.captureContainer}>
          <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
          {photos.length > 0 && (
            <TouchableOpacity style={styles.doneFab} onPress={() => setShowPreview(true)}>
              <Check size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  camera: { flex: 1 },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  previewTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  previewList: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  previewItem: {
    marginRight: 15,
    position: 'relative',
  },
  previewImage: {
    width: 250,
    height: 350,
    borderRadius: 16,
  },
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
  },
  text: { color: '#fff', textAlign: 'center' },
  btn: { backgroundColor: '#1E40AF', padding: 15, borderRadius: 8, marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  closeBtn: { position: 'absolute', top: 50, left: 20, padding: 10 },
  cameraOverlay: { position: 'absolute', top: 100, width: '100%', alignItems: 'center' },
  overlayText: { color: '#fff', fontSize: 16, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  overlaySubText: { color: '#fff', fontSize: 12, marginTop: 10 },
  captureContainer: { position: 'absolute', bottom: 40, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  captureBtn: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  doneFab: { position: 'absolute', right: 40, width: 50, height: 50, borderRadius: 25, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  controls: { flexDirection: 'row', paddingBottom: 40, width: '100%', justifyContent: 'space-evenly', backgroundColor: '#000' },
  controlBtn: { alignItems: 'center', gap: 8, padding: 15, borderRadius: 12, minWidth: 140 },
  btnCancel: { backgroundColor: '#4B5563' },
  btnConfirm: { backgroundColor: '#10B981' },
  controlText: { color: '#fff', fontWeight: 'bold' }
});

export default PhotoUploadScreen;
