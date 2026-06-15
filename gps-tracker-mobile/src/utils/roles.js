export const getRoleName = (user) => user?.role || user?.roles?.[0]?.name || null;

export const canVisitStores = (user) => ['sales', 'spv'].includes(getRoleName(user));

export const isAdmin = (user) => getRoleName(user) === 'admin';
