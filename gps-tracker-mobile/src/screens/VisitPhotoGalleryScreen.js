import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MapPin, Trash2 } from 'lucide-react-native';
import moment from 'moment';
import { visitService } from '../api/services/visitService';
import PhotoPreviewModal from '../components/PhotoPreviewModal';
import AppScreen from '../components/ui/AppScreen';
import VisitHeader from '../components/visit/VisitHeader';
import { formatVisitPhotoLocation } from '../utils/visitPhotoPresentation';
import { visitColors, visitRadii, visitSpacing, visitType } from '../styles/visitTheme';

const VisitPhotoGalleryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { visitLogId, canDelete } = route.params || {};
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);
  const [photoPreviewIndex, setPhotoPreviewIndex] = useState(0);

  useEffect(() => {
    if (!visitLogId) {
      Alert.alert('Error', 'ID kunjungan tidak ditemukan.');
      navigation.goBack();
    }
  }, [visitLogId, navigation]);

  useEffect(() => {
    if (visitLogId) fetchPhotos();
  }, [visitLogId]);

  const fetchPhotos = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await visitService.getVisitPhotos(visitLogId);
      setPhotos(response.data?.photos || []);
    } catch (error) {
      setErrorMessage('Foto kunjungan belum dapat dimuat. Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPhotos();
  };

  const handleDeletePhoto = (photoId) => {
    Alert.alert('Hapus foto', 'Yakin ingin menghapus foto ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await visitService.deletePhoto(photoId);
            Alert.alert('Berhasil', 'Foto berhasil dihapus.');
            fetchPhotos();
          } catch (error) {
            Alert.alert('Gagal', error.response?.data?.message || 'Foto belum dapat dihapus.');
          }
        },
      },
    ]);
  };

  const renderPhotoItem = ({ item, index }) => (
    <View style={styles.photoCard}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Lihat foto ${index + 1}`}
        activeOpacity={0.9}
        onPress={() => {
          setPhotoPreviewIndex(index);
          setPhotoPreviewVisible(true);
        }}
      >
        <Image source={{ uri: item.url }} style={styles.photoImage} />
      </TouchableOpacity>
      {canDelete ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Hapus foto ${index + 1}`}
          style={styles.deleteBtn}
          onPress={() => handleDeletePhoto(item.id)}
        >
          <Trash2 size={19} color={visitColors.danger} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.photoDetails}>
        <Text style={styles.photoType}>{item.type || 'Foto kunjungan'}</Text>
        <View style={styles.locationRow}>
          <MapPin size={14} color={visitColors.mutedInk} />
          <Text style={styles.locationText}>{formatVisitPhotoLocation(item.location)}</Text>
        </View>
        <Text style={styles.takenAt}>{moment(item.taken_at).format('DD MMM YYYY, HH:mm')}</Text>
      </View>
    </View>
  );

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      <VisitHeader title="Foto kunjungan" subtitle={`${photos.length} foto tersimpan`} onBack={() => navigation.goBack()} />
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={visitColors.primary} />
          <Text style={styles.stateText}>Memuat galeri foto...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Foto belum dapat dimuat</Text>
          <Text style={styles.stateText}>{errorMessage}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={fetchPhotos} style={styles.retryButton}>
            <Text style={styles.retryText}>Coba lagi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPhotoItem}
          numColumns={2}
          columnWrapperStyle={styles.photoRow}
          contentContainerStyle={styles.list}
          ListEmptyComponent={(
            <View style={styles.emptyCard}>
              <Text style={styles.stateTitle}>Belum ada foto</Text>
              <Text style={styles.stateText}>Foto yang diambil saat kunjungan akan tampil di sini.</Text>
            </View>
          )}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      )}
      <PhotoPreviewModal
        visible={photoPreviewVisible}
        photos={photos}
        initialIndex={photoPreviewIndex}
        title="Foto kunjungan"
        onClose={() => setPhotoPreviewVisible(false)}
      />
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas },
  screenContent: { paddingTop: 0, paddingBottom: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: visitSpacing.md },
  list: { padding: visitSpacing.page, paddingBottom: visitSpacing.sectionLarge },
  photoRow: { justifyContent: 'space-between', gap: visitSpacing.sm },
  photoCard: { width: '48.5%', backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, marginBottom: visitSpacing.sm, overflow: 'hidden' },
  photoImage: { width: '100%', height: 132, resizeMode: 'cover' },
  photoDetails: { padding: visitSpacing.sm },
  photoType: { ...visitType.label, color: visitColors.ink, marginBottom: visitSpacing.xs },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: visitSpacing.xs },
  locationText: { ...visitType.caption, color: visitColors.mutedInk, flex: 1 },
  takenAt: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  deleteBtn: { position: 'absolute', top: visitSpacing.sm, right: visitSpacing.sm, width: 44, height: 44, borderRadius: 22, backgroundColor: visitColors.surface, alignItems: 'center', justifyContent: 'center' },
  stateCard: { backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, padding: visitSpacing.card, margin: visitSpacing.page },
  emptyCard: { backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, padding: visitSpacing.card },
  stateTitle: { ...visitType.section, color: visitColors.ink },
  stateText: { ...visitType.body, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  retryButton: { minHeight: 48, backgroundColor: visitColors.primary, borderRadius: visitRadii.control, marginTop: visitSpacing.md, alignItems: 'center', justifyContent: 'center' },
  retryText: { ...visitType.label, color: visitColors.surface },
});

export default VisitPhotoGalleryScreen;
