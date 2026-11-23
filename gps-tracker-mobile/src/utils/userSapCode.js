export const requiresSapCode = (role) => role === 'sales';

export const acceptsSapCode = (role) => role === 'sales' || role === 'spv';

export const sapCodeForPayload = (role, value) => {
  if (!acceptsSapCode(role)) return null;
  const code = String(value ?? '').trim();
  return code || null;
};
