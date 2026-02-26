import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    HiClipboardDocumentList, HiCheck, HiExclamationTriangle,
    HiArrowTrendingUp, HiCodeBracket,
} from 'react-icons/hi2';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell,
} from 'recharts';
import toast from 'react-hot-toast';

import {
    getTodaySessions, generateSessions, getStatsRange,
    getHabits, getLeetCodeStats, getPunishment,
    getProfile, updateProfile,
} from '../api';
import { getTodayKey, getDateKey, getGreeting } from '../utils/dateHelpers';
import CategoryIcon from '../components/CategoryIcon';

/* ── Stat card configs ── */
const STAT_CARDS = [
    { key: 'total', label: "Today's Sessions", icon: HiClipboardDocumentList, bg: 'bg-[#16a34a]', iconBg: 'bg-white/20' },
    { key: 'completed', label: 'Completed', icon: HiCheck, bg: 'bg-white', iconBg: 'bg-[#dcfce7]', border: true },
    { key: 'leetcode', label: 'LeetCode Today', icon: HiCodeBracket, bg: 'bg-white', iconBg: 'bg-[#fffbeb]', border: true },
    { key: 'backlog', label: 'Pending Backlog', icon: HiExclamationTriangle, bg: 'bg-white', iconBg: 'bg-[#fef2f2]', border: true },
];

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* ── Custom tooltip ── */
function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const pct = d?.pct ?? 0;
    return (
        <div style={{
            background: '#fff', padding: '10px 14px', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)', border: '1px solid #e2e8f0',
            fontSize: 12, lineHeight: 1.6, minWidth: 110,
        }}>
            <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{label}</p>
            <p style={{ color: '#16a34a' }}>Completed: <strong>{d?.completed ?? 0}</strong></p>
            <p style={{ color: '#94a3b8' }}>Total: {d?.total ?? 0}</p>
            <p style={{ color: pct >= 75 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 600, marginTop: 4 }}>
                {pct}% done
            </p>
        </div>
    );
}

/* ── Bar color by completion % ── */
function getBarColor(pct) {
    if (pct >= 75) return '#16a34a';   // green
    if (pct >= 50) return '#f59e0b';   // amber
    if (pct > 0) return '#ef4444';     // red
    return '#e2e8f0';                  // gray
}

export default function Dashboard() {
    const today = getTodayKey();
    const [sessions, setSessions] = useState([]);
    const [stats, setStats] = useState([]);
    const [backlogCount, setBacklogCount] = useState(0);
    const [lcUser, setLcUser] = useState('');
    const [lcInput, setLcInput] = useState('');
    const [lcStats, setLcStats] = useState(null);
    const [lcGoal, setLcGoal] = useState(500);
    const [habits, setHabits] = useState({});
    const [savingLc, setSavingLc] = useState(false);

    const loadData = useCallback(async () => {
        try {
            let sess = await getTodaySessions();
            if (sess.length === 0) sess = await generateSessions(today);
            setSessions(sess);

            const start = new Date();
            start.setDate(start.getDate() - 6);
            const s = await getStatsRange(getDateKey(start), today);
            setStats(s);

            const p = await getPunishment();
            setBacklogCount(p.length);

            const h = await getHabits(today);
            setHabits(h);

            // Load profile for LC username + target
            const profile = await getProfile();
            const username = profile?.leetcodeUsername || localStorage.getItem('lc_user') || '';
            setLcUser(username);
            setLcInput(username);
            if (profile?.leetcodeTarget && profile.leetcodeTarget >= 50) setLcGoal(profile.leetcodeTarget);

            if (username) {
                const lc = await getLeetCodeStats(username);
                setLcStats(lc);
            }
        } catch { }
    }, [today]);

    useEffect(() => { loadData(); }, [loadData]);

    const saveLcUser = async () => {
        if (!lcInput.trim()) return;
        setSavingLc(true);
        try {
            // Dual-write: localStorage + profile API
            localStorage.setItem('lc_user', lcInput.trim());
            await updateProfile({ leetcodeUsername: lcInput.trim() }).catch(() => { });
            setLcUser(lcInput.trim());
            const lc = await getLeetCodeStats(lcInput.trim());
            setLcStats(lc);
            toast.success(`Connected to ${lcInput.trim()}!`);
        } catch { toast.error('Failed to fetch LeetCode data'); }
        finally { setSavingLc(false); }
    };

    /* ── Derived data ── */
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;

    // Use LC API's real todayCount for the stat card
    const lcTodayCount = lcStats?.todayCount ?? 0;

    const statValues = {
        total: totalSessions,
        completed: completedSessions,
        leetcode: lcTodayCount,
        backlog: backlogCount,
    };

    const trendText = {
        total: totalSessions > 0 ? `${totalSessions} sessions today` : 'No sessions yet',
        completed: completedSessions > 0 ? `${Math.round((completedSessions / Math.max(totalSessions, 1)) * 100)}% completion rate` : 'Start checking off tasks',
        leetcode: lcTodayCount > 0 ? `${lcTodayCount} solved today` : 'No problems solved yet',
        backlog: backlogCount > 0 ? 'Items need attention' : 'All clear!',
    };

    // Bar chart data (last 7 days) — single bar colored by completion %
    const barData = stats.map(s => {
        const d = new Date(s.date + 'T00:00:00');
        const pct = s.sessionsTotal > 0 ? Math.round((s.sessionsCompleted / s.sessionsTotal) * 100) : 0;
        return {
            day: DOW[d.getDay()],
            completed: s.sessionsCompleted || 0,
            total: s.sessionsTotal || 0,
            pct,
            barColor: getBarColor(pct),
        };
    });

    // Upcoming sessions (pending, not past)
    const nowHHMM = new Date().toTimeString().slice(0, 5);
    const upcoming = sessions
        .filter(s => s.status !== 'completed' && (s.startTime === 'flexible' || s.startTime >= nowHHMM))
        .slice(0, 3);

    // LC Progress donut
    const lcTotal = lcStats?.totalSolved || 0;
    const lcPct = Math.min(100, Math.round((lcTotal / lcGoal) * 100));
    const donutData = [
        { name: 'Solved', value: lcTotal, color: '#16a34a' },
        { name: 'Remaining', value: Math.max(0, lcGoal - lcTotal), color: '#e2e8f0' },
    ];

    return (
        <div>
            {/* Page header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--color-text)]">Dashboard</h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {getGreeting()}! Track your daily progress and stay productive.
                </p>
            </div>

            {/* ── 4 Stat Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {STAT_CARDS.map(({ key, label, icon: Icon, bg, iconBg, border }) => (
                    <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`stat-card ${bg} ${border ? 'border border-[var(--color-border)]' : ''}`}
                    >
                        <div className={`stat-icon ${iconBg}`}>
                            <Icon className={key === 'total' ? 'text-white' : 'text-[var(--color-text)]'} />
                        </div>
                        <p className={`text-xs font-medium mb-1 ${key === 'total' ? 'text-white/80' : 'text-[var(--color-text-secondary)]'}`}>
                            {label}
                        </p>
                        <p className={`text-3xl font-bold mb-2 ${key === 'total' ? 'text-white' : 'text-[var(--color-text)]'}`}>
                            {statValues[key]}
                        </p>
                        <p className={`text-xs flex items-center gap-1 ${key === 'total' ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>
                            <HiArrowTrendingUp className="text-sm" />
                            {trendText[key]}
                        </p>
                    </motion.div>
                ))}
            </div>

            {/* ── Two column: Bar chart + Upcoming Sessions ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* Weekly Activity bar chart — colored by completion % */}
                <div className="col-span-2 card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-[var(--color-text)]">Weekly Activity</h3>
                        <div className="flex items-center gap-3 text-[10px]">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#16a34a]" /> ≥75%</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> ≥50%</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ef4444]" /> &lt;50%</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={barData} style={{ border: 'none' }}>
                            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="pct" radius={[6, 6, 0, 0]} barSize={36}>
                                {barData.map((entry, i) => (
                                    <Cell key={i} fill={entry.barColor} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    {barData.length > 0 && (
                        <div className="flex justify-between mt-2 text-xs text-[var(--color-text-muted)]">
                            <span>Average: {Math.round(barData.reduce((a, b) => a + b.pct, 0) / Math.max(barData.length, 1))}%</span>
                            <span>Peak: <strong className="text-[var(--color-primary)]">{Math.max(...barData.map(d => d.pct))}%</strong></span>
                        </div>
                    )}
                </div>

                {/* Upcoming Sessions */}
                <div className="card">
                    <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Upcoming Sessions</h3>
                    <div className="space-y-3">
                        {upcoming.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-muted)] py-4">No upcoming sessions</p>
                        ) : (
                            upcoming.map(s => (
                                <div key={s.id} className="p-3 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border-light)]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CategoryIcon category={s.category} name={s.name} className="text-sm text-[var(--color-text-secondary)]" />
                                        <p className="text-sm font-semibold text-[var(--color-text)]">{s.name}</p>
                                    </div>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        {s.startTime === 'flexible' ? 'Flexible' : `${s.startTime} – ${s.endTime}`}
                                    </p>
                                    {s.items?.length > 0 && (
                                        <span className="badge badge-blue mt-2 text-[10px]">{s.items.length} items</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ── Two column: Session Checklist + LC Progress ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Today's Sessions list */}
                <div className="col-span-2 card">
                    <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Today's Sessions</h3>
                    <div className="space-y-0">
                        {sessions.map(s => (
                            <div key={s.id} className="flex items-center gap-3 py-3 border-b border-[var(--color-border-light)] last:border-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${s.status === 'completed' ? 'bg-[#dcfce7] text-[var(--color-primary)]' : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
                                    }`}>
                                    <CategoryIcon category={s.category} name={s.name} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${s.status === 'completed' ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
                                        {s.name}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        {s.startTime === 'flexible' ? 'Flexible' : `${s.startTime}–${s.endTime}`}
                                        {s.items?.length > 0 && ` · ${s.items.filter(i => i.completed).length}/${s.items.length} items`}
                                    </p>
                                </div>
                                <span className={`text-xs font-semibold ${s.status === 'completed' ? 'status-completed' : 'status-pending'
                                    }`}>
                                    {s.status === 'completed' ? 'Completed' : s.status === 'active' ? 'In Progress' : 'Pending'}
                                </span>
                            </div>
                        ))}
                        {sessions.length === 0 && (
                            <p className="text-sm text-[var(--color-text-muted)] py-4">No sessions today</p>
                        )}
                    </div>
                </div>

                {/* LeetCode Progress donut */}
                <div className="card flex flex-col items-center">
                    <h3 className="text-base font-semibold text-[var(--color-text)] mb-4 self-start">LeetCode Progress</h3>
                    <div className="relative">
                        <ResponsiveContainer width={180} height={180}>
                            <PieChart>
                                <Pie
                                    data={donutData}
                                    dataKey="value"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={80}
                                    strokeWidth={0}
                                    startAngle={90}
                                    endAngle={-270}
                                >
                                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-[var(--color-text)]">{lcTotal}</span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">/ {lcGoal} goal</span>
                        </div>
                    </div>
                    <div className="flex gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" /> Solved
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#e2e8f0]" /> Remaining
                        </span>
                    </div>
                    {lcStats && (
                        <div className="grid grid-cols-3 gap-2 w-full mt-4 text-center">
                            <div className="bg-[#dcfce7] rounded-lg py-2">
                                <p className="text-sm font-bold text-[var(--color-primary)]">{lcStats.easySolved}</p>
                                <p className="text-[9px] text-[var(--color-primary)] uppercase">Easy</p>
                            </div>
                            <div className="bg-[#fffbeb] rounded-lg py-2">
                                <p className="text-sm font-bold text-[var(--color-warn)]">{lcStats.mediumSolved}</p>
                                <p className="text-[9px] text-[var(--color-warn)] uppercase">Med</p>
                            </div>
                            <div className="bg-[#fef2f2] rounded-lg py-2">
                                <p className="text-sm font-bold text-[var(--color-danger)]">{lcStats.hardSolved}</p>
                                <p className="text-[9px] text-[var(--color-danger)] uppercase">Hard</p>
                            </div>
                        </div>
                    )}
                    {/* LC Username input */}
                    {!lcUser ? (
                        <div className="w-full mt-4 pt-4 border-t border-[var(--color-border-light)]">
                            <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold mb-2">Connect LeetCode</p>
                            <div className="flex gap-2">
                                <input
                                    value={lcInput}
                                    onChange={e => setLcInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && saveLcUser()}
                                    placeholder="LeetCode username"
                                    className="input !py-1.5 !text-xs flex-1"
                                />
                                <button onClick={saveLcUser} disabled={savingLc} className="btn-primary !py-1.5 !px-3 !text-xs">
                                    {savingLc ? '...' : 'Connect'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-3">
                            Connected: <strong className="text-[var(--color-text-secondary)]">{lcUser}</strong>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
