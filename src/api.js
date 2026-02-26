import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 30000 });

// ── JWT Token Management ──
export function setAuthToken(token) {
    if (token) {
        localStorage.setItem('productify_token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        localStorage.removeItem('productify_token');
        delete api.defaults.headers.common['Authorization'];
    }
}

// Restore token on load
const savedToken = localStorage.getItem('productify_token');
if (savedToken) {
    api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

// Auto-logout on 401
api.interceptors.response.use(
    r => r,
    err => {
        if (err.response?.status === 401 && !err.config.url.includes('/auth/')) {
            setAuthToken(null);
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// Auth
export const register = (email, password, displayName) => api.post('/auth/register', { email, password, displayName }).then(r => r.data);
export const login = (email, password) => api.post('/auth/login', { email, password }).then(r => r.data);
export const getMe = () => api.get('/auth/me').then(r => r.data);

// Profile
export const getProfile = () => api.get('/profile').then(r => r.data);
export const updateProfile = (data) => api.put('/profile', data).then(r => r.data);
export const changePassword = (currentPassword, newPassword) => api.put('/profile/password', { currentPassword, newPassword }).then(r => r.data);

// Sessions
export const getTodaySessions = () => api.get('/sessions/today').then(r => r.data);
export const getSessionsByDate = (date) => api.get(`/sessions/${date}`).then(r => r.data);
export const getMonthSessions = (year, month) => api.get(`/sessions/month/${year}/${month}`).then(r => r.data);
export const generateSessions = (date, sessions) => api.post(`/sessions/generate/${date}`, { sessions }).then(r => r.data);
export const updateSessionStatus = (id, status) => api.put(`/sessions/${id}/status`, { status }).then(r => r.data);
export const startSessionTracking = (id) => api.put(`/sessions/${id}/track/start`).then(r => r.data);
export const stopSessionTracking = (id) => api.put(`/sessions/${id}/track/stop`).then(r => r.data);
export const tickSessionItem = (itemId, completedCount) => api.put(`/sessions/items/${itemId}/tick`, { completedCount }).then(r => r.data);

// Punishment
export const getPunishment = () => api.get('/punishment').then(r => r.data);
export const getPunishmentHistory = () => api.get('/punishment/history').then(r => r.data);
export const processPunishment = () => api.post('/punishment/process').then(r => r.data);
export const tickPunishment = (id, count) => api.put(`/punishment/${id}/tick`, { count }).then(r => r.data);
export const resolvePunishment = (id) => api.put(`/punishment/${id}/resolve`).then(r => r.data);

// Habits
export const getHabits = (date) => api.get(`/habits/${date}`).then(r => r.data);
export const addWater = (amount) => api.post('/habits/water', { amount }).then(r => r.data);
export const toggleWorkout = () => api.post('/habits/workout').then(r => r.data);

// Stats
export const getStats = (date) => api.get(`/stats/${date}`).then(r => r.data);
export const getStatsRange = (start, end) => api.get(`/stats/range/query?start=${start}&end=${end}`).then(r => r.data);

// AI
export const generateSchedule = (data) => api.post('/ai/generate-schedule', data).then(r => r.data);
export const pivotSchedule = (reason, date) => api.post('/ai/pivot', { reason, date }).then(r => r.data);

// LeetCode
export const getLeetCodeStats = (username) => api.get(`/leetcode/${username}`).then(r => r.data);
