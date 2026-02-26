import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiSparkles, HiArrowPath } from 'react-icons/hi2';
import { generateAIPlan, createTasksBulk } from '../api';
import { getWeekDates, getDateKey, getDayName } from '../utils/dateHelpers';
import toast from 'react-hot-toast';

const DAY_MAP = {
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
    Friday: 4, Saturday: 5, Sunday: 6,
};

export default function AiPlanner({ onPlanGenerated }) {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [plan, setPlan] = useState(null);
    const [expanded, setExpanded] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        try {
            const result = await generateAIPlan(prompt);
            setPlan(result);
            setExpanded(true);
        } catch (err) {
            toast.error('Failed to generate plan. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!plan?.plan) return;
        setLoading(true);
        try {
            const weekDates = getWeekDates();
            const allTasks = [];

            Object.entries(plan.plan).forEach(([dayName, tasks]) => {
                const dayIndex = DAY_MAP[dayName];
                if (dayIndex === undefined || !weekDates[dayIndex]) return;
                const dateKey = getDateKey(weekDates[dayIndex]);

                tasks.forEach(task => {
                    allTasks.push({
                        title: task.title,
                        category: task.category || 'other',
                        timeSlot: task.timeSlot || '',
                        date: dateKey,
                    });
                });
            });

            if (allTasks.length > 0) {
                await createTasksBulk(allTasks);
                toast.success(`✅ ${allTasks.length} tasks scheduled for this week!`);
                setPlan(null);
                setPrompt('');
                setExpanded(false);
                onPlanGenerated?.();
            }
        } catch (err) {
            toast.error('Failed to save plan. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            layout
            className="mx-auto max-w-3xl mb-6"
        >
            {/* Input Bar */}
            <motion.div
                layout
                className="rounded-xl border border-white/6 bg-[#1a1d27] p-4 backdrop-blur-xl"
            >
                <div className="flex items-center gap-3 mb-3">
                    <HiSparkles className="text-emerald-400 text-xl flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-emerald-400 tracking-wide uppercase">
                        AI Schedule Planner
                    </h3>
                </div>

                <div className="flex gap-2">
                    <textarea
                        className="flex-1 bg-white/3 border border-white/6 rounded-lg px-3 py-2.5
                       text-sm text-slate-200 placeholder-slate-500 resize-none
                       focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20
                       transition-all min-h-[44px]"
                        rows={2}
                        placeholder="Describe your weekly goals... e.g. 'I'm a CSE student, I need 5 LeetCode questions daily and project work on weekends'"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={loading || !prompt.trim()}
                        className="px-5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold
                       rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed
                       hover:from-emerald-500 hover:to-emerald-400 transition-all
                       flex items-center gap-2 self-end h-[44px]"
                    >
                        {loading ? (
                            <HiArrowPath className="animate-spin text-lg" />
                        ) : (
                            <>
                                <HiSparkles /> Generate
                            </>
                        )}
                    </button>
                </div>
            </motion.div>

            {/* Plan Preview */}
            <AnimatePresence>
                {plan && expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                            {plan.summary && (
                                <p className="text-sm text-emerald-300 mb-4 font-medium">
                                    ✨ {plan.summary}
                                </p>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                                {Object.entries(plan.plan).map(([day, tasks]) => (
                                    <div key={day} className="rounded-lg bg-white/3 border border-white/6 p-3">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">{day}</h4>
                                        {tasks.map((t, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs text-slate-300 py-1">
                                                <span className="text-slate-500 font-mono w-10">{t.timeSlot}</span>
                                                <span className="truncate">{t.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => { setPlan(null); setExpanded(false); }}
                                    className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-white/5 border border-white/6 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={loading}
                                    className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-emerald-500
                             text-white rounded-lg hover:from-emerald-500 hover:to-emerald-400 transition-all
                             disabled:opacity-40"
                                >
                                    {loading ? 'Saving...' : '✓ Confirm & Schedule'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
