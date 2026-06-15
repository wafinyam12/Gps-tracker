import apiClient from '../client';

export const visitService = {
  // Ambil jadwal hari ini
  getTodaySchedules: async () => {
    const response = await apiClient.get('/schedule/today');
    return response.data;
  },

  // Check-in
  checkIn: async (scheduleId, latitude, longitude, options = {}) => {
    const response = await apiClient.post('/visit/checkin', {
      visit_schedule_id: scheduleId,
      latitude,
      longitude,
      accuracy: options.accuracy,
      is_mock_location: options.isMockLocation || false,
    });
    return response.data;
  },

  startVisit: async (data) => {
    const response = await apiClient.post('/visit/start', data);
    return response.data;
  },

  // Check-out
  checkOut: async (scheduleId, visitResult, notes, options = {}) => {
    const response = await apiClient.post('/visit/checkout', {
      visit_schedule_id: scheduleId,
      visit_result: visitResult,
      notes,
      latitude: options.latitude,
      longitude: options.longitude,
      form_data: options.formData,
      submitted_at: options.submittedAt,
      submitted_by_user_id: options.userId,
      submitted_by_username: options.username,
    });
    return response.data;
  },

  // Skip kunjungan
  skipVisit: async (scheduleId, reason) => {
    const response = await apiClient.post('/visit/skip', {
      visit_schedule_id: scheduleId,
      skip_reason: reason,
    });
    return response.data;
  },

  // Upload foto (Multipart form data)
  uploadPhotos: async (visitLogId, photos, latitude, longitude, type = 'checkin', metadata = {}) => {
    const formData = new FormData();
    formData.append('visit_log_id', visitLogId);
    formData.append('type', type);
    if (latitude !== undefined && latitude !== null) formData.append('latitude', String(latitude));
    if (longitude !== undefined && longitude !== null) formData.append('longitude', String(longitude));
    if (metadata.takenAt) formData.append('taken_at', metadata.takenAt);
    if (metadata.userId) formData.append('submitted_by_user_id', String(metadata.userId));
    if (metadata.username) formData.append('submitted_by_username', metadata.username);

    photos.forEach((photo, index) => {
      formData.append('photos[]', {
        uri: photo.uri,
        name: `photo_${index}.jpg`,
        type: 'image/jpeg',
      });
    });

    const response = await apiClient.post('/visit/photos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getVisitPhotos: async (visitLogId) => {
    const response = await apiClient.get(`/visit/${visitLogId}/photos`);
    return response.data;
  },

  getVisit: async (visitLogId) => {
    const response = await apiClient.get(`/visits/${visitLogId}`);
    return response.data;
  },

  updateVisit: async (visitLogId, data) => {
    const response = await apiClient.patch(`/visits/${visitLogId}`, data);
    return response.data;
  },

  deleteVisit: async (visitLogId) => {
    const response = await apiClient.delete(`/visits/${visitLogId}`);
    return response.data;
  },

  deletePhoto: async (photoId) => {
    const response = await apiClient.delete(`/visit/photos/${photoId}`);
    return response.data;
  },
};
