import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Calendar, ChevronLeft, Users, AlertTriangle, ChevronRight } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import moment from 'moment';
import { reportService } from '../../api/services/reportService';
import { teamService } from '../../api/services/teamService';
import { useAuth } from '../../context/AuthContext';
import { getRoleName } from '../../utils/roles';

const TeamSummaryScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const roleName = getRoleName(user);
  const isSpv = roleName === 'spv';
  const canChooseBranch = !isSpv;
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
    if (isSpv && (user?.branch?.id || user?.team?.id)) {
      setSelectedTeamId((user?.branch?.id || user?.team?.id).toString());
    }
  }, [isSpv, user]);

  useEffect(() => {
    fetchSummary();
  }, [selectedDate, selectedTeamId, isSpv, user]);

  const fetchTeams = async () => {
    try {
      const response = await teamService.getTeams();
      const payload = response.data?.data;
      setTeams(Array.isArray(payload) ? payload : payload?.data || []);
    } catch (error) {
      console.log('Error fetching teams', error.response?.data || error);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const formattedDate = moment(selectedDate).format('YYYY-MM-DD');
      const response = await reportService.targetSummary({
        date_from: formattedDate,
        date_to: formattedDate,
        team_id: canChooseBranch ? selectedTeamId || undefined : user?.branch?.id || user?.team?.id || undefined,
      });
      setSummaryData(response.data?.data || response.data || null);
    } catch (error) {
      console.log('Error fetching summary', error.response?.data || error);
      Alert.alert('Error', 'Gagal mengambil ringkasan cabang');
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event, nextDate) => {
    setShowDatePicker(false);
    if (nextDate) {
      setSelectedDate(nextDate);
    }
  };

  const overviewCards = useMemo(() => {
    const overview = summaryData?.overview || {};
    return [
      { label: 'Target', value: overview.target_visits ?? 0 },
      { label: 'Visit Unik', value: overview.unique_visits ?? 0 },
      { label: 'Duplicate', value: overview.duplicate_visits ?? 0 },
      { label: 'Progress', value: `${overview.completion_pct ?? 0}%` },
    ];
  }, [summaryData]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>Memuat ringkasan cabang...</Text>
      </View>
    );
  }

  const sales = Array.isArray(summaryData?.sales) ? summaryData.sales : [];
  const warnings = Array.isArray(summaryData?.warnings) ? summaryData.warnings : [];

  return (
      <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ringkasan Visit Cabang</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Alerts')} style={styles.alertBtn}>
          <AlertTriangle size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerBtn}>
          <Calendar size={18} color="#0F766E" />
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
        {canChooseBranch ? (
          <View style={styles.teamPickerContainer}>
            <Picker
              selectedValue={selectedTeamId}
              onValueChange={(itemValue) => setSelectedTeamId(itemValue)}
              style={styles.teamPicker}
            >
              <Picker.Item label="Semua Cabang" value="" />
              {teams.map((team) => (
                <Picker.Item key={team.id} label={team.name} value={team.id.toString()} />
              ))}
            </Picker>
          </View>
        ) : (
          <View style={styles.selectedBranchPill}>
            <Text style={styles.selectedBranchText}>{user?.branch?.name || user?.team?.name || 'Cabang Saya'}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        {!!summaryData?.team_summary && (
          <View style={styles.overviewCard}>
            <Text style={styles.overviewTitle}>Ringkasan Global</Text>
            <View style={styles.overviewStatsGrid}>
              {overviewCards.map((item) => (
                <View key={item.label} style={styles.overviewStatItem}>
                  <Text style={styles.overviewStatLabel}>{item.label}</Text>
                  <Text style={styles.overviewStatValue}>{item.value}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.overviewNote}>
              Warning audit: {summaryData.team_summary.warning_count ?? 0}
            </Text>
          </View>
        )}

        {!!warnings.length && (
          <View style={styles.warningPanel}>
            <Text style={styles.warningPanelTitle}>Warning Audit</Text>
            {warnings.slice(0, 3).map((warning, index) => (
              <Text key={`${warning.date || index}-${index}`} style={styles.warningPanelText}>
                {warning.message || `Hari ${warning.date} belum mencapai target.`}
              </Text>
            ))}
          </View>
        )}

            <Text style={styles.sectionTitle}>Progress Sales</Text>
        {sales.length > 0 ? sales.map((item) => {
          const summary = item.summary || {};
          return (
            <TouchableOpacity
              key={item.user_id}
              style={styles.salesCard}
              onPress={() => navigation.navigate('SalesDetail', { userId: item.user_id })}
            >
              <View style={styles.salesCardHeader}>
                <View style={styles.salesInfo}>
                  <Users size={20} color="#1E293B" />
                  <Text style={styles.salesName}>{item.name}</Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </View>

              <View style={styles.salesStatsGrid}>
                <View style={styles.salesStatItem}>
                  <Text style={styles.salesStatLabel}>Target</Text>
                  <Text style={styles.salesStatValue}>{summary.target_visits ?? 0}</Text>
                </View>
                <View style={styles.salesStatItem}>
                  <Text style={styles.salesStatLabel}>Unik</Text>
                  <Text style={styles.salesStatValue}>{summary.unique_visits ?? 0}</Text>
                </View>
                <View style={styles.salesStatItem}>
                  <Text style={styles.salesStatLabel}>Duplicate</Text>
                  <Text style={styles.salesStatValue}>{summary.duplicate_visits ?? 0}</Text>
                </View>
                <View style={styles.salesStatItem}>
                  <Text style={styles.salesStatLabel}>Progress</Text>
                  <Text style={styles.salesStatValue}>{summary.completion_pct ?? 0}%</Text>
                </View>
                <View style={styles.salesStatItem}>
                  <Text style={styles.salesStatLabel}>Mock GPS</Text>
                  <Text style={styles.salesStatValue}>{summary.mock_detected ?? 0}</Text>
                </View>
                <View style={styles.salesStatItem}>
                  <Text style={styles.salesStatLabel}>Invalid</Text>
                  <Text style={styles.salesStatValue}>{summary.invalid_checkins ?? 0}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }) : (
          <Text style={styles.emptyText}>Tidak ada data sales untuk tanggal ini.</Text>
        )}
        <View style={{ height: Platform.OS === 'android' ? 64 : 40 }} />
      </ScrollView>
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
    paddingTop: Platform.OS === 'android' ? 24 : 0,
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
    flex: 1,
    textAlign: 'center',
  },
  backBtn: {
    padding: 8,
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
    gap: 10,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7F1EF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F766E',
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
  selectedBranchPill: {
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 150,
    justifyContent: 'center',
  },
  selectedBranchText: {
    color: '#075985',
    fontWeight: '700',
    fontSize: 14,
  },
  teamPicker: {
    height: 40,
  },
  scrollViewContent: {
    padding: 20,
    paddingBottom: Platform.OS === 'android' ? 124 : 100,
  },
  overviewCard: {
    backgroundColor: '#0F766E',
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
    flexWrap: 'wrap',
    gap: 10,
  },
  overviewStatItem: {
    width: '48%',
  },
  overviewStatLabel: {
    fontSize: 11,
    color: '#BFE3DD',
    marginBottom: 4,
  },
  overviewStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  overviewNote: {
    marginTop: 10,
    color: '#D9F3EE',
    fontSize: 12,
  },
  warningPanel: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    marginBottom: 18,
  },
  warningPanelTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#B45309',
    marginBottom: 6,
  },
  warningPanelText: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 4,
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
    gap: 10,
  },
  salesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  salesName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    flexShrink: 1,
  },
  salesStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  salesStatItem: {
    width: '30%',
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
