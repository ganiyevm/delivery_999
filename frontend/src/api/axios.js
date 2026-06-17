import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        // 401: tokenni faqat auth endpointlari uchun tozalash
        // Oddiy so'rovlarda localStorage ni saqlaymiz — AuthContext o'zi yangilaydi
        if (err.response?.status === 401) {
            const url = err.config?.url || '';
            if (url.includes('/auth/')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        return Promise.reject(err);
    }
);

export default api;
