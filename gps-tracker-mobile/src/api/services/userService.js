import apiClient from '../client';

export const userService = {
  // Users
  getUsers: async (params) => apiClient.get('/users', { params }),
  getUser: async (id) => apiClient.get(`/users/${id}`),
  createUser: async (data) => apiClient.post('/users', data),
  updateUser: async (id, data) => apiClient.put(`/users/${id}`, data),
  toggleActiveUser: async (id) => apiClient.patch(`/users/${id}/toggle-active`),
  deleteUser: async (id) => apiClient.delete(`/users/${id}`),

  // Teams
  getTeams: async (params) => apiClient.get('/teams', { params }),
  getTeam: async (id) => apiClient.get(`/teams/${id}`),
  createTeam: async (data) => apiClient.post('/teams', data),
  updateTeam: async (id, data) => apiClient.put(`/teams/${id}`, data),
  toggleActiveTeam: async (id) => apiClient.patch(`/teams/${id}/toggle-active`),
  deleteTeam: async (id) => apiClient.delete(`/teams/${id}`),
};
