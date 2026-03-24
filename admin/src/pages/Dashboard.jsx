import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

const COLORS = ['#27AE60', '#1565C0', '#e74c3c', '#f39c12', '#9b59b6', '#e67e22'];

export default function Dashboard() {
    const [overview, setOverview] = useState(null);
    const [daily, setDaily] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [branchStats, setBranchStats] = useState([]);
    const [paymentStats, setPaymentStats] = useState([]);
    const [funnel, setFunnel] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const [ov, da, tp, bs, ps, fn] = await Promise.all([
                    api.get('/analytics/overview'),
                    api.get('/analytics/daily', { params: { from: thirtyDaysAgo.toISOString(), to: new Date().toISOString() } }),
                    api.get('/analytics/products/top', { params: { limit: 10, period: '7' } }),
                    api.get('/analytics/branches/stats'),
                    api.get('/analytics/payments/stats'),
                    api.get('/analytics/orders/funnel'),
                ]);
                setOverview(ov.data);
                setDaily(da.data || []);
                setTopProducts(tp.data || []);
                setBranchStats(bs.data || []);
                setPaymentStats(ps.data || []);
                setFunnel(fn.data);
            } catch (err) { console.error(err); }
        };
        load();
    }, []);

    const stats = overview?.today || {};
    const changes = overview?.changes || {};

    const paymentPie = paymentStats.map(p => ({ name: p._id === 'click' ? 'Click' : 'Payme', value: p.count }));

    return (
        <div>
            <div className="topbar">
                <h2>📊 Dashboard</h2>
                <div className="topbar-actions">
                    <button className="btn" onClick={() => window.location.reload()}>🔄 Yangilash</button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="label">📦 Buyurtmalar</div>
                    <div className="value">{stats.totalOrders || 0}</div>
                    <div className={`change ${changes.orderChange >= 0 ? 'up' : 'down'}`}>
                        {changes.orderChange >= 0 ? '▲' : '▼'} {Math.abs(changes.orderChange || 0)}% kechaga
                    </div>
                </div>
                <div className="stat-card">
                    <div className="label">💰 Tushum</div>
                    <div className="value">{((stats.totalRevenue || 0) / 1000000).toFixed(1)}M</div>
                    <div className={`change ${changes.revenueChange >= 0 ? 'up' : 'down'}`}>
                        {changes.revenueChange >= 0 ? '▲' : '▼'} {Math.abs(changes.revenueChange || 0)}%
                    </div>
                </div>
                <div className="stat-card">
                    <div className="label">👥 Yangi foydalanuvchilar</div>
                    <div className="value">+{stats.newUsers || 0}</div>
                    <div className="change up">bugun</div>
                </div>
                <div className="stat-card">
                    <div className="label">✅ Konversiya</div>
                    <div className="value">{stats.conversionRate || 0}%</div>
                    <div className="change">yetkazildi/jami</div>
                </div>
            </div>

            {/* Charts */}
            <div className="chart-grid">
                <div className="chart-card">
                    <h3>📈 30 kunlik tushum va buyurtmalar</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={daily}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d38" />
                            <XAxis dataKey="date" tickFormatter={d => new Date(d).getDate()} stroke="#8b8fa3" fontSize={11} />
                            <YAxis stroke="#8b8fa3" fontSize={11} />
                            <Tooltip contentStyle={{ background: '#1a1d26', border: '1px solid #2a2d38', borderRadius: 8 }}
                                labelFormatter={d => new Date(d).toLocaleDateString()} />
                            <Line type="monotone" dataKey="totalRevenue" stroke="#27AE60" strokeWidth={2} dot={false} name="Tushum" />
                            <Line type="monotone" dataKey="totalOrders" stroke="#1565C0" strokeWidth={2} dot={false} name="Buyurtmalar" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="chart-card">
                    <h3>💳 To'lov usullari</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={paymentPie} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {paymentPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#1a1d26', border: '1px solid #2a2d38', borderRadius: 8 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Funnel */}
            {funnel && (
                <div className="chart-card" style={{ marginBottom: 24 }}>
                    <h3>🔄 Buyurtma funnel (30 kun)</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={[
                            { name: 'Yaratildi', count: funnel.created },
                            { name: "To'landi", count: funnel.paid },
                            { name: 'Tasdiqlandi', count: funnel.confirmed },
                            { name: "Yo'lda", count: funnel.on_the_way },
                            { name: 'Yetkazildi', count: funnel.delivered },
                            { name: 'Bekor', count: funnel.cancelled },
                        ]} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d38" />
                            <XAxis type="number" stroke="#8b8fa3" fontSize={11} />
                            <YAxis type="category" dataKey="name" width={90} stroke="#8b8fa3" fontSize={11} />
                            <Tooltip contentStyle={{ background: '#1a1d26', border: '1px solid #2a2d38', borderRadius: 8 }} />
                            <Bar dataKey="count" fill="#27AE60" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Tables */}
            <div className="chart-grid">
                <div className="data-table-wrapper">
                    <div className="data-table-header"><h3>🏆 Top 10 mahsulotlar (7 kun)</h3></div>
                    <table className="data-table">
                        <thead><tr><th>№</th><th>Nomi</th><th>Miqdor</th><th>Tushum</th></tr></thead>
                        <tbody>
                            {topProducts.map((p, i) => (
                                <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td>{p.name}</td>
                                    <td>{p.totalQty}</td>
                                    <td>{(p.totalRevenue || 0).toLocaleString()} сўм</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="data-table-wrapper">
                    <div className="data-table-header"><h3>🏥 Filiallar (bugun)</h3></div>
                    <table className="data-table">
                        <thead><tr><th>Filial</th><th>Buyurtma</th><th>%</th></tr></thead>
                        <tbody>
                            {branchStats.map((b, i) => (
                                <tr key={i}>
                                    <td>№{String(b.number).padStart(3, '0')} {b.name}</td>
                                    <td>{b.totalOrders}</td>
                                    <td>{Math.round(b.completionRate || 0)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
