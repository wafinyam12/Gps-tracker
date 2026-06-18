import apiClient from '../client';

export const storeService = {
  getStores: async (params) => apiClient.get('/stores', { params }),
  getAvailableStores: async (params) => apiClient.get('/stores/available', { params }),
  getStore: async (id) => apiClient.get(`/stores/${id}`),
  createStore: async (data) => apiClient.post('/stores', data),
  updateStore: async (id, data) => apiClient.put(`/stores/${id}`, data),
  toggleStoreStatus: async (id) => apiClient.patch(`/stores/${id}/toggle-status`),
  deleteStore: async (id) => apiClient.delete(`/stores/${id}`),
  getStoreFilters: async () => apiClient.get('/stores/filters'),
};
