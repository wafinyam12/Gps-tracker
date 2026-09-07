import apiClient from '../client';

const appendIfPresent = (formData, key, value) => {
  if (value === undefined || value === null || value === '') {
    return;
  }

  formData.append(key, String(value));
};

const buildFormData = (payload) => {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'photo' || key === 'attachment') {
      return;
    }

    appendIfPresent(formData, key, value);
  });

  const photo = payload.photo || payload.attachment;
  if (photo?.uri) {
    formData.append('photo', {
      uri: photo.uri,
      name: photo.name || 'cash-payment.jpg',
      type: photo.type || 'image/jpeg',
    });
  }

  return formData;
};

export const cashPaymentService = {
  create: async (payload) => {
    const response = await apiClient.post('/cash-payments', buildFormData(payload));
    return response.data;
  },
};
