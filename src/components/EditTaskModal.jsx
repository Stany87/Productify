import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiXMark, HiTrash, HiCalendarDays } from 'react-icons/hi2';
import { updateTask, deleteTask } from '../api';
import toast from 'react-hot-toast';

const CATEGORIES = ['leetcode', 'project', 'dsa', 'study', 'other'];

export default function EditTaskModal({ task, isOpen, onClose, onUpdated }) {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('other');
    const [timeSlot, setTimeSlot] = useState('');
    const [date, setDate] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setCategory(task.category);
            setTimeSlot(task.timeSlot);
            setDate(task.date);
        }
    }, [task]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateTask(task.id, { title, category, timeSlot, date });
            toast.success('Task updated');
            onUpdated?.();
            onClose();
        } catch {
            toast.error('Failed to update');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            await deleteTask(task.id);
            toast.success('Task deleted');
            onUpdated?.();
            onClose();
        } catch {
            toast.error('Failed to delete');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && task && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-md
                       bg-[#1a1d27] border border-white/10 rounded-2xl p-6 shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <HiCalendarDays className="text-emerald-400" /> Edit Task
                            </h2>
                            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                                <HiXMark className="text-xl text-slate-400" />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Title</label>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5
                             text-sm text-white focus:outline-none focus:border-emerald-500/50
                             focus:ring-1 focus:ring-emerald-500/20 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Category</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5
                               text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all
                               appearance-none cursor-pointer"
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c} value={c} className="bg-[#1a1d27]">
                                                {c.charAt(0).toUpperCase() + c.slice(1)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Time</label>
                                    <input
                                        type="time"
                                        value={timeSlot}
                                        onChange={(e) => setTimeSlot(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5
                               text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5
                             text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={handleDelete}
                                disabled={saving}
                                className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400
                           hover:bg-red-500/20 transition-colors disabled:opacity-40"
                            >
                                <HiTrash className="text-lg" />
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 text-sm text-slate-400 bg-white/5 border border-white/10
                           rounded-lg hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !title.trim()}
                                className="flex-1 py-2.5 text-sm font-semibold bg-gradient-to-r from-emerald-600
                           to-emerald-500 text-white rounded-lg hover:from-emerald-500 hover:to-emerald-400
                           transition-all disabled:opacity-40"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
