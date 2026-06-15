import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { scheduleService } from '../../api/services/scheduleService'; // Assuming you'll create this
import { teamService } from '../../api/services/teamService';     // Assuming you'll create this
import { useNavigation } from '@react-navigation/native';
import { Calendar, Users, CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import moment from 'moment';

const TeamSummaryScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [selectedDate, selectedTeamId]);

  const fetchTeams = async () => {
    try {
      const response = await teamService.getTeams();
      const payload = response.data?.data;
      setTeams(Array.isArray(payload) ? payload : payload?.data || []);
    } catch (error) {
      console.log('Error fetching teams', error);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const formattedDate = moment(selectedDate).format('YYYY-MM-DD');
      const response = await scheduleService.getTeamSummary({
        date: formattedDate,
        team_id: selectedTeamId || undefined,
      });
      setSummaryData(response.data?.data);
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil ringkasan team');
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Memuat ringkasan team...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ringkasan Kunjungan Tim</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Alerts')} style={styles.alertBtn}>
          <AlertTriangle size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerBtn}>
          <Calendar size={18} color="#1E40AF" />
          <Text style={styles.dateText}>{moment(selectedDate).format('DD MMMM YYYY')}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}
        <View style={styles.teamPickerContainer}>
          <Picker
            selectedValue={selectedTeamId}
            onValueChange={(itemValue) => setSelectedTeamId(itemValue)}
            style={styles.teamPicker}
          >
            <Picker.Item label="Semua Team" value="" />
            {teams.map(team => (
              <Picker.Item key={team.id} label={team.name} value={team.id.toString()} />
            ))}
          </Picker>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        {summaryData?.team_summary && (
          <View style={styles.overviewCard}>
            <Text style={styles.overviewTitle}>Ringkasan Global</Text>
            <View style={styles.overviewStatsGrid}>
              <View style={styles.overviewStatItem}>
                <Text style={styles.overviewStatLabel}>Total Jadwal</Text>
                <Text style={styles.overviewStatValue}>{summaryData.team_summary.total_schedules}</Text>
              </View>
              <View style={styles.overviewStatItem}>
                <Text style={styles.overviewStatLabel}>Selesai</Text>
                <Text style={styles.overviewStatValue}>{summaryData.team_summary.total_completed}</Text>
              </View>
              <View style={styles.overviewStatItem}>
                <Text style={styles.overviewStatLabel}>Persentase</Text>
                <Text style={[styles.overviewStatValue, { color: getCompletionColor(summaryData.team_summary.avg_completion) }]}>
                  {summaryData.team_summary.avg_completion || 0}%
                </Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Progress Sales</Text>
        {summaryData?.sales?.length > 0 ? (summaryData.sales.map((sales, index) => (
          <TouchableOpacity
            key={sales.user_id}
            style={styles.salesCard}
            onPress={() => navigation.navigate('SalesDetail', { userId: sales.user_id })} // Navigasi ke SalesDetailScreen
          >
            <View style={styles.salesCardHeader}>
              <View style={styles.salesInfo}>
                <Users size={20} color="#1E293B" />
                <Text style={styles.salesName}>{sales.name}</Text>
              </View>
              <View style={[styles.onlineStatus, { backgroundColor: sales.is_online ? '#10B981' : '#EF4444' }]} />
            </View>
            <View style={styles.salesStatsGrid}>
              <View style={styles.salesStatItem}>
                <Text style={styles.salesStatLabel}>Jadwal</Text>
                <Text style={styles.salesStatValue}>{sales.summary.total}</Text>
              </View>
              <View style={styles.salesStatItem}>
                <Text style={styles.salesStatLabel}>Selesai</Text>
                <Text style={styles.salesStatValue}>{sales.summary.completed}</Text>
              </View>
              <View style={styles.salesStatItem}>
                <Text style={styles.salesStatLabel}>% Selesai</Text>
                <Text style={[styles.salesStatValue, { color: getCompletionColor(sales.summary.completion_pct) }]}>
                  {sales.summary.completion_pct || 0}%
                </Text>
              </View>
              <View style={styles.salesStatItem}>
                <Text style={styles.salesStatLabel}>Mock GPS</Text>
                <Text style={styles.salesStatValue}>{sales.summary.mock_detected}</Text>
              </View>
              <View style={styles.salesStatItem}>
                <Text style={styles.salesStatLabel}>Invalid Checkin</Text>
                <Text style={styles.salesStatValue}>{sales.summary.total - sales.summary.valid_checkins}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))) : (
          <Text style={styles.emptyText}>Tidak ada data sales untuk tanggal ini.</Text>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const getCompletionColor = (percentage) => {
  if (percentage >= 80) return '#10B981'; // Green
  if (percentage >= 50) return '#F59E0B'; // Yellow
  return '#EF4444'; // Red
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
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  alertBtn: {
    padding: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  teamPickerContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 40,
    justifyContent: 'center',
    minWidth: 150,
  },
  teamPicker: {
    height: 40,
  },
  scrollViewContent: {
    padding: 20,
    paddingBottom: 100,
  },
  overviewCard: {
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  overviewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  overviewStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overviewStatItem: {
    alignItems: 'center',
  },
  overviewStatLabel: {
    fontSize: 11,
    color: '#BFDBFE',
    marginBottom: 4,
  },
  overviewStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    marginTop: 10,
  },
  salesCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  salesCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  salesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  salesName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  onlineStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  salesStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  salesStatItem: {
    width: '30%',
    alignItems: 'flex-start',
  },
  salesStatLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  salesStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 60,
    color: '#94a3b8',
    fontSize: 14,
  },
});

export default TeamSummaryScreen;
