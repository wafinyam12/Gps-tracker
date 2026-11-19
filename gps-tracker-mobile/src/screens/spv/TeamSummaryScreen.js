import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AlertTriangle, ArrowRight, Calendar, RefreshCw, SlidersHorizontal } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import moment from 'moment';
import { reportService } from '../../api/services/reportService';
import { teamService } from '../../api/services/teamService';
import { useAuth } from '../../context/AuthContext';
import { getRoleName } from '../../utils/roles';
import { logEvent } from '../../utils/diagnosticLogger';
import { canChooseMonitoringBranch, getMonitoringSummaryMetrics, getMonitoringSummaryState } from '../../utils/monitoringSummaryPresentation';
import AppScreen from '../../components/ui/AppScreen';
import VisitHeader from '../../components/visit/VisitHeader';
import { visitColors, visitRadii, visitSpacing, visitType } from '../../styles/visitTheme';

const TeamSummaryScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const roleName = getRoleName(user);
  const isSpv = roleName === 'spv';
  const canChooseBranch = canChooseMonitoringBranch(roleName);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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

  const fetchTeams = async () => {
    try {
      const response = await teamService.getTeams();
      const payload = response.data?.data;
      setTeams(Array.isArray(payload) ? payload : payload?.data || []);
    } catch (error) {
      logEvent('teams.fetch_failed', { status: error.response?.status, error_code: error.code });
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const formattedDate = moment(selectedDate).format('YYYY-MM-DD');
      const response = await reportService.targetSummary({
        date_from: formattedDate,
        date_to: formattedDate,
        team_id: canChooseBranch ? selectedTeamId || undefined : user?.branch?.id || user?.team?.id || undefined,
      });
      setSummaryData(response.data?.data || response.data || null);
    } catch (error) {
      logEvent('teams.summary_fetch_failed', { status: error.response?.status, error_code: error.code });
      setSummaryData(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(React.useCallback(() => {
    fetchSummary();
  }, [selectedDate, selectedTeamId, canChooseBranch, user?.branch?.id, user?.team?.id]));

  const onDateChange = (_event, nextDate) => {
    setShowDatePicker(false);
    if (nextDate) setSelectedDate(nextDate);
  };

  const metrics = getMonitoringSummaryMetrics(summaryData);
  const summaryState = getMonitoringSummaryState({ loading, loadError, summaryData });
  const warnings = Array.isArray(summaryData?.warnings) ? summaryData.warnings : [];
  const fixedBranchName = user?.branch?.name || user?.team?.name || 'Cabang saya';
  const selectedBranchName = teams.find((team) => String(team.id) === String(selectedTeamId))?.name || 'Semua cabang';
  const branchLabel = canChooseBranch ? selectedBranchName : fixedBranchName;
  const alertButton = (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Buka peringatan audit" onPress={() => navigation.navigate('Alerts')} style={styles.headerAction}>
      <AlertTriangle size={20} color={visitColors.warning} />
    </TouchableOpacity>
  );

  return (
    <AppScreen style={styles.screen} contentStyle={styles.screenContent} edges={['top', 'bottom', 'left', 'right']}>
      <VisitHeader title="Ringkasan kunjungan" subtitle={branchLabel} onBack={() => navigation.goBack()} right={alertButton} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.filters}>
          <TouchableOpacity accessibilityRole="button" onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
            <Calendar size={18} color={visitColors.primary} />
            <Text style={styles.dateText}>{moment(selectedDate).format('DD MMMM YYYY')}</Text>
          </TouchableOpacity>
          {showDatePicker ? <DateTimePicker value={selectedDate} mode="date" display="default" onChange={onDateChange} /> : null}
          {canChooseBranch ? (
            <View style={styles.pickerWrap}>
              <Picker selectedValue={selectedTeamId} onValueChange={setSelectedTeamId} style={styles.picker}>
                <Picker.Item label="Semua cabang" value="" />
                {teams.map((team) => <Picker.Item key={team.id} label={team.name} value={String(team.id)} />)}
              </Picker>
            </View>
          ) : <Text style={styles.fixedBranch}>Hanya data {fixedBranchName}</Text>}
        </View>

        {isSpv ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Atur target harian Sales"
            onPress={() => navigation.navigate('TargetRange', { initialDate: moment(selectedDate).format('YYYY-MM-DD') })}
            style={styles.targetAction}
            activeOpacity={0.85}
          >
            <View style={styles.targetActionIcon}><SlidersHorizontal size={20} color={visitColors.primary} /></View>
            <View style={styles.targetActionCopy}>
              <Text style={styles.targetActionTitle}>Atur target harian</Text>
              <Text style={styles.targetActionText}>Untuk semua atau beberapa Sales di cabang ini</Text>
            </View>
            <ArrowRight size={18} color={visitColors.primary} />
          </TouchableOpacity>
        ) : null}

        {summaryState === 'loading' ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={visitColors.primary} />
            <Text style={styles.stateText}>Memuat ringkasan cabang...</Text>
          </View>
        ) : summaryState === 'error' ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Ringkasan belum bisa dimuat</Text>
            <Text style={styles.stateText}>Periksa koneksi lalu coba lagi.</Text>
            <TouchableOpacity accessibilityRole="button" onPress={fetchSummary} style={styles.retryButton}>
              <RefreshCw size={16} color={visitColors.primary} />
              <Text style={styles.retryText}>Coba lagi</Text>
            </TouchableOpacity>
          </View>
        ) : summaryState === 'empty' ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Belum ada ringkasan</Text>
            <Text style={styles.stateText}>Pilih tanggal lain atau perbarui saat data kunjungan tersedia.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Target kunjungan</Text>
            <View style={styles.progressCard}>
              <View style={styles.progressTop}>
                <Text style={styles.progressValue}>{metrics.overview.unique} dari {metrics.overview.target}</Text>
                <Text style={styles.progressPercent}>{metrics.overview.completion}% {metrics.overview.excess > 0 ? `· melebihi target ${metrics.overview.excess}` : 'selesai'}</Text>
              </View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: metrics.overview.fill + '%' }]} /></View>
              <Text style={styles.progressMeta}>{metrics.overview.duplicate} kunjungan duplikat · {metrics.overview.warnings} peringatan audit</Text>
            </View>

            {warnings.length > 0 ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Perlu perhatian</Text>
                {warnings.slice(0, 3).map((warning, index) => (
                  <Text key={String(warning.date || index) + '-' + index} style={styles.warningText}>
                    {warning.message || 'Ada target kunjungan yang perlu ditinjau.'}
                  </Text>
                ))}
                <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Alerts')} style={styles.warningAction}>
                  <Text style={styles.warningActionText}>Lihat semua peringatan</Text>
                  <ArrowRight size={16} color={visitColors.warning} />
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Progress tim</Text>
            {metrics.sales.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateTitle}>Belum ada data Sales</Text>
                <Text style={styles.stateText}>Pilih tanggal lain atau perbarui ringkasan saat data tersedia.</Text>
              </View>
            ) : metrics.sales.map((item) => (
              <View
                key={String(item.userId)}
                style={styles.salesRow}
              >
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Lihat posisi ' + item.name} onPress={() => navigation.navigate('SalesDetail', { userId: item.userId })} style={styles.salesTop}>
                  <Text style={styles.salesName}>{item.name}</Text>
                  <ArrowRight size={18} color={visitColors.primary} />
                </TouchableOpacity>
                <Text style={styles.salesProgress}>{item.unique} dari {item.target} toko · {item.completion}% {item.excess > 0 ? `· melebihi target ${item.excess}` : 'selesai'}</Text>
                <View style={styles.salesTrack}><View style={[styles.salesFill, { width: item.fill + '%' }]} /></View>
                <Text style={styles.salesAudit}>Duplikat {item.duplicate} · Mock GPS {item.mockGps} · Check-in invalid {item.invalidCheckins}</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Lihat kunjungan ' + item.name} onPress={() => navigation.navigate('TeamVisitList', { userId: item.userId, salesName: item.name, date: moment(selectedDate).format('YYYY-MM-DD') })} style={styles.visitListAction}>
                  <Text style={styles.visitListActionText}>Lihat kunjungan</Text>
                  <ArrowRight size={16} color={visitColors.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: visitColors.canvas },
  screenContent: { paddingTop: 0, paddingBottom: 0 },
  content: { paddingHorizontal: visitSpacing.page, paddingTop: visitSpacing.card, paddingBottom: visitSpacing.sectionLarge },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: visitColors.warningTint, borderRadius: visitRadii.control },
  filters: { gap: visitSpacing.sm },
  dateButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm, paddingHorizontal: visitSpacing.md, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.control },
  dateText: { ...visitType.body, color: visitColors.ink },
  pickerWrap: { minHeight: 48, justifyContent: 'center', backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.control },
  picker: { color: visitColors.ink },
  fixedBranch: { ...visitType.caption, color: visitColors.mutedInk, paddingVertical: visitSpacing.sm },
  targetAction: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.md, padding: visitSpacing.card, marginTop: visitSpacing.section, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card },
  targetActionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: visitColors.primaryTint, borderRadius: visitRadii.control },
  targetActionCopy: { flex: 1, minWidth: 0 },
  targetActionTitle: { ...visitType.section, color: visitColors.ink },
  targetActionText: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.xs },
  sectionTitle: { ...visitType.section, color: visitColors.ink, marginTop: visitSpacing.sectionLarge, marginBottom: visitSpacing.sm },
  progressCard: { padding: visitSpacing.card, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card },
  progressTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: visitSpacing.sm },
  progressValue: { fontSize: 24, lineHeight: 30, fontWeight: '600', color: visitColors.ink },
  progressPercent: { ...visitType.label, color: visitColors.mutedInk },
  progressTrack: { height: 8, marginTop: visitSpacing.card, borderRadius: visitRadii.pill, backgroundColor: visitColors.primaryTint, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: visitColors.primary, borderRadius: visitRadii.pill },
  progressMeta: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.md },
  warningCard: { padding: visitSpacing.card, marginTop: visitSpacing.section, borderRadius: visitRadii.card, backgroundColor: visitColors.warningTint },
  warningTitle: { ...visitType.section, color: visitColors.warning },
  warningText: { ...visitType.body, color: visitColors.warning, marginTop: visitSpacing.sm },
  warningAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm, marginTop: visitSpacing.sm },
  warningActionText: { ...visitType.label, color: visitColors.warning },
  salesRow: { padding: visitSpacing.card, marginBottom: visitSpacing.sm, borderWidth: 1, borderColor: visitColors.border, borderRadius: visitRadii.card, backgroundColor: visitColors.surface },
  salesTop: { flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm },
  salesName: { ...visitType.section, color: visitColors.ink, flex: 1 },
  salesProgress: { ...visitType.body, color: visitColors.ink, marginTop: visitSpacing.sm },
  salesTrack: { height: 6, backgroundColor: visitColors.primaryTint, borderRadius: visitRadii.pill, overflow: 'hidden', marginTop: visitSpacing.sm },
  salesFill: { height: '100%', backgroundColor: visitColors.primary },
  salesAudit: { ...visitType.caption, color: visitColors.mutedInk, marginTop: visitSpacing.sm },
  visitListAction: { minHeight: 44, borderTopWidth: 1, borderTopColor: visitColors.border, marginTop: visitSpacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  visitListActionText: { ...visitType.label, color: visitColors.primary },
  stateCard: { padding: visitSpacing.card, borderRadius: visitRadii.card, backgroundColor: visitColors.surface, borderWidth: 1, borderColor: visitColors.border, alignItems: 'flex-start', gap: visitSpacing.sm },
  stateTitle: { ...visitType.section, color: visitColors.ink },
  stateText: { ...visitType.body, color: visitColors.mutedInk },
  retryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: visitSpacing.sm, paddingHorizontal: visitSpacing.md },
  retryText: { ...visitType.label, color: visitColors.primary },
});

export default TeamSummaryScreen;
