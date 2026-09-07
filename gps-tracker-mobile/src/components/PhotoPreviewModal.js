import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

const logPhotoLoadError = (photo, error) => {
  if (!__DEV__) {
    return;
  }

  console.warn('[PhotoPreviewModal] Failed to load visit photo preview', {
    photoId: photo?.id,
    url: photo?.url,
    error: error?.nativeEvent?.error,
  });
};

const PhotoPreviewModal = ({
  visible,
  photos = [],
  initialIndex = 0,
  title = 'Foto',
  onClose,
}) => {
  const { width } = useWindowDimensions();
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!visible || photos.length === 0) {
      return;
    }

    const nextIndex = Math.min(initialIndex, photos.length - 1);
    setCurrentIndex(nextIndex);

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: false,
      });
    });
  }, [visible, initialIndex, photos.length]);

  if (!visible) {
    return null;
  }

  const handleScrollEnd = (event) => {
    if (width <= 0) {
      return;
    }

    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(nextIndex);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.counter}>
              {photos.length > 0 ? `${currentIndex + 1}/${photos.length}` : '0/0'}
            </Text>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={photos}
          keyExtractor={(item, index) => String(item.id ?? item.url ?? index)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onScrollToIndexFailed={({ index }) => {
            flatListRef.current?.scrollToOffset({
              offset: Math.max(0, index * width),
              animated: false,
            });
          }}
          renderItem={({ item }) => (
            <View style={[styles.page, { width }]}>
              <Image
                source={{ uri: item.url }}
                style={styles.image}
                resizeMode="contain"
                onError={(error) => logPhotoLoadError(item, error)}
              />
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  counter: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default PhotoPreviewModal;
