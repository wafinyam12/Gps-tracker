import React, { useState, useEffect } from 'react';
import { Platform, View, Text, StyleSheet, FlatList, Image, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { visitService } from '../api/services/visitService';
import { ChevronLeft, Trash2, MapPin } from 'lucide-react-native';
import moment from 'moment';
import PhotoPreviewModal from '../components/PhotoPreviewModal';

const VisitPhotoGalleryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { visitLogId, canDelete } = route.params || {};

  useEffect(() => {
    if (!visitLogId) {
      Alert.alert('Error', 'ID kunjungan tidak ditemukan.');
      navigation.goBack();
    }
  }, [visitLogId]);

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);
  const [photoPreviewIndex, setPhotoPreviewIndex] = useState(0);

  const openPhotoPreview = (index = 0) => {
    if (photos.length === 0) {
      return;
    }

    setPhotoPreviewIndex(index);
    setPhotoPreviewVisible(true);
  };

  const closePhotoPreview = () => {
    setPhotoPreviewVisible(false);
  };

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const response = await visitService.getVisitPhotos(visitLogId);
      setPhotos(response.data?.photos || []);
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil foto kunjungan.');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPhotos();
  };

  const handleDeletePhoto = async (photoId) => {
    Alert.alert(
      'Hapus Foto',
      'Anda yakin ingin menghapus foto ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await visitService.deletePhoto(photoId);
              Alert.alert('Berhasil', 'Foto berhasil dihapus.');
              fetchPhotos(); // Refresh list
            } catch (error) {
              Alert.alert('Error', error.response?.data?.message || 'Gagal menghapus foto.');
            }
          },
        },
      ],
    );
  };

  const renderPhotoItem = ({ item }) => (
    <View style={styles.photoCard}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => openPhotoPreview(photos.findIndex((photo) => photo.id === item.id))}
      >
        <Image source={{ uri: item.url }} style={styles.photoImage} />
      </TouchableOpacity>
      <View style={styles.photoDetails}>
        <Text style={styles.photoType}>Tipe: {item.type}</Text>
        <View style={styles.locationInfo}>
          <MapPin size={14} color="#64748B" />
          <Text style={styles.locationText}>
            {item.location ? `${item.location.latitude.toFixed(4)}, ${item.location.longitude.toFixed(4)}` : 'N/A'}
          </Text>
        </View>
        <Text style={styles.takenAt}>Diambil: {moment(item.taken_at).format('DD MMM YYYY, HH:mm')}</Text>
      </View>
      {canDelete && (
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeletePhoto(item.id)}>
          <Trash2 size={20} color="#EF4444" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>Memuat galeri foto...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Galeri Foto Kunjungan</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPhotoItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Tidak ada foto untuk kunjungan ini.</Text>
        }
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      <PhotoPreviewModal
        visible={photoPreviewVisible}
        photos={photos}
        initialIndex={photoPreviewIndex}
        title="Foto Kunjungan"
        onClose={closePhotoPreview}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  list: {
    padding: 20,
    paddingBottom: Platform.OS === 'android' ? 64 : 40,
  },
  photoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  photoImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  photoDetails: {
    padding: 12,
  },
  photoType: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F766E',
    marginBottom: 4,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
  },
  takenAt: {
    fontSize: 11,
    color: '#94A3B8',
  },
  deleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    padding: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 60,
    color: '#94a3b8',
    fontSize: 14,
  },
});

export default VisitPhotoGalleryScreen;
