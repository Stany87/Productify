import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiXMark, HiClock, HiArrowPath, HiTrash } from 'react-icons/hi2';
import { getBacklog, rescheduleBacklog, dismissBacklog } from '../api';
import { getTodayKey, formatDateShort } from '../utils/dateHelpers';
import toast from 'react-hot-toast';

const CATEGORY_ICONS = {
    leetcode: '🧩', project: '🚀', dsa: '📊', study: '📚', other: '📝',
};

export default function BacklogPanel({ isOpen, onClose, onUpdated }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) loadBacklog();
    }, [isOpen]);

    const loadBacklog = async () => {
        setLoading(true);
        try {
            const data = await getBacklog();
            setItems(data);
        } catch {
            toast.error('Failed to load backlog');
        } finally {
            setLoading(false);
        }
    };

    const handleReschedule = async (id) => {
        try {
            await rescheduleBacklog(id, getTodayKey());
            toast.success('Rescheduled to today');
            setItems(prev => prev.filter(i => i.id !== id));
            onUpdated?.();
        } catch {
            toast.error('Failed to reschedule');
        }
    };

    const handleDismiss = async (id) => {
        try {
            await dismissBacklog(id);
            setItems(prev => prev.filter(i => i.id !== id));
        } catch {
            toast.error('Failed to dismiss');
        }
    };

    // Group by failed date
    const grouped = items.reduce((acc, item) => {
        if (!acc[item.failedDate]) acc[item.failedDate] = [];
        acc[item.failedDate].push(item);
        return acc;
    }, {});

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50
                       bg-[#13151c] border-l border-white/6 shadow-2xl
                       flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/6">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <HiClock className="text-amber-400" /> Backlog
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">{items.length} missed tasks</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <HiXMark className="text-xl text-slate-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <HiArrowPath className="animate-spin text-2xl text-slate-600" />
                                </div>
                            ) : items.length === 0 ? (
                                <div className="text-center py-20">
                                    <span className="text-4xl mb-3 block">🎉</span>
                                    <p className="text-slate-400 font-medium">No backlog! All caught up.</p>
                                </div>
                            ) : (
                                Object.entries(grouped).map(([date, dateItems]) => (
                                    <div key={date}>
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            📅 {formatDateShort(new Date(date + 'T00:00:00'))}
                                            <span className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">{dateItems.length}</span>
                                        </h3>
                                        <div className="space-y-2">
                                            {dateItems.map(item => (
                                                <motion.div
                                                    key={item.id}
                                                    layout
                                                    exit={{ opacity: 0, x: 40 }}
                                                    className="flex items-center gap-3 bg-white/3 border border-white/6
                                     rounded-xl p-3 group"
                                                >
                                                    <span className="text-sm">{CATEGORY_ICONS[item.category] || '📝'}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-semibold text-slate-200 truncate">{item.title}</h4>
                                                        <span className={`badge-${item.category} text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase`}>
                                                            {item.category}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleReschedule(item.id)}
                                                            className="px-2.5 py-1.5 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20
                                         text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors uppercase"
                                                        >
                                                            Today
                                                        </button>
                                                        <button
                                                            onClick={() => handleDismiss(item.id)}
                                                            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10
                                         rounded-lg transition-colors"
                                                        >
                                                            <HiTrash className="text-xs" />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
