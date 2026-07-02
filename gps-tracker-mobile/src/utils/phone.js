export const normalizePhoneNumber = (value) => {
  const raw = value === null || value === undefined ? '' : String(value).trim();

  if (!raw) {
    return '';
  }

  const digits = raw.replace(/\D+/g, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith('62')) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `+62${digits.slice(1)}`;
  }

  if (digits.startsWith('8')) {
    return `+62${digits}`;
  }

  return `+${digits}`;
};
