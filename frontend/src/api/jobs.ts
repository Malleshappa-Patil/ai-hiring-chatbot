import { apiClient } from './client';

export const jobsApi = {
  list: async (params: { page?: number; status?: string; page_size?: number } = {}) => {
    const res = await apiClient.get('/jobs/', { params });
    return res.data; // expects { items: [], total: 0 }
  },
  get: async (id: string) => {
    const res = await apiClient.get(`/jobs/${id}`);
    return res.data;
  },
  create: async (data: any) => {
    const res = await apiClient.post('/jobs/', data);
    return res.data;
  },
  getJD: async (jobId: string) => {
    const res = await apiClient.get(`/jobs/${jobId}/jd`);
    return res.data;
  },
  approveJD: async (jobId: string) => {
    const res = await apiClient.post(`/jobs/${jobId}/jd/approve`);
    return res.data;
  },
  rejectJD: async (jobId: string, reason: string) => {
    const res = await apiClient.post(`/jobs/${jobId}/jd/reject`, { reason });
    return res.data;
  },
  delete: async (jobId: string) => {
    const res = await apiClient.delete(`/jobs/${jobId}`);
    return res.data;
  }
};
