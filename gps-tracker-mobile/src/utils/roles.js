const ROLE_DISPLAY_NAMES = {
  sales: 'Sales',
  spv: 'Area Manager',
  manager: 'Manager',
  admin: 'Admin Cabang',
  superadmin: 'Super Admin',
};

export const getRoleName = (user) => user?.role || user?.roles?.[0]?.name || null;

export const getRoleDisplayName = (userOrRole) => {
  const role = typeof userOrRole === 'string' ? userOrRole : getRoleName(userOrRole);

  if (!role) {
    return 'User';
  }

  return ROLE_DISPLAY_NAMES[role] || role.toUpperCase();
};

export const canVisitStores = (user) => ['sales', 'spv'].includes(getRoleName(user));

export const isAdmin = (user) => ['admin', 'superadmin'].includes(getRoleName(user));

export const isManager = (user) => getRoleName(user) === 'manager';

export const canAccessMonitoring = (user) => ['admin', 'superadmin', 'spv', 'manager'].includes(getRoleName(user));
