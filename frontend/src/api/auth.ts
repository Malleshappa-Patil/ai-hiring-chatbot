import { apiClient } from './client';

export const authApi = {
  login: async (credentials: any) => {
    const res = await apiClient.post('/auth/login', {
      email: credentials.username || credentials.email,
      password: credentials.password
    });
    return res.data;
  },
  register: async (payload: { email: string; password: string; full_name: string; company_name?: string; role?: string }) => {
    const res = await apiClient.post('/auth/register', payload);
    return res.data;
  },
  me: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  }
};
