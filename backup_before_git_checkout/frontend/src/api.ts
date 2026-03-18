import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000/api'
});

export function setAuthToken(token: string) {
  if (import.meta.env.VITE_BYPASS_AUTH === 'true') {
    return;
  }

  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}
