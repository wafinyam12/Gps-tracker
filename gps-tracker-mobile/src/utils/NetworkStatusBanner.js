import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff, RefreshCw, Check } from 'lucide-react-native';
import { offlineQueue } from './offlineQueue';

const NetworkStatusBanner = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [queueSize, setQueueSize] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      updateQueueSize();
    });
    return () => unsubscribe();
  }, []);

  const updateQueueSize = async () => {
    const size = await offlineQueue.getQueueSize();
    setQueueSize(size);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await offlineQueue.processQueue();
    await updateQueueSize();
    setIsSyncing(false);
  };

  // If online and no queue, hide banner
  if (isConnected && queueSize === 0) {
    return null;
  }

  return (
    <View style={[styles.banner, { backgroundColor: isConnected ? '#FEF3C7' : '#FEE2E2' }]}>
      <View style={styles.content}>
        {isConnected ? (
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

      {isConnected && queueSize > 0 && (
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