import apiClient from '../client';
import { getJakartaDateString } from '../../utils/date';

const todayParams = () => {
  const today = getJakartaDateString();
  return { date_from: today, date_to: today };
};

export const reportService = {
  targetToday: async (params) => apiClient.get('/target/today', { params: params || todayParams() }),
  targetSummary: async (params) => apiClient.get('/target/summary', { params }),
  targetDetail: async (userId, params) => apiClient.get(`/target/detail/${userId}`, { params }),
  setTarget: async (data) => apiClient.post('/target/set', data),
  bulkSetTarget: async (data) => apiClient.post('/target/bulk-set', data),
  perSales: async (params) => apiClient.get('/reports/per-sales', { params }),
  perStore: async (params) => apiClient.get('/reports/per-store', { params }),
  exportVisits: async (params) => apiClient.get('/reports/export-visits', { params }),
  exportSalesSummary: async (params) => apiClient.get('/reports/export-sales-summary', { params }),
};
