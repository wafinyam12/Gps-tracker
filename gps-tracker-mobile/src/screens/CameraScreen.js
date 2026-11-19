import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image, FlatList } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { RefreshCcw, X, Check } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { visitService } from '../api/services/visitService';
import * as ImageManipulator from 'expo-image-manipulator';
import { offlineQueue } from '../utils/offlineQueue';
import { secureOfflineVisitStorage } from '../utils/secureOfflineVisitStorage';
import NetInfo from '@react-native-community/netinfo';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import { logEvent } from '../utils/diagnosticLogger';
import { createPhotoSaveCoordinator } from '../utils/photoSaveCoordinator';
import { canCaptureVisitPhoto } from '../utils/visitPhotoPresentation';
import { visitColors, visitRadii, visitSpacing, visitType } from '../styles/visitTheme';

const PhotoUploadScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { visitLogId, offlineVisitId, type, latitude, longitude, takenAt, userId, username } = route.params || {};
  const { user } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [facing, setFacing] = useState('back');
  const cameraRef = useRef(null);
  const photosRef = useRef(photos);
  const saveCoordinatorRef = useRef(null);
  if (!saveCoordinatorRef.current) {
    saveCoordinatorRef.current = createPhotoSaveCoordinator(
      (uris) => secureOfflineVisitStorage.deleteTemporaryPhotoFiles(uris)
    );
  }
  const saveCoordinator = saveCoordinatorRef.current;
  const allowedPhotoTypes = new Set(['checkin', 'checkout', 'product', 'other']);
  const resolvedType = allowedPhotoTypes.has(type) ? type : 'other';
  const photoTypeLabel = { checkin: 'Check-in', checkout: 'Checkout', product: 'Produk', other: 'Kunjungan' }[resolvedType];

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => () => {
    saveCoordinator.cleanupWhenSafe(
      photosRef.current.map((photo) => photo.uri)
    ).then((cleanupFailed) => {
      if (cleanupFailed) logEvent('visit.photo_temp_cleanup_failed');
    }).catch(() => logEvent('visit.photo_temp_cleanup_failed'));
  }, [saveCoordinator]);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!saveCoordinator.canLeave()) event.preventDefault();
  }), [navigation, saveCoordinator]);

  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Camera not ready.');
      return;
    }

    if (!canCaptureVisitPhoto(photos.length)) {
      Alert.alert('Limit', 'Anda hanya bisa mengambil maksimal 5 foto.');
      return;
    }

    let originalUri = null;
    try {
      const options = { quality: 0.7, base64: false };
      const data = await cameraRef.current.takePictureAsync(options);
      originalUri = data.uri;

      const manipulated = await ImageManipulator.manipulateAsync(
        data.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      setPhotos(prevPhotos => [...prevPhotos, manipulated]);
      setShowPreview(true);
      logEvent('visit.photo_captured', { source: 'camera' });
    } catch (error) {
      logEvent('visit.photo_capture_failed', { error_code: error?.code });
      Alert.alert('Error', 'Gagal mengambil foto. Coba lagi.');
    } finally {
      if (originalUri) {
        const cleanupFailed = await secureOfflineVisitStorage.deleteTemporaryPhotoFiles([originalUri]);
        if (cleanupFailed) logEvent('visit.photo_temp_cleanup_failed');
      }
    }
  };

  const removePhoto = (uri) => {
    if (saveCoordinator.isSaving()) return;
    setPhotos(prevPhotos => {
      const newPhotos = prevPhotos.filter(p => p.uri !== uri);
      if (newPhotos.length === 0) setShowPreview(false);
      return newPhotos;
    });
    secureOfflineVisitStorage.deleteTemporaryPhotoFiles([uri]).then((cleanupFailed) => {
      if (cleanupFailed) logEvent('visit.photo_temp_cleanup_failed');
    }).catch(() => logEvent('visit.photo_temp_cleanup_failed'));
  };

  const uploadPhotos = async () => {
    if (photos.length === 0) {
      Alert.alert('Info', 'Silakan ambil foto terlebih dahulu.');
      return;
    }

    if (!saveCoordinator.begin()) return;
    setIsProcessing(true);
    let photoPayload;
    let savedOrUploaded = false;
    try {
      photoPayload = {
        type: resolvedType,
        photos: photos.map((photo, index) => ({
          uri: photo.uri,
          name: `photo_${index}.jpg`,
          type: 'image/jpeg',
          client_uuid: offlineQueue.createUuid(),
        })),
        latitude,
        longitude,
        taken_at: takenAt || new Date().toISOString(),
        submitted_by_user_id: userId || user?.id,
        submitted_by_username: username || user?.name,
      };

      if (offlineVisitId) {
        await offlineQueue.enqueueVisitPhotos(offlineVisitId, photoPayload);
        savedOrUploaded = true;
        logEvent('visit.photo_queued_offline', { result: 'queued' });
        Alert.alert('Foto Disimpan Offline', 'Foto akan otomatis diunggah setelah visit tersinkron ke server.');
        saveCoordinator.allowLeave();
        navigation.goBack();
        return;
      }

      await visitService.uploadPhotos(visitLogId, photoPayload.photos, latitude, longitude, resolvedType, {
        takenAt: takenAt || new Date().toISOString(),
        userId: userId || user?.id,
        username: username || user?.name,
      });
      savedOrUploaded = true;
      logEvent('visit.photo_upload_succeeded');
      Alert.alert('Berhasil', 'Foto kunjungan berhasil diunggah.');
      saveCoordinator.allowLeave();
      navigation.goBack();
    } catch (e) {
      const netInfo = await NetInfo.fetch();
      const isOnline = Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);
      logEvent('visit.photo_upload_failed', {
        status: e.response?.status,
        error_code: e?.code,
        result: isOnline ? 'online' : 'offline',
      });
      try {
        await offlineQueue.addItem('/visit/photos', 'post', {
          visit_log_id: visitLogId,
          ...photoPayload,
        });
        savedOrUploaded = true;
        logEvent('visit.photo_saved_for_retry');
        Alert.alert(
          isOnline ? 'Upload gagal' : 'Offline Mode',
          isOnline
            ? 'Server tidak bisa dijangkau saat ini. Foto disimpan lokal dan akan dicoba sinkronisasi lagi.'
            : 'Data Anda telah disimpan secara offline dan akan disinkronkan saat koneksi kembali.'
        );
        saveCoordinator.allowLeave();
        navigation.goBack();
      } catch (offlineError) {
        logEvent('visit.photo_offline_save_failed', { error_code: offlineError?.code });
        Alert.alert('Gagal', 'Gagal mengunggah foto dan gagal menyimpan ke antrian offline.');
      }
    } finally {
      if (savedOrUploaded && photoPayload?.photos) {
        const cleanupFailed = await secureOfflineVisitStorage.deleteTemporaryPhotoFiles(
          photoPayload.photos.map((photo) => photo.uri)
        );
        if (cleanupFailed) logEvent('visit.photo_temp_cleanup_failed');
      }
      saveCoordinator.finish();
      setIsProcessing(false);
    }
  };

  if (!permission) {
    return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={visitColors.primary} /></SafeAreaView>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.text}>Aplikasi butuh izin kamera untuk mengambil foto kunjungan.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission} accessibilityRole="button"><Text style={styles.btnText}>Beri izin kamera</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (showPreview) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Periksa foto kunjungan</Text>
          <Text style={styles.previewCount}>{photos.length} dari 5 foto</Text>
          <FlatList
            data={photos}
            keyExtractor={(item) => item.uri}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.previewList}
            renderItem={({ item }) => (
              <View style={styles.previewItem}>
                <Image source={{ uri: item.uri }} style={styles.previewImage} />
                <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(item.uri)} disabled={isProcessing} accessibilityRole="button" accessibilityLabel="Hapus foto ini">
                  <X size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={[styles.controlBtn, styles.btnCancel]} onPress={() => setShowPreview(false)} disabled={isProcessing || !canCaptureVisitPhoto(photos.length)} accessibilityRole="button">
            <RefreshCcw size={24} color="#fff" />
            <Text style={styles.controlText}>{canCaptureVisitPhoto(photos.length) ? 'Tambah foto' : 'Maksimal 5 foto'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, styles.btnConfirm]}
            onPress={uploadPhotos}
            disabled={isProcessing}
            accessibilityRole="button"
          >
            {isProcessing ? <ActivityIndicator color="#fff" /> : <Check size={24} color="#fff" />}
            <Text style={styles.controlText}>{isProcessing ? 'Menyimpan...' : 'Simpan foto'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Tutup kamera">
          <X size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.cameraOverlay}>
          <Text style={styles.overlayText}>Foto {photoTypeLabel}</Text>
          <Text style={styles.overlaySubText}>{photos.length} dari 5 foto</Text>
        </View>

        <View style={styles.captureContainer}>
          <TouchableOpacity
            style={styles.switchCameraBtn}
            onPress={() => setFacing(current => current === 'back' ? 'front' : 'back')}
            disabled={isProcessing}
            accessibilityRole="button"
            accessibilityLabel={`Ganti ke kamera ${facing === 'back' ? 'depan' : 'belakang'}`}
          >
            <RefreshCcw size={22} color="#fff" />
            <Text style={styles.switchCameraText}>{facing === 'back' ? 'Depan' : 'Belakang'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.captureBtn, !canCaptureVisitPhoto(photos.length) && styles.captureDisabled]} onPress={takePicture} disabled={!canCaptureVisitPhoto(photos.length) || isProcessing} accessibilityRole="button" accessibilityLabel="Ambil foto">
            <View style={styles.captureInner} />
          </TouchableOpacity>
          {photos.length > 0 && (
            <TouchableOpacity style={styles.doneFab} onPress={() => setShowPreview(true)} accessibilityRole="button" accessibilityLabel="Periksa foto yang diambil">
              <Check size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </CameraView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101B1D' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: visitSpacing.page, backgroundColor: '#101B1D' },
  camera: { flex: 1 },
  previewContainer: {
    flex: 1,
    backgroundColor: '#101B1D',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: visitSpacing.sectionLarge,
  },
  previewTitle: {
    ...visitType.section,
    color: visitColors.surface,
    marginBottom: visitSpacing.xs,
  },
  previewCount: { ...visitType.caption, color: '#CAD8D8', marginBottom: visitSpacing.section },
  previewList: {
    paddingHorizontal: visitSpacing.page,
    alignItems: 'center',
  },
  previewItem: {
    marginRight: visitSpacing.md,
    position: 'relative',
  },
  previewImage: {
    width: 250,
    height: 350,
    borderRadius: visitRadii.card,
  },
  removeBtn: {
    position: 'absolute',
    top: visitSpacing.sm,
    right: visitSpacing.sm,
    width: 44,
    height: 44,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { ...visitType.body, color: visitColors.surface, textAlign: 'center' },
  btn: { backgroundColor: visitColors.primary, minHeight: 48, paddingHorizontal: visitSpacing.card, justifyContent: 'center', borderRadius: visitRadii.control, marginTop: visitSpacing.md },
  btnText: { ...visitType.label, color: visitColors.surface },
  closeBtn: { position: 'absolute', top: visitSpacing.page, left: visitSpacing.page, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  cameraOverlay: { position: 'absolute', top: 76, width: '100%', alignItems: 'center' },
  overlayText: { ...visitType.section, color: visitColors.surface, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: visitSpacing.card, paddingVertical: visitSpacing.sm, borderRadius: visitRadii.pill },
  overlaySubText: { ...visitType.caption, color: visitColors.surface, marginTop: visitSpacing.sm, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: visitSpacing.md, paddingVertical: visitSpacing.xs, borderRadius: visitRadii.pill },
  captureContainer: {
    position: 'absolute',
    bottom: visitSpacing.sectionLarge,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtn: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  captureDisabled: { opacity: 0.45 },
  switchCameraBtn: { position: 'absolute', left: visitSpacing.page, minWidth: 76, minHeight: 64, borderRadius: visitRadii.control, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', gap: visitSpacing.xs },
  switchCameraText: { ...visitType.caption, color: visitColors.surface },
  doneFab: { position: 'absolute', right: visitSpacing.sectionLarge, width: 50, height: 50, borderRadius: 25, backgroundColor: visitColors.primary, justifyContent: 'center', alignItems: 'center' },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: visitSpacing.page,
    paddingTop: visitSpacing.sm,
    paddingBottom: visitSpacing.card,
    width: '100%',
    gap: visitSpacing.sm,
    backgroundColor: '#101B1D',
  },
  controlBtn: { flex: 1, minWidth: 0, minHeight: 66, alignItems: 'center', justifyContent: 'center', gap: visitSpacing.xs, padding: visitSpacing.sm, borderRadius: visitRadii.control },
  btnCancel: { backgroundColor: '#3B5153' },
  btnConfirm: { backgroundColor: visitColors.primary },
  controlText: { ...visitType.label, color: visitColors.surface, textAlign: 'center' }
});

export default PhotoUploadScreen;
