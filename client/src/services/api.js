import axios from 'axios';
import { supabase } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor: automatically attaches Supabase access token if session exists
apiClient.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.warn('[API Client] Could not resolve current session for request:', err.message);
  }
  return config;
}, (error) => Promise.reject(error));

/**
 * Fetch health status of the Express API and PostgreSQL
 */
export async function checkApiHealth() {
  try {
    const res = await apiClient.get('/health');
    return { ok: true, data: res.data };
  } catch (err) {
    return {
      ok: false,
      error: err.response?.data?.error?.message || err.message || 'Server connection failed.'
    };
  }
}

/**
 * GET /api/auth/me
 * Retrieves authenticated user and their ShowTracker profile
 */
export async function getMe() {
  const res = await apiClient.get('/auth/me');
  return res.data;
}

/**
 * GET /api/profiles/username-availability?username=...
 */
export async function checkUsernameAvailability(username) {
  const res = await apiClient.get('/profiles/username-availability', {
    params: { username }
  });
  return res.data;
}

/**
 * PATCH /api/profiles/me
 * Updates authenticated user's profile
 */
export async function updateMyProfile(profileData) {
  const res = await apiClient.patch('/profiles/me', profileData);
  return res.data;
}

/**
 * GET /api/users/:username
 * Public profile lookup
 */
export async function getPublicProfile(username) {
  const res = await apiClient.get(`/users/${encodeURIComponent(username)}`);
  return res.data;
}

export default {
  apiClient,
  checkApiHealth,
  getMe,
  checkUsernameAvailability,
  updateMyProfile,
  getPublicProfile
};
