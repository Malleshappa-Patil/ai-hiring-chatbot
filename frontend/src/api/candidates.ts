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
  },
  select: async (id: string) => {
    const res = await apiClient.post(`/candidates/${id}/select`);
    return res.data;
  },
  rejectFinal: async (id: string) => {
    const res = await apiClient.post(`/candidates/${id}/reject-final`);
    return res.data;
  },
};

export const interviewsApi = {
  schedule: async (payload: {
    candidate_id: string;
    job_id: string;
    scheduled_at: string;  // ISO 8601
    duration_minutes: number;
    interviewer: string;
    interview_type: string;
  }) => {
    const res = await apiClient.post('/interviews/', payload);
    return res.data;
  },
  list: async (params?: { job_id?: string; candidate_id?: string }) => {
    const res = await apiClient.get('/interviews/', { params });
    return res.data;
  },
  updateStatus: async (id: string, status: string) => {
    const res = await apiClient.patch(`/interviews/${id}/status`, null, { params: { status } });
    return res.data;
  },
};
