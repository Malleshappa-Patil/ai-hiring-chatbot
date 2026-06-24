import { apiClient } from './client';

export const candidatesApi = {
  list: async (params?: { job_id?: string; status?: string; page?: number }) => {
    const res = await apiClient.get('/candidates/', { params });
    return res.data; // expects { items: [] }
  },
  ranked: async (jobId: string) => {
    const res = await apiClient.get(`/candidates/ranked/${jobId}`);
    return res.data; // expects array
  },
  approve: async (id: string) => {
    const res = await apiClient.post(`/candidates/${id}/approve`);
    return res.data;
  },
  reject: async (id: string, reason: string) => {
    const res = await apiClient.post(`/candidates/${id}/reject`, { reason });
    return res.data;
  }
};
