const MONITORING_ROLES = new Set(['spv', 'manager', 'admin', 'superadmin']);
const VISIT_ROLES = new Set(['spv', 'manager']);
const MANAGEMENT_ROLES = new Set(['admin', 'superadmin']);

export const getMonitoringDashboardActions = (roleName) => {
  if (!MONITORING_ROLES.has(roleName)) return [];

  return [
    'LiveMap',
    ...(MANAGEMENT_ROLES.has(roleName) ? ['UserList', 'TeamList'] : []),
    'TeamSummary',
    ...(VISIT_ROLES.has(roleName) ? ['Home'] : []),
    'Profile',
  ];
};
