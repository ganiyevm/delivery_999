import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useT } from '../i18n';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

/* ─────────────────────────────────────────────────────────────── Constants */
const PERIODS = [
    { key: 'week', label: '7 kun' },
    { key: 'month', label: '30 kun' },
    { key: 'quarter', label: 'Chorak' },
    { key: 'year', label: 'Yil' },
];

const FUNNEL_STEPS = [
    { key: 'total',     label: 'Jami',       color: '#6c7a95' },
    { key: 'paid',      label: 'To\'langan',  color: '#3b82f6' },
    { key: 'confirmed', label: 'Tasdiqlangan',color: '#8b5cf6' },
    { key: 'on_the_way',label: 'Yetkazilmoqda',color: '#f59e0b' },
    { key: 'delivered', label: 'Yetkazildi',  color: '#10b981' },
];

const PIE_COLORS  = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
const MEDALS      = ['🥇', '🥈', '🥉'];

const STATUS_META = {
    awaiting_payment: { color: '#f59e0b', label: 'To\'lov kutilmoqda' },
    pending_operator: { color: '#6c7a95', label: 'Operator kutmoqda' },
    confirmed:        { color: '#3b82f6', label: 'Tasdiqlandi' },
    on_the_way:       { color: '#8b5cf6', label: 'Yo\'lda' },
    delivered:        { color: '#10b981', label: 'Yetkazildi' },
    cancelled:        { color: '#ef4444', label: 'Bekor' },
    rejected:         { color: '#ef4444', label: 'Rad etildi' },
};

/* ──────────────────────────────────────────────────── useAnimatedNumber */
function useAnimatedNumber(target, duration = 900) {
    const [val, setVal]   = useState(0);
    const raf             = useRef(null);
    const startRef        = useRef(null);
    const prevRef         = useRef(0);

    useEffect(() => {
        if (typeof target !== 'number' || isNaN(target)) return;
        const from = prevRef.current;
        prevRef.current = target;
        startRef.current = null;
        if (raf.current) cancelAnimationFrame(raf.current);
        const tick = (ts) => {
            if (!startRef.current) startRef.current = ts;
            const p = Math.min((ts - startRef.current) / duration, 1);
            const e = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(from + (target - from) * e));
            if (p < 1) raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
        return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    }, [target, duration]);

    return val;
}

/* ──────────────────────────────────────────────────── KPI Card */
function KpiCard({ label, value, display, change, sub, color, index }) {
    const anim = useAnimatedNumber(value || 0, 1000);
    const up   = change == null ? null : change >= 0;

    return (
        <div className="bi-kpi" style={{ animationDelay: `${index * 70}ms` }}>
            <div className="bi-kpi__label">{label}</div>
            <div className="bi-kpi__value" style={{ color }}>
                {display ?? anim.toLocaleString()}
            </div>
            {up !== null ? (
                <div className={`bi-kpi__change ${up ? 'up' : 'down'}`}>
                    {up ? '▲' : '▼'} {Math.abs(change || 0)}%
                    <span className="bi-kpi__sub"> {sub}</span>
                </div>
            ) : (
                <div className="bi-kpi__change neutral">{sub}</div>
            )}
        </div>
    );
}

/* ──────────────────────────────────────────────────── Period Tabs */
const PeriodTabs = ({ value, onChange }) => (
    <div className="bi-period-tabs">
        {PERIODS.map(p => (
            <button key={p.key}
                className={`bi-period-btn${value === p.key ? ' active' : ''}`}
                onClick={() => onChange(p.key)}>
                {p.label}
            </button>
        ))}
    </div>
);

/* ──────────────────────────────────────────────────── Custom Tooltip */
const ChartTooltip = ({ active, payload, label, period }) => {
    if (!active || !payload?.length) return null;
    const fmt = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        if (period === 'year')    return dt.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
        if (period === 'quarter') return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
        return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
    };
    return (
        <div style={{
            background: '#1a1d26', border: '1px solid #2a2d38', borderRadius: 10,
            padding: '10px 14px', fontSize: 12, minWidth: 140,
        }}>
            <div style={{ color: '#8b8fa3', marginBottom: 6, fontWeight: 600 }}>{fmt(label)}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.color, marginBottom: 3 }}>
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 800 }}>
                        {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

/* ──────────────────────────────────────────────────── Helpers */
const fmtMoney = (v) => {
    if (!v) return '0';
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000)    return `${(v / 1000).toFixed(0)}K`;
    return v.toLocaleString();
};

/* ══════════════════════════════════════════════════ Dashboard */
export default function Dashboard() {
    const { t } = useT();
    const [period,        setPeriod]        = useState('month');
    const [overview,      setOverview]      = useState(null);
    const [periodSummary, setPeriodSummary] = useState(null);
    const [chartData,     setChartData]     = useState([]);
    const [topProducts,   setTopProducts]   = useState([]);
    const [branchStats,   setBranchStats]   = useState([]);
    const [paymentStats,  setPaymentStats]  = useState([]);
    const [userStats,     setUserStats]     = useState(null);
    const [funnel,        setFunnel]        = useState(null);
    const [recentOrders,  setRecentOrders]  = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [now,           setNow]           = useState(new Date());

    useEffect(() => {
        const tick = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(tick);
    }, []);

    useEffect(() => {
        api.get('/analytics/overview').then(r => setOverview(r.data)).catch(() => {});
        api.get('/admin/recent-orders').then(r => setRecentOrders(r.data || [])).catch(() => {});
        api.get('/analytics/users/stats').then(r => setUserStats(r.data)).catch(() => {});
    }, []);

    const loadPeriod = useCallback(async (p) => {
        setLoading(true);
        const days = PERIODS.find(x => x.key === p)?.key === 'week' ? 7 : p === 'quarter' ? 90 : p === 'year' ? 365 : 30;
        try {
            const [summary, chart, tp, bs, ps, fn] = await Promise.all([
                api.get('/analytics/period-summary', { params: { period: p } }),
                api.get('/analytics/period-chart',   { params: { period: p } }),
                api.get('/analytics/products/top',   { params: { limit: 8, period: days } }),
                api.get('/analytics/branches/stats', { params: { period: p } }),
                api.get('/analytics/payments/stats', { params: { period: p } }),
                api.get('/analytics/orders/funnel',  { params: { period: p } }),
            ]);
            setPeriodSummary(summary.data);
            setChartData(chart.data || []);
            setTopProducts(tp.data || []);
            setBranchStats(bs.data || []);
            setPaymentStats(ps.data || []);
            setFunnel(fn.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadPeriod(period); }, [period, loadPeriod]);

    /* ── Derived ── */
    const tod     = overview?.today    || {};
    const todCh   = overview?.changes  || {};
    const curr    = periodSummary?.current || {};
    const sumCh   = periodSummary?.changes || {};
    const pLabel  = PERIODS.find(x => x.key === period)?.label || '';

    const payPie = paymentStats.map(p => ({
        name:  p._id === 'click' ? 'Click' : p._id === 'payme' ? 'Payme' : p._id,
        value: p.count,
        total: p.total,
    }));
    const payTotal = payPie.reduce((s, x) => s + x.value, 0);

    const funnelTotal = funnel?.total || 1;

    const xFmt = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        if (period === 'year')    return dt.toLocaleDateString('ru-RU', { month: 'short' });
        if (period === 'quarter') return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
        return dt.getDate();
    };

    const hour       = now.getHours();
    const greeting   = hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';
    const adminName  = localStorage.getItem('admin_fullname') || 'Admin';

    const timeAgo = (date) => {
        const diff = Math.floor((now - new Date(date)) / 60000);
        if (diff < 1)    return 'Hozirgina';
        if (diff < 60)   return `${diff} min`;
        if (diff < 1440) return `${Math.floor(diff / 60)} soat`;
        return `${Math.floor(diff / 1440)} kun`;
    };

    return (
        <div className="bi-dash">

            {/* ══ Topbar ══ */}
            <div className="bi-topbar">
                <div>
                    <h2 className="bi-topbar__title">
                        {greeting}, <strong>{adminName}</strong>
                    </h2>
                    <div className="bi-topbar__date">
                        {now.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        <span className="bi-topbar__time">
                            &nbsp;·&nbsp;{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
                <div className="bi-topbar__right">
                    <PeriodTabs value={period} onChange={setPeriod} />
                    <button className="bi-refresh" onClick={() => loadPeriod(period)} disabled={loading}>
                        <span className={loading ? 'spin' : ''}>↺</span>
                    </button>
                </div>
            </div>

            {/* ══ KPI Row ══ */}
            <div className="bi-kpi-row">
                <KpiCard index={0} label={t('todayOrders') || "Bugungi buyurtmalar"}
                    value={tod.totalOrders || 0}
                    change={todCh.orderChange}
                    sub="kecha nisbatan"
                    color="#10b981" />
                <KpiCard index={1} label={`Daromad (${pLabel})`}
                    value={curr.totalRevenue || 0}
                    display={
                        curr.totalRevenue >= 1000000
                            ? `${(curr.totalRevenue / 1000000).toFixed(1)}M`
                            : `${((curr.totalRevenue || 0) / 1000).toFixed(0)}K`
                    }
                    change={sumCh.revenueChange}
                    sub="oldingi davr nisbatan"
                    color="#3b82f6" />
                <KpiCard index={2} label={`Yangi foydalanuvchilar (${pLabel})`}
                    value={curr.newUsers || 0}
                    display={`+${curr.newUsers || 0}`}
                    change={sumCh.userChange}
                    sub="oldingi davr nisbatan"
                    color="#8b5cf6" />
                <KpiCard index={3} label="Konversiya (bugun)"
                    value={tod.conversionRate || 0}
                    display={`${tod.conversionRate || 0}%`}
                    change={null}
                    sub={`${tod.completedOrders || 0} / ${tod.totalOrders || 0} yetkazildi`}
                    color="#f59e0b" />
            </div>

            {/* ══ Main Row: Combo Chart + Donut ══ */}
            <div className="bi-main-row">
                {/* Combo bar+line chart */}
                <div className="bi-card bi-card--wide">
                    <div className="bi-card__head">
                        <span className="bi-card__title">Buyurtmalar va daromad</span>
                        <span className="bi-card__badge">{pLabel}</span>
                    </div>
                    {loading ? (
                        <div className="bi-skeleton" style={{ height: 260 }} />
                    ) : (
                        <ResponsiveContainer width="100%" height={270}>
                            <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="date" tickFormatter={xFmt}
                                    stroke="transparent" tick={{ fill: '#8b8fa3', fontSize: 11 }}
                                    tickLine={false} axisLine={false} />
                                <YAxis yAxisId="orders" orientation="left" stroke="transparent"
                                    tick={{ fill: '#8b8fa3', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="rev" orientation="right" stroke="transparent"
                                    tick={{ fill: '#8b8fa3', fontSize: 11 }} tickLine={false} axisLine={false}
                                    tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${(v/1000).toFixed(0)}K`} />
                                <Tooltip content={<ChartTooltip period={period} />} />
                                <Bar yAxisId="orders" dataKey="totalOrders" fill="url(#barGrad)"
                                    radius={[4, 4, 0, 0]} name="Buyurtmalar" animationDuration={1000} />
                                <Line yAxisId="rev" type="monotone" dataKey="totalRevenue"
                                    stroke="#10b981" strokeWidth={2.5} dot={false}
                                    name="Daromad" animationDuration={1200} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                    <div className="bi-chart-legend">
                        <div className="bi-legend-item">
                            <div className="bi-legend-dot" style={{ background: '#3b82f6' }} />
                            <span>Buyurtmalar</span>
                        </div>
                        <div className="bi-legend-item">
                            <div className="bi-legend-line" style={{ background: '#10b981' }} />
                            <span>Daromad</span>
                        </div>
                    </div>
                </div>

                {/* Payment donut */}
                <div className="bi-card bi-card--donut">
                    <div className="bi-card__head">
                        <span className="bi-card__title">To'lov usullari</span>
                        <span className="bi-card__badge">{pLabel}</span>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={payPie.length ? payPie : [{ name: '-', value: 1 }]}
                                    cx="50%" cy="50%"
                                    innerRadius={62} outerRadius={90}
                                    paddingAngle={3} dataKey="value"
                                    startAngle={90} endAngle={-270}
                                    animationDuration={1000}>
                                    {(payPie.length ? payPie : [{ name: '-', value: 1 }]).map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center label */}
                        <div className="bi-donut-center">
                            <div className="bi-donut-center__val">{payTotal.toLocaleString()}</div>
                            <div className="bi-donut-center__lbl">jami</div>
                        </div>
                    </div>
                    <div className="bi-pie-legends">
                        {payPie.map((p, i) => (
                            <div key={i} className="bi-pie-row">
                                <div className="bi-pie-dot" style={{ background: PIE_COLORS[i] }} />
                                <span className="bi-pie-name">{p.name}</span>
                                <span className="bi-pie-count" style={{ color: PIE_COLORS[i] }}>{p.value}</span>
                                <span className="bi-pie-total">{fmtMoney(p.total)} so'm</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══ Second Row: User Stats + Funnel + Branch Stats ══ */}
            <div className="bi-second-row">
                {/* User mini stats */}
                <div className="bi-card bi-card--stats">
                    <div className="bi-card__head">
                        <span className="bi-card__title">Foydalanuvchilar</span>
                    </div>
                    <div className="bi-stat-list">
                        {[
                            { label: 'Jami',      val: userStats?.total     || 0, color: '#e4e7ec' },
                            { label: 'Bugun yangi',val: userStats?.todayNew  || 0, color: '#10b981' },
                            { label: '7 kunda',   val: userStats?.weekNew   || 0, color: '#3b82f6' },
                            { label: 'Oyda yangi', val: userStats?.monthNew  || 0, color: '#8b5cf6' },
                            { label: 'Faol (hafta)',val: userStats?.activeWeek|| 0, color: '#f59e0b' },
                        ].map((s, i) => (
                            <div key={i} className="bi-stat-row">
                                <span className="bi-stat-label">{s.label}</span>
                                <span className="bi-stat-val" style={{ color: s.color }}>
                                    {s.val.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                    {/* Funnel (cancelled) */}
                    {funnel && (
                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                            <div className="bi-card__title" style={{ marginBottom: 10 }}>Bekor qilinganlar</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    fontSize: 28, fontWeight: 800, color: '#ef4444', lineHeight: 1,
                                }}>{funnel.cancelled || 0}</div>
                                <div style={{ fontSize: 11, color: '#8b8fa3', lineHeight: 1.5 }}>
                                    buyurtma<br />
                                    {funnelTotal > 0 ? Math.round((funnel.cancelled / funnelTotal) * 100) : 0}% dan
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Order Funnel */}
                <div className="bi-card bi-card--funnel">
                    <div className="bi-card__head">
                        <span className="bi-card__title">Buyurtma tunneli</span>
                        <span className="bi-card__badge">{pLabel}</span>
                    </div>
                    <div className="bi-funnel">
                        {FUNNEL_STEPS.map((step, i) => {
                            const count = funnel?.[step.key] || 0;
                            const pct   = funnelTotal > 0 ? Math.round((count / funnelTotal) * 100) : 0;
                            const prev  = i > 0 ? (funnel?.[FUNNEL_STEPS[i - 1].key] || 0) : 0;
                            const drop  = i > 0 && prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0;
                            return (
                                <div key={step.key} className="bi-funnel-step">
                                    <div className="bi-funnel-step__label" style={{ color: step.color }}>
                                        {step.label}
                                    </div>
                                    <div className="bi-funnel-step__track">
                                        <div className="bi-funnel-step__fill"
                                            style={{ width: `${pct}%`, background: step.color }} />
                                    </div>
                                    <div className="bi-funnel-step__right">
                                        <span className="bi-funnel-step__count">{count.toLocaleString()}</span>
                                        {i > 0 && drop > 0 && (
                                            <span className="bi-funnel-step__drop">▼{drop}%</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Branch stats */}
                <div className="bi-card bi-card--branches">
                    <div className="bi-card__head">
                        <span className="bi-card__title">Filiallar reytingi</span>
                        <span className="bi-card__badge" style={{ color: '#10b981', background: 'rgba(16,185,129,0.12)' }}>
                            {pLabel}
                        </span>
                    </div>
                    <div className="bi-branch-list">
                        {branchStats.slice(0, 8).map((b, i) => {
                            const pct   = Math.round(b.completionRate || 0);
                            const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
                            return (
                                <div key={i} className="bi-branch-row">
                                    <div className="bi-branch-name">
                                        <span style={{ color: '#8b8fa3', fontSize: 11, marginRight: 6 }}>
                                            №{String(b.number).padStart(3, '0')}
                                        </span>
                                        {b.name?.length > 14 ? b.name.slice(0, 14) + '…' : b.name}
                                    </div>
                                    <div className="bi-branch-bar">
                                        <div className="bi-branch-fill" style={{ width: `${pct}%`, background: color }} />
                                    </div>
                                    <div className="bi-branch-stats">
                                        <span style={{ color, fontWeight: 700, fontSize: 11 }}>{pct}%</span>
                                        <span style={{ color: '#8b8fa3', fontSize: 11 }}>{b.totalOrders}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ══ Bottom Row: Recent Orders + Top Products ══ */}
            <div className="bi-bottom-row">
                {/* Recent orders */}
                <div className="bi-card">
                    <div className="bi-card__head">
                        <span className="bi-card__title">So'nggi buyurtmalar</span>
                        <a href="/orders" style={{ fontSize: 12, color: '#3b82f6' }}>Barchasi →</a>
                    </div>
                    <div className="bi-orders">
                        {recentOrders.map((o, i) => {
                            const st = STATUS_META[o.status] || STATUS_META.pending_operator;
                            return (
                                <div key={o._id} className="bi-order-row" style={{ animationDelay: `${i * 40}ms` }}>
                                    <div className="bi-order-left">
                                        <div className="bi-order-num">{o.orderNumber}</div>
                                        <div className="bi-order-info">
                                            <span>{o.customerName || '—'}</span>
                                            {o.branch && <span style={{ color: '#8b8fa3' }}> · №{String(o.branch.number).padStart(3, '0')}</span>}
                                        </div>
                                    </div>
                                    <div className="bi-order-right">
                                        <span className="bi-order-amt">{fmtMoney(o.total)} so'm</span>
                                        <span className="bi-order-status" style={{ color: st.color, background: st.color + '18' }}>
                                            {st.label}
                                        </span>
                                        <span className="bi-order-time">{timeAgo(o.createdAt)}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {recentOrders.length === 0 && (
                            <div style={{ color: '#8b8fa3', textAlign: 'center', padding: 32 }}>Ma'lumot yo'q</div>
                        )}
                    </div>
                </div>

                {/* Top Products */}
                <div className="bi-card">
                    <div className="bi-card__head">
                        <span className="bi-card__title">Top mahsulotlar</span>
                        <span className="bi-card__badge">{pLabel}</span>
                    </div>
                    <table className="bi-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Nomi</th>
                                <th>Soni</th>
                                <th>Daromad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topProducts.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: '#8b8fa3' }}>
                                        Ma'lumot yo'q
                                    </td>
                                </tr>
                            )}
                            {topProducts.map((p, i) => (
                                <tr key={i}>
                                    <td style={{ fontSize: 15 }}>{MEDALS[i] || i + 1}</td>
                                    <td style={{ fontWeight: 600, maxWidth: 180 }}>{p.name}</td>
                                    <td>
                                        <span className="bi-badge bi-badge--blue">{p.totalQty}</span>
                                    </td>
                                    <td style={{ fontWeight: 700, color: '#10b981' }}>
                                        {fmtMoney(p.totalRevenue)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
