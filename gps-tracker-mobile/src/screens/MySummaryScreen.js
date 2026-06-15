import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { reportService as reportServiceApi } from '../api/services/reportService';
import { useNavigation } from '@react-navigation/native';

const MySummaryScreen = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    try {
        const res = await reportServiceApi.mySummary();
        setSummary(res.data?.data || res.data);
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil ringkasan Anda');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#1E40AF" /></View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ringkasan Saya</Text>
      <View style={styles.cardRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Jadwal Hari Ini</Text>
          <Text style={styles.cardValue}>{summary?.stats?.total ?? '-'}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Selesai</Text>
          <Text style={styles.cardValue}>{summary?.stats?.completed ?? '-'}</Text>
        </View>
      </View>
      <View style={styles.cardRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Completion</Text>
          <Text style={styles.cardValue}>{summary?.stats?.completion_pct ?? 0}%</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Avg Durasi</Text>
          <Text style={styles.cardValue}>{summary?.stats?.avg_duration_min ?? 0}m</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center' },
  cardFull: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center' },
  cardLabel: { fontSize: 12, color: '#64748b' },
  cardValue: { fontSize: 18, fontWeight: 'bold', color: '#1E40AF', marginTop: 6 },
});

export default MySummaryScreen;
