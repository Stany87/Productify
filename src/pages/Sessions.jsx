import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
    HiCheck, HiPlus, HiArrowPath, HiFunnel, HiCalendarDays,
    HiMagnifyingGlass, HiXMark, HiShieldCheck,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';

import {
    getTodaySessions, generateSessions, updateSessionStatus,
    tickSessionItem, getHabits, addWater, toggleWorkout,
    pivotSchedule, getLeetCodeStats,
} from '../api';
import { getTodayKey, formatDate } from '../utils/dateHelpers';
import CategoryIcon from '../components/CategoryIcon';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Active' },
    { key: 'completed', label: 'Completed' },
];

const CATEGORIES = ['all', 'leetcode', 'study', 'coding', 'workout', 'other'];

export default function Sessions() {
    const today = getTodayKey();
    const [searchParams, setSearchParams] = useSearchParams();
    const [sessions, setSessions] = useState([]);
    const [habits, setHabits] = useState({});
    const [filter, setFilter] = useState('all');
    const [searchQ, setSearchQ] = useState(searchParams.get('q') || '');
    const [catFilter, setCatFilter] = useState('all');
    const [showCatDropdown, setShowCatDropdown] = useState(false);
    const [pivotText, setPivotText] = useState('');
    const [pivoting, setPivoting] = useState(false);
    const [lcVerified, setLcVerified] = useState(false);

    const load = useCallback(async () => {
        try {
            let sess = await getTodaySessions();
            if (sess.length === 0) sess = await generateSessions(today);
            setSessions(sess);
            setHabits(await getHabits(today));

            // LC verification — check if user actually solved today
            const lcUser = localStorage.getItem('lc_user');
            if (lcUser) {
                const lc = await getLeetCodeStats(lcUser);
                if (lc?.todayCount > 0) setLcVerified(true);
            }
        } catch { }
    }, [today]);

    useEffect(() => { load(); }, [load]);

    // Sync URL search param
    useEffect(() => {
        const q = searchParams.get('q');
        if (q) setSearchQ(q);
    }, [searchParams]);

    /* Handlers — OPTIMISTIC: update UI first, API in background */
    const handleToggle = async (session) => {
        const newStatus = session.status === 'completed' ? 'pending' : 'completed';
        // Optimistic update — instant UI feedback
        setSessions(prev => prev.map(s =>
            s.id === session.id ? { ...s, status: newStatus } : s
        ));
        try {
            await updateSessionStatus(session.id, newStatus);
        } catch {
            // Rollback on failure
            setSessions(prev => prev.map(s =>
                s.id === session.id ? { ...s, status: session.status } : s
            ));
            toast.error('Failed to update');
        }
    };

    const handleTick = async (itemId, current, target) => {
        const newCount = current >= target ? 0 : target;
        const newCompleted = newCount >= target ? 1 : 0;
        // Optimistic update — instant UI feedback
        setSessions(prev => prev.map(s => ({
            ...s,
            items: s.items?.map(item =>
                item.id === itemId
                    ? { ...item, completedCount: newCount, completed: newCompleted }
                    : item
            ),
        })));
        try {
            await tickSessionItem(itemId, newCount);
        } catch {
            // Rollback — re-fetch from server
            toast.error('Failed');
            load();
        }
    };

    const handleWater = async () => {
        try { await addWater(0.5); setHabits(await getHabits(today)); toast.success('+500ml 💧', { duration: 1200 }); } catch { }
    };

    const handleWorkout = async () => {
        try { await toggleWorkout(); setHabits(await getHabits(today)); } catch { }
    };

    const handlePivot = async () => {
        if (!pivotText.trim()) return;
        setPivoting(true);
        try {
            const result = await pivotSchedule(pivotText, today);
            if (result.sessions?.length > 0) {
                await generateSessions(today, result.sessions);
                toast.success('Schedule restructured! 🔄');
                setPivotText('');
                load();
            } else {
                toast.error('AI returned an empty schedule format. Try rewording.');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'AI Pivot request failed');
        } finally {
            setPivoting(false);
        }
    };

    const handleSearch = (val) => {
        setSearchQ(val);
        if (val) setSearchParams({ q: val });
        else setSearchParams({});
    };

    /* Derived */
    const waterVal = habits.water?.currentValue || 0;
    const waterTarget = habits.water?.targetValue || 4;
    const glasses = Math.floor(waterVal / 0.5);
    const glassTarget = Math.floor(waterTarget / 0.5);
    const workoutDone = habits.workout?.currentValue > 0;

    const filtered = sessions
        .filter(s => filter === 'all' || s.status === filter)
        .filter(s => catFilter === 'all' || (s.category || 'other').toLowerCase() === catFilter)
        .filter(s => !searchQ || s.name.toLowerCase().includes(searchQ.toLowerCase()));

    const countByStatus = {
        all: sessions.length,
        pending: sessions.filter(s => s.status !== 'completed').length,
        completed: sessions.filter(s => s.status === 'completed').length,
    };

    return (
        <div>
            {/* Page header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--color-text)]">Sessions</h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    Manage and complete your daily sessions efficiently.
                </p>
            </div>

            {/* Quick actions */}
            <div className="flex gap-3 mb-5">
                <button onClick={handleWater} className="btn-outline">
                    <span>💧</span> Water: {glasses}/{glassTarget}
                </button>
                <button onClick={handleWorkout} className={`btn-outline ${workoutDone ? '!border-[var(--color-primary)] !text-[var(--color-primary)]' : ''}`}>
                    <span>🏋️</span> Workout: {workoutDone ? '✅ Done' : 'Not yet'}
                </button>
                {lcVerified && (
                    <div className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-primary)] font-semibold bg-[#dcfce7] px-3 py-1.5 rounded-lg">
                        <HiShieldCheck className="text-sm" /> LeetCode Verified Today
                    </div>
                )}
            </div>

            {/* Pivot bar */}
            <div className="card flex gap-3 items-center mb-5">
                <HiArrowPath className="text-[var(--color-text-muted)] text-lg flex-shrink-0" />
                <input
                    value={pivotText}
                    onChange={e => setPivotText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePivot()}
                    placeholder="college cancelled, free afternoon..."
                    className="input !border-0 !bg-transparent !p-0"
                />
                <button onClick={handlePivot} disabled={pivoting} className="btn-primary !py-2 !px-4 !text-xs whitespace-nowrap">
                    {pivoting ? '...' : 'AI Pivot'}
                </button>
            </div>

            {/* Search + Filter row */}
            <div className="flex items-center justify-between mb-4">
                <div className="search-bar !w-[280px]">
                    <HiMagnifyingGlass className="text-[var(--color-text-muted)]" />
                    <input
                        value={searchQ}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="Search sessions..."
                    />
                    {searchQ && (
                        <button onClick={() => handleSearch('')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                            <HiXMark className="text-sm" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 relative">
                    {/* Category filter dropdown */}
                    <button
                        onClick={() => setShowCatDropdown(!showCatDropdown)}
                        className={`btn-outline !py-2 !px-3 !text-xs ${catFilter !== 'all' ? '!border-[var(--color-primary)] !text-[var(--color-primary)]' : ''}`}
                    >
                        <HiFunnel className="text-sm" />
                        {catFilter === 'all' ? 'Filter' : catFilter}
                    </button>
                    {showCatDropdown && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => { setCatFilter(cat); setShowCatDropdown(false); }}
                                    className={`block w-full text-left px-3 py-2 text-xs capitalize hover:bg-[var(--color-surface-hover)] transition ${catFilter === cat ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--color-text-secondary)]'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-4">
                {FILTERS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`badge transition-all cursor-pointer ${filter === f.key ? 'badge-green' : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'}`}
                    >
                        {f.label} ({countByStatus[f.key]})
                    </button>
                ))}
            </div>

            {/* Session cards */}
            <div className="space-y-3">
                <AnimatePresence>
                    {filtered.map(session => {
                        const isDone = session.status === 'completed';
                        const isPunishment = session.type === 'punishment';
                        return (
                            <motion.div
                                key={session.id}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -30 }}
                                className={`card ${isPunishment ? '!border-[var(--color-danger)]/30' : ''}`}
                            >
                                <div className="flex items-start gap-3">
                                    <button
                                        onClick={() => handleToggle(session)}
                                        className={`check-box mt-0.5 ${isDone ? 'checked' : ''}`}
                                    >
                                        <HiCheck className="text-xs" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h4 className={`text-sm font-semibold ${isDone ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
                                                {session.name}
                                            </h4>
                                            <div className="flex items-center gap-2">
                                                {isPunishment && <span className="badge badge-red text-[10px]">Backlog</span>}
                                                <span className={`badge text-[10px] ${isDone ? 'badge-green' : session.status === 'active' ? 'badge-blue' : 'badge-amber'}`}>
                                                    {isDone ? 'Completed' : session.status === 'active' ? 'In Progress' : 'Pending'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
                                            <CategoryIcon category={session.category} name={session.name} className="text-sm" />
                                            <span>{session.category || 'other'}</span>
                                            <span>{session.startTime === 'flexible' ? 'Flexible' : `${session.startTime}–${session.endTime}`}</span>
                                        </div>
                                        {session.category && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                <span className="badge bg-[var(--color-bg)] text-[var(--color-text-secondary)] text-[10px]">{session.category}</span>
                                            </div>
                                        )}

                                        {/* Sub-items */}
                                        {session.items?.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] space-y-2">
                                                {session.items.map(item => {
                                                    const isLcItem = (item.category || '').toLowerCase() === 'leetcode';
                                                    return (
                                                        <div key={item.id} className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-xs ${item.completed ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-secondary)]'}`}>
                                                                    {item.title}
                                                                </span>
                                                                {isLcItem && lcVerified && (
                                                                    <span className="flex items-center gap-0.5 text-[9px] text-[var(--color-primary)] font-semibold">
                                                                        <HiShieldCheck className="text-xs" /> Verified
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => handleTick(item.id, item.completedCount, item.targetCount)}
                                                                className={`check-box !w-[18px] !h-[18px] !rounded-[3px] ${item.completed ? 'checked' : ''}`}
                                                            >
                                                                <HiCheck className="text-[10px]" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {filtered.length === 0 && (
                    <div className="text-center text-[var(--color-text-muted)] py-8 text-sm">
                        No sessions match your filter
                    </div>
                )}
            </div>
        </div>
    );
}
