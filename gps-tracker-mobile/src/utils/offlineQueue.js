import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import apiClient from '../api/client';

const OFFLINE_QUEUE_KEY = 'offlineQueue';

let isProcessingQueue = false;

export const offlineQueue = {
  async addItem(endpoint, method, data, headers = {})
  {
    try {
      const queue = JSON.parse(await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
      queue.push({ endpoint, method, data, headers, timestamp: new Date().toISOString() });
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      Alert.alert('Offline Mode', 'Data Anda telah disimpan secara offline dan akan disinkronkan saat koneksi kembali.');
    } catch (error) {
      console.error('Error adding item to offline queue:', error);
      Alert.alert('Error', 'Gagal menyimpan data offline.');
    }
  },

  async processQueue()
  {
    if (isProcessingQueue) {
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('Not connected to internet, skipping queue processing.');
      return;
    }

    isProcessingQueue = true;
    try {
      const queue = JSON.parse(await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)) || [];

      if (queue.length === 0) {
        console.log('Offline queue is empty.');
        return;
      }

      console.log(`Processing ${queue.length} items in offline queue...`);

      for (let i = 0; i < queue.length; i++) {
        const { endpoint, method, data, headers } = queue[i];
        try {
          console.log(`Syncing ${method} ${endpoint}`);
          await apiClient({ method, url: endpoint, data, headers });
          // Remove successfully processed item from the queue
          queue.splice(i, 1);
          i--; // Adjust index after removal
        } catch (error) {
          console.error(`Failed to sync ${method} ${endpoint}:`, error);
          // If an item fails, keep it in the queue for the next attempt
          // Optionally, add a retry count or exponential backoff
          Alert.alert('Sync Gagal', `Gagal sinkronisasi ${endpoint}. Akan dicoba lagi nanti.`);
          break; // Stop processing on first error to prevent cascading failures
        }
      }

      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

      if (queue.length === 0) {
        Alert.alert('Online Kembali', 'Semua data offline berhasil disinkronkan!');
      }
    } catch (error) {
      console.error('Error processing offline queue:', error);
    } finally {
      isProcessingQueue = false;
    }
  },

  async getQueueSize()
  {
    try {
      const queue = JSON.parse(await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
      return queue.length;
    } catch (error) {
      console.error('Error getting queue size:', error);
      return 0;
    }
  },

  async clearQueue()
  {
    try {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
      console.log('Offline queue cleared.');
    } catch (error) {
      console.error('Error clearing queue:', error);
    }
  }
};
