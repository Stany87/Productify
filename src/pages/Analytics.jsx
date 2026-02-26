import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';

import { getStatsRange, getLeetCodeStats } from '../api';
import { getTodayKey, getDateKey } from '../utils/dateHelpers';

const PIE_COLORS = ['#16a34a', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

export default function Analytics() {
    const today = getTodayKey();
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lcUser] = useState(localStorage.getItem('lc_user') || '');
    const [lcStats, setLcStats] = useState(null);

    useEffect(() => {
        const start = new Date();
        start.setDate(start.getDate() - 13);
        Promise.all([
            getStatsRange(getDateKey(start), today),
            lcUser ? getLeetCodeStats(lcUser) : Promise.resolve(null),
        ])
            .then(([s, lc]) => { setStats(s); setLcStats(lc); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [today, lcUser]);

    if (loading) return <div className="text-center text-[var(--color-text-muted)] py-16">Loading analytics...</div>;

    const thisWeek = stats.slice(-7);
    const lastWeek = stats.slice(0, 7);

    /* Summary numbers */
    const totalSessions = stats.reduce((s, d) => s + (d.sessionsCompleted || 0), 0);
    const totalLC = stats.reduce((s, d) => s + (d.leetcodeCompleted || 0), 0);
    const workoutDays = stats.filter(d => d.workoutDone).length;
    const avgWater = stats.length > 0 ? (stats.reduce((s, d) => s + (d.waterLiters || 0), 0) / stats.length).toFixed(1) : 0;

    /* Completion line chart data */
    const lineData = stats.map(s => ({
        date: s.date.slice(5),
        rate: s.sessionsTotal > 0 ? Math.round((s.sessionsCompleted / s.sessionsTotal) * 100) : 0,
    }));

    /* Weekly pie */
    const buildPie = (weekStats) => {
        const completed = weekStats.reduce((s, d) => s + (d.sessionsCompleted || 0), 0);
        const total = weekStats.reduce((s, d) => s + (d.sessionsTotal || 0), 0);
        const remaining = Math.max(0, total - completed);

        if (total === 0) {
            return [{ name: 'No Data', value: 1, color: '#e2e8f0' }];
        }

        const entries = [];
        if (completed > 0) entries.push({ name: 'Completed', value: completed, color: '#16a34a' });
        if (remaining > 0) entries.push({ name: 'Remaining', value: remaining, color: '#e2e8f0' });
        return entries;
    };

    /* LC bar data using actual LeetCode API history */
    const lcBarMap = new Map();
    if (lcStats?.recentActivity) {
        lcStats.recentActivity.forEach(a => {
            lcBarMap.set(a.date, a.count);
        });
    }

    const lcBarData = stats.map(s => ({
        date: s.date.slice(5),
        lc: lcBarMap.has(s.date) ? lcBarMap.get(s.date) : (s.leetcodeCompleted || 0),
    }));

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--color-text)]">Analytics</h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    14-day performance overview and trends.
                </p>
            </div>

            {/* ── Summary cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Sessions Done', value: totalSessions, color: 'text-[#16a34a]', bg: 'bg-[#dcfce7]' },
                    { label: 'LC Solved', value: totalLC, color: 'text-[#f59e0b]', bg: 'bg-[#fffbeb]' },
                    { label: 'Workouts', value: workoutDays, color: 'text-[#ef4444]', bg: 'bg-[#fef2f2]' },
                    { label: 'Avg Water (L)', value: avgWater, color: 'text-[#3b82f6]', bg: 'bg-[#eff6ff]' },
                ].map(({ label, value, color, bg }) => (
                    <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card text-center">
                        <p className={`text-3xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1 uppercase">{label}</p>
                    </motion.div>
                ))}
            </div>

            {/* ── Completion rate line chart ── */}
            <div className="card mb-6">
                <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Completion Rate Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={lineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
                        <Line type="monotone" dataKey="rate" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3, fill: '#16a34a' }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* ── Two column: Pie charts + LC bar chart ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* Weekly pie */}
                <div className="card">
                    <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">This Week</h3>
                    <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                            <Pie data={buildPie(thisWeek)} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} strokeWidth={0}>
                                {buildPie(thisWeek).map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 mt-2 justify-center">
                        {buildPie(thisWeek).map((d) => (
                            <span key={d.name} className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                                {d.name}
                            </span>
                        ))}
                    </div>
                </div>

                {/* LeetCode daily bar */}
                <div className="lg:col-span-2 card">
                    <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">Daily Submissions</h3>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={lcBarData}>
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="lc" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── LC breakdown ── */}
            {lcStats && (
                <div className="card">
                    <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Submissions Breakdown</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-[var(--color-bg)] rounded-lg">
                            <p className="text-2xl font-bold text-[var(--color-text)]">{lcStats.totalSolved}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)] uppercase mt-1">Total</p>
                        </div>
                        <div className="text-center p-4 bg-[#dcfce7] rounded-lg">
                            <p className="text-2xl font-bold text-[var(--color-primary)]">{lcStats.easySolved}</p>
                            <p className="text-[10px] text-[var(--color-primary)] uppercase mt-1">Easy</p>
                        </div>
                        <div className="text-center p-4 bg-[#fffbeb] rounded-lg">
                            <p className="text-2xl font-bold text-[var(--color-warn)]">{lcStats.mediumSolved}</p>
                            <p className="text-[10px] text-[var(--color-warn)] uppercase mt-1">Medium</p>
                        </div>
                        <div className="text-center p-4 bg-[#fef2f2] rounded-lg">
                            <p className="text-2xl font-bold text-[var(--color-danger)]">{lcStats.hardSolved}</p>
                            <p className="text-[10px] text-[var(--color-danger)] uppercase mt-1">Hard</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
