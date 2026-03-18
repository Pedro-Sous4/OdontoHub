import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${baseUrl}/api`
});

export function setAuthToken(token: string) {
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}
