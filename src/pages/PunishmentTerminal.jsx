import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiPlus, HiCheck, HiExclamationTriangle, HiArrowPath } from 'react-icons/hi2';
import toast from 'react-hot-toast';

import { getPunishment, getPunishmentHistory, tickPunishment, resolvePunishment } from '../api';
import CategoryIcon from '../components/CategoryIcon';

export default function PunishmentTerminal() {
    const [active, setActive] = useState([]);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    const load = useCallback(async () => {
        try {
            setActive(await getPunishment());
            setHistory(await getPunishmentHistory());
        } catch { }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleTick = async (id) => {
        try {
            const item = active.find(i => i.id === id);
            await tickPunishment(id, (item?.completedCount || 0) + 1);
            toast.success('+1 ✓', { duration: 1000 });
            load();
        } catch { toast.error('Failed'); }
    };

    const handleResolve = async (id) => {
        try {
            await resolvePunishment(id);
            toast.success('Resolved! 🎉');
            load();
        } catch { toast.error('Failed'); }
    };

    const resolved = history.filter(h => h.resolved);
    const isOverdue = (originalDate) => (Date.now() - new Date(originalDate).getTime()) / (1000 * 60 * 60 * 24) > 3;

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#fef2f2] flex items-center justify-center">
                    <HiExclamationTriangle className="text-[var(--color-danger)] text-lg" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">Backlog</h1>
                    <p className="text-sm text-[var(--color-text-secondary)]">Missed items carry forward as punishment tasks.</p>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="card text-center">
                    <p className="text-2xl font-bold text-[var(--color-danger)]">{active.length}</p>
                    <p className="text-xs text-[var(--color-text-muted)] uppercase mt-1">Pending</p>
                </div>
                <div className="card text-center">
                    <p className="text-2xl font-bold text-[var(--color-primary)]">{resolved.length}</p>
                    <p className="text-xs text-[var(--color-text-muted)] uppercase mt-1">Resolved</p>
                </div>
                <div className="card text-center">
                    <p className="text-2xl font-bold text-[var(--color-text)]">
                        {history.length > 0 ? Math.round((resolved.length / history.length) * 100) : 0}%
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] uppercase mt-1">Clear Rate</p>
                </div>
            </div>

            {/* Active items */}
            <div className="space-y-3">
                <AnimatePresence>
                    {active.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card text-center py-10">
                            <div className="w-12 h-12 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-3">
                                <HiCheck className="text-[var(--color-primary)] text-xl" />
                            </div>
                            <p className="text-sm text-[var(--color-text-secondary)]">All clear — no pending backlog!</p>
                        </motion.div>
                    ) : (
                        active.map(item => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className={`card ${isOverdue(item.originalDate) ? '!border-[var(--color-danger)]' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isOverdue(item.originalDate) ? 'bg-[#fef2f2] text-[var(--color-danger)]' : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
                                            }`}>
                                            <CategoryIcon category={item.category} name={item.title} className="text-sm" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-[var(--color-text)]">{item.title}</p>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                <span className="badge bg-[var(--color-bg)] text-[var(--color-text-secondary)] text-[10px]">{item.category}</span>
                                                <span className="text-[10px] text-[var(--color-text-muted)]">from {item.originalDate}</span>
                                                {item.sourceSession && (
                                                    <span className="text-[10px] text-[var(--color-text-muted)]">
                                                        via <strong>{item.sourceSession}</strong>
                                                    </span>
                                                )}
                                                {item.missedCount > 1 && (
                                                    <span className="badge badge-amber text-[10px]">{item.missedCount} remaining</span>
                                                )}
                                                {isOverdue(item.originalDate) && (
                                                    <span className="badge badge-red text-[10px]">Overdue</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleTick(item.id)}
                                            className="btn-outline !p-2 !rounded-lg"
                                            title="Tick once"
                                        >
                                            <HiPlus className="text-sm" />
                                        </button>
                                        <button
                                            onClick={() => handleResolve(item.id)}
                                            className="btn-primary !p-2 !rounded-lg"
                                            title="Mark resolved"
                                        >
                                            <HiCheck className="text-sm" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* History */}
            {history.length > 0 && (
                <div className="mt-6">
                    <button onClick={() => setShowHistory(!showHistory)} className="btn-outline w-full !text-xs">
                        <HiArrowPath className="text-sm" />
                        {showHistory ? 'Hide' : 'Show'} History ({resolved.length} resolved)
                    </button>
                    <AnimatePresence>
                        {showHistory && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden mt-3 space-y-2"
                            >
                                {resolved.map(item => (
                                    <div key={item.id} className="card !py-3 opacity-60">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CategoryIcon category={item.category} name={item.title} className="text-sm text-[var(--color-text-muted)]" />
                                                <div>
                                                    <p className="text-xs font-medium text-[var(--color-text-muted)] line-through">{item.title}</p>
                                                    <p className="text-[10px] text-[var(--color-text-muted)]">{item.originalDate}</p>
                                                </div>
                                            </div>
                                            <span className="badge badge-green text-[10px]">Resolved</span>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
