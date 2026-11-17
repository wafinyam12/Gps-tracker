export const getMonitoringMapScope = ({
  scopeTeamId,
  selectedTeamId,
  selectedBranchName,
  canAccessAllBranches,
}) => {
  if (!canAccessAllBranches) {
    return {
      label: selectedBranchName || (scopeTeamId ? 'Cabang saya' : 'Cakupan cabang belum tersedia'),
      canReturnToGlobal: false,
    };
  }

  if (selectedTeamId) {
    return {
      label: selectedBranchName || 'Cabang dipilih',
      canReturnToGlobal: true,
    };
  }

  return { label: 'Semua cabang', canReturnToGlobal: false };
};

export const getMonitoringMapDataState = ({ loadError, hasLocations }) => {
  if (loadError) return 'error';
  return hasLocations ? 'ready' : 'empty';
};

export const getSalesOnlineLabel = (isOnline) => (isOnline ? 'Online' : 'Offline');

export const findSelectedMonitoringBranch = (branches, teamId) => (
  teamId == null ? undefined : branches.find((branch) => String(branch.id) === String(teamId))
);
