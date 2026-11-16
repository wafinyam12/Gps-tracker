import assert from 'node:assert/strict';
import test from 'node:test';

const { formatUserValidationError } = await import('../src/utils/userFormValidation.js').catch(() => ({}));

test('user creation displays field-specific API validation errors', () => {
  const result = formatUserValidationError?.({
    message: 'Data yang dikirim tidak valid.',
    errors: {
      username: ['Username hanya boleh berisi huruf, angka, tanda hubung, dan garis bawah.'],
      team_id: ['Cabang yang dipilih tidak valid.'],
    },
  });

  assert.equal(
    result,
    'Username: Username hanya boleh berisi huruf, angka, tanda hubung, dan garis bawah.\nCabang: Cabang yang dipilih tidak valid.'
  );
});

test('user creation keeps the API message when no field errors are returned', () => {
  assert.equal(
    formatUserValidationError?.({ message: 'Akses ditolak.' }),
    'Akses ditolak.'
  );
});
