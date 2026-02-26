import { motion } from 'framer-motion';
import { getWeekDates, getDateKey, getShortDay, isToday } from '../utils/dateHelpers';

export default function DayTabs({ selectedDate, onSelectDate, taskCounts }) {
    const weekDates = getWeekDates();

    return (
        <div className="flex justify-center gap-1.5 mb-6 px-2 overflow-x-auto scrollbar-none">
            {weekDates.map((date) => {
                const dateKey = getDateKey(date);
                const isActive = dateKey === selectedDate;
                const isTodayDate = isToday(dateKey);
                const count = taskCounts?.[dateKey] || { total: 0, completed: 0 };
                const allDone = count.total > 0 && count.completed === count.total;

                return (
                    <motion.button
                        key={dateKey}
                        onClick={() => onSelectDate(dateKey)}
                        whileTap={{ scale: 0.95 }}
                        className={`
              relative flex flex-col items-center gap-0.5 px-3.5 py-2.5 rounded-xl
              transition-all duration-200 min-w-[54px]
              ${isActive
                                ? 'bg-emerald-500/15 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                                : 'bg-white/3 border border-white/6 hover:bg-white/6'
                            }
            `}
                    >
                        <span className={`text-[10px] font-bold uppercase tracking-wider
              ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {getShortDay(date)}
                        </span>
                        <span className={`text-lg font-bold leading-none
              ${isActive ? 'text-white' : 'text-slate-300'}`}>
                            {date.getDate()}
                        </span>

                        {/* Completion dot */}
                        {count.total > 0 && (
                            <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${allDone ? 'bg-emerald-400' :
                                    count.completed > 0 ? 'bg-amber-400' :
                                        dateKey < getDateKey(new Date()) ? 'bg-red-400' : 'bg-slate-600'
                                }`} />
                        )}

                        {/* Today indicator */}
                        {isTodayDate && (
                            <motion.span
                                layoutId="today-dot"
                                className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400"
                            />
                        )}

                        {/* Active indicator */}
                        {isActive && (
                            <motion.span
                                layoutId="active-tab"
                                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-emerald-400"
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            />
                        )}
                    </motion.button>
                );
            })}
        </div>
    );
}
