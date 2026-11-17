const FIELD_LABELS = {
  name: 'Nama Lengkap',
  username: 'Username',
  email: 'Email',
  password: 'Password',
  phone: 'Nomor Telepon',
  employee_id: 'NIK / Employee ID',
  slpCode: 'Kode Sales SAP',
  team_id: 'Cabang',
  role: 'Role',
  is_active: 'Status Aktif',
};

export const getUserFieldErrors = (responseData) => {
  const errors = responseData?.errors;
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return {};
  return Object.fromEntries(Object.entries(errors).flatMap(([field, messages]) => {
    if (!Object.prototype.hasOwnProperty.call(FIELD_LABELS, field)) return [];
    const message = Array.isArray(messages) ? messages[0] : messages;
    return typeof message === 'string' && message.trim() ? [[field, message.trim()]] : [];
  }));
};

export const formatUserValidationError = (responseData) => {
  const errors = responseData?.errors;
  if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
    const details = Object.entries(errors).flatMap(([field, messages]) => {
      const message = Array.isArray(messages) ? messages[0] : messages;
      if (typeof message !== 'string' || !message.trim()) return [];
      return [`${FIELD_LABELS[field] || field}: ${message.trim()}`];
    });
    if (details.length > 0) return details.join('\n');
  }

  return responseData?.message || 'Terjadi kesalahan saat menyimpan data';
};
