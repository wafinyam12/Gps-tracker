import React, { useState, useEffect } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff, RefreshCw, Check } from 'lucide-react-native';
import { offlineQueue } from './offlineQueue';

const NetworkStatusBanner = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [queueSize, setQueueSize] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      updateQueueSize();
    });
    return () => unsubscribe();
  }, []);

  const updateQueueSize = async () => {
    try {
      const size = await offlineQueue.getQueueSize();
      setQueueSize(size);
      setStorageUnavailable(false);
      return true;
    } catch (error) {
      setStorageUnavailable(true);
      return false;
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await offlineQueue.processQueue();
      const available = await updateQueueSize();
      if (!available) {
        Alert.alert('Penyimpanan offline belum siap', 'Data kunjungan tetap dilindungi. Coba buka ulang aplikasi sebelum menyinkronkan.');
      }
    } catch (error) {
      setStorageUnavailable(true);
      Alert.alert('Sinkronisasi belum berhasil', 'Data kunjungan tetap tersimpan. Periksa koneksi dan penyimpanan perangkat, lalu coba lagi.');
    } finally {
      setIsSyncing(false);
    }
  };

  // If online and no queue, hide banner
  if (isConnected && queueSize === 0 && !storageUnavailable) {
    return null;
  }

  return (
    <View style={[styles.banner, { backgroundColor: isConnected && !storageUnavailable ? '#FEF3C7' : '#FEE2E2' }]}>
      <View style={styles.content}>
        {storageUnavailable ? (
          <>
            <WifiOff size={16} color="#991B1B" />
            <Text style={styles.textOffline}>Penyimpanan offline tidak tersedia</Text>
          </>
        ) : isConnected ? (
          <>
            <RefreshCw size={16} color="#92400E" />
            <Text style={styles.text}>Sinkronisasi Tertunda</Text>
            <Text style={styles.queueCount}>{queueSize} item menunggu</Text>
          </>
        ) : (
          <>
            <WifiOff size={16} color="#991B1B" />
            <Text style={styles.textOffline}>Offline</Text>
            <Text style={styles.queueCount}>Data disimpan secara lokal</Text>
          </>
        )}
      </View>

      {isConnected && queueSize > 0 && !storageUnavailable && (
        <TouchableOpacity onPress={handleSync} disabled={isSyncing} style={styles.syncBtn}>
          <Text style={styles.syncText}>
            {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  textOffline: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
  },
  queueCount: {
    fontSize: 11,
    color: '#92400E',
    marginLeft: 4,
  },
  syncBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  syncText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  }
});

export default NetworkStatusBanner;
