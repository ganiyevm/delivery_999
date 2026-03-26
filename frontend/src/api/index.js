import api from './axios';

export const authAPI = {
    telegramAuth: (initData) => api.post('/auth/telegram', { initData }),
    devLogin: () => api.post('/auth/dev-login'),
};

export const productsAPI = {
    getAll: (params) => api.get('/products', { params }),
    getById: (id) => api.get(`/products/${id}`),
    getByBarcode: (barcode) => api.get(`/products/barcode/${barcode}`),
};

export const branchesAPI = {
    getAll: () => api.get('/branches'),
    getById: (id) => api.get(`/branches/${id}`),
    getProducts: (id, params) => api.get(`/branches/${id}/products`, { params }),
};

export const ordersAPI = {
    create: (data) => api.post('/orders', data),
    getMy: () => api.get('/orders/my'),
    getById: (id) => api.get(`/orders/${id}`),
    cancel: (id) => api.post(`/orders/${id}/cancel`),
};

export const paymentAPI = {
    getStatus: (orderId) => api.get(`/payment/status/${orderId}`),
    checkClick: (orderId) => api.get(`/payment/click/check/${orderId}`),
    checkPayme: (orderId) => api.get(`/payment/payme/check/${orderId}`),
};

export const userAPI = {
    getProfile: () => api.get('/user/profile'),
    updateProfile: (data) => api.put('/user/profile', data),
    getFavorites: () => api.get('/user/favorites'),
    addFavorite: (id) => api.post(`/user/favorites/${id}`),
    removeFavorite: (id) => api.delete(`/user/favorites/${id}`),
    getAddresses: () => api.get('/user/addresses'),
    addAddress: (data) => api.post('/user/addresses', data),
    removeAddress: (id) => api.delete(`/user/addresses/${id}`),
    getBonus: () => api.get('/user/bonus'),
};
