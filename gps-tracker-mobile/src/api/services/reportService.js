import apiClient from '../client';

const todayParams = () => {
  const today = new Date().toISOString().split('T')[0];
  return { date_from: today, date_to: today };
};

export const reportService = {
  mySummary: async (params) => apiClient.get('/reports/my-summary', { params: params || todayParams() }),
  visitSummary: async (params) => apiClient.get('/reports/visit-summary', { params }),
  perSales: async (params) => apiClient.get('/reports/per-sales', { params }),
  perStore: async (params) => apiClient.get('/reports/per-store', { params }),
  exportVisits: async (params) => apiClient.get('/reports/export-visits', { params }),
  exportSalesSummary: async (params) => apiClient.get('/reports/export-sales-summary', { params }),
};
