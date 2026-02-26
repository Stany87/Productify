import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { HiPlay, HiStop, HiPencilSquare } from 'react-icons/hi2';
import { formatDuration, formatLiveTimer } from '../utils/dateHelpers';

const CATEGORY_CONFIG = {
    leetcode: { icon: '🧩', badge: 'badge-leetcode', label: 'LeetCode' },
    project: { icon: '🚀', badge: 'badge-project', label: 'Project' },
    dsa: { icon: '📊', badge: 'badge-dsa', label: 'DSA' },
    study: { icon: '📚', badge: 'badge-study', label: 'Study' },
    other: { icon: '📝', badge: 'badge-other', label: 'Other' },
};

export default function TaskCard({ task, onToggle, onEdit, onTrackStart, onTrackStop, index = 0 }) {
    const config = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.other;
    const isComplete = !!task.completed;
    const isTracking = !!task.trackingStartedAt;

    // Live timer state
    const [liveSeconds, setLiveSeconds] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (isTracking) {
            const startTime = new Date(task.trackingStartedAt).getTime();
            const calcElapsed = () => Math.floor((Date.now() - startTime) / 1000) + (task.trackedTime || 0);

            setLiveSeconds(calcElapsed());
            intervalRef.current = setInterval(() => {
                setLiveSeconds(calcElapsed());
            }, 1000);

            return () => clearInterval(intervalRef.current);
        } else {
            clearInterval(intervalRef.current);
            setLiveSeconds(task.trackedTime || 0);
        }
    }, [isTracking, task.trackingStartedAt, task.trackedTime]);

    const handleTrackToggle = (e) => {
        e.stopPropagation();
        if (isTracking) {
            onTrackStop?.(task);
        } else {
            onTrackStart?.(task);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ delay: index * 0.04, duration: 0.3 }}
            className={`
        relative group flex items-center gap-3 px-4 py-3 rounded-xl
        border bg-[#1a1d27] hover:bg-[#22262f]
        transition-all duration-200 cursor-pointer
        ${isComplete ? 'opacity-50 border-white/6' : ''}
        ${isTracking ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.08)]' : 'border-white/6'}
      `}
            onClick={onToggle}
        >
            {/* Tracking pulse */}
            {isTracking && (
                <motion.div
                    className="absolute inset-0 rounded-xl border border-emerald-500/20"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            )}

            {/* Checkbox */}
            <motion.div
                whileTap={{ scale: 0.85 }}
                className={`
          w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center
          border-2 transition-all duration-300 z-10
          ${isComplete
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-400 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                        : 'border-slate-600 hover:border-emerald-500/50'
                    }
        `}
            >
                {isComplete && (
                    <motion.svg
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        width="10" height="10" viewBox="0 0 24 24"
                        fill="none" stroke="white" strokeWidth="3"
                        strokeLinecap="round" strokeLinejoin="round"
                    >
                        <path d="M20 6L9 17l-5-5" />
                    </motion.svg>
                )}
            </motion.div>

            {/* Content */}
            <div className="flex-1 min-w-0 z-10">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm">{config.icon}</span>
                    <h4 className={`text-sm font-semibold truncate transition-all
            ${isComplete ? 'line-through text-slate-500' : 'text-slate-200'}
          `}>
                        {task.title}
                    </h4>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`${config.badge} text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase`}>
                        {config.label}
                    </span>
                    {task.timeSlot && (
                        <span className="text-[10px] text-slate-500 font-mono">
                            🕐 {task.timeSlot}
                        </span>
                    )}
                    {/* Tracked time display */}
                    {(liveSeconds > 0 || isTracking) && (
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded
              ${isTracking ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500'}`
                        }>
                            ⏱ {isTracking ? formatLiveTimer(liveSeconds) : formatDuration(liveSeconds)}
                        </span>
                    )}
                </div>
            </div>

            {/* Track Button */}
            {!isComplete && (
                <button
                    onClick={handleTrackToggle}
                    className={`p-1.5 rounded-lg transition-all duration-200 z-10
            ${isTracking
                            ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 opacity-0 group-hover:opacity-100'
                        }
          `}
                    title={isTracking ? 'Stop tracking' : 'Start tracking'}
                >
                    {isTracking ? <HiStop className="text-sm" /> : <HiPlay className="text-sm" />}
                </button>
            )}

            {/* Edit Button */}
            <button
                onClick={(e) => { e.stopPropagation(); onEdit?.(task); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg z-10
                   bg-white/5 hover:bg-white/10 text-slate-400 hover:text-emerald-400
                   transition-all duration-200"
            >
                <HiPencilSquare className="text-sm" />
            </button>

            {/* Status */}
            <span className={`text-[10px] font-bold uppercase tracking-wider z-10
        ${isComplete ? 'text-emerald-500' : isTracking ? 'text-emerald-400' : 'text-slate-600'}
      `}>
                {isComplete ? 'Done' : isTracking ? 'Tracking' : ''}
            </span>
        </motion.div>
    );
}
