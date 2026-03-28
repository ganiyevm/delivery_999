import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OrdersList from './pages/orders/OrdersList';
import ProductsList from './pages/products/ProductsList';
import BranchesList from './pages/branches/BranchesList';
import UsersList from './pages/users/UsersList';
import ImportPage from './pages/import/ImportPage';
import AdminAccountsPage from './pages/accounts/AdminAccountsPage';

function PrivateRoute({ children }) {
    const token = localStorage.getItem('admin_token');
    return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
    const isLogin = window.location.pathname === '/admin/login';

    if (isLogin) return <Login />;

    return (
        <PrivateRoute>
            <div className="admin-layout">
                <Sidebar />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/orders" element={<OrdersList />} />
                        <Route path="/products" element={<ProductsList />} />
                        <Route path="/branches" element={<BranchesList />} />
                        <Route path="/users" element={<UsersList />} />
                        <Route path="/import" element={<ImportPage />} />
                        <Route path="/accounts" element={<AdminAccountsPage />} />
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </main>
            </div>
        </PrivateRoute>
    );
}
