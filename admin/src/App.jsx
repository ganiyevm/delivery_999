import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LangProvider } from './i18n';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const OrdersList = lazy(() => import('./pages/orders/OrdersList'));
const ProductsList = lazy(() => import('./pages/products/ProductsList'));
const BranchesList = lazy(() => import('./pages/branches/BranchesList'));
const UsersList = lazy(() => import('./pages/users/UsersList'));
const ImportPage = lazy(() => import('./pages/import/ImportPage'));
const AdminAccountsPage = lazy(() => import('./pages/accounts/AdminAccountsPage'));
const DeliverySettings = lazy(() => import('./pages/settings/DeliverySettings'));

function PageLoader() {
    return <div style={{ minHeight: 240, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}>Yuklanmoqda...</div>;
}

function PrivateRoute({ children }) {
    const token = localStorage.getItem('admin_token');
    return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
    const isLogin = window.location.pathname === '/admin/login';

    if (isLogin) return <LangProvider><Login /></LangProvider>;

    return (
        <LangProvider>
            <PrivateRoute>
                <div className="admin-layout">
                    <Sidebar />
                    <main className="main-content">
                        <Suspense fallback={<PageLoader />}>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/orders" element={<OrdersList />} />
                                <Route path="/products" element={<ProductsList />} />
                                <Route path="/branches" element={<BranchesList />} />
                                <Route path="/users" element={<UsersList />} />
                                <Route path="/import" element={<ImportPage />} />
                                <Route path="/accounts" element={<AdminAccountsPage />} />
                                <Route path="/delivery-settings" element={<DeliverySettings />} />
                                <Route path="*" element={<Navigate to="/" />} />
                            </Routes>
                        </Suspense>
                    </main>
                </div>
            </PrivateRoute>
        </LangProvider>
    );
}
