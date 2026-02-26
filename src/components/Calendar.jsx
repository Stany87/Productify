import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { getMonthDays, getMonthName, getDateKey, isToday, getTodayKey } from '../utils/dateHelpers';
import { getTasksForMonth } from '../api';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Calendar({ selectedDate, onSelectDate }) {
    const initial = selectedDate
        ? { year: parseInt(selectedDate.split('-')[0]), month: parseInt(selectedDate.split('-')[1]) - 1 }
        : { year: new Date().getFullYear(), month: new Date().getMonth() };

    const [viewYear, setViewYear] = useState(initial.year);
    const [viewMonth, setViewMonth] = useState(initial.month);
    const [monthCounts, setMonthCounts] = useState({});
    const [direction, setDirection] = useState(0);

    const days = getMonthDays(viewYear, viewMonth);

    const loadMonthData = useCallback(async () => {
        try {
            const data = await getTasksForMonth(viewYear, viewMonth + 1);
            setMonthCounts(data);
        } catch { /* silent */ }
    }, [viewYear, viewMonth]);

    useEffect(() => {
        loadMonthData();
    }, [loadMonthData]);

    const goMonth = (delta) => {
        setDirection(delta);
        let m = viewMonth + delta;
        let y = viewYear;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0; y++; }
        setViewMonth(m);
        setViewYear(y);
    };

    const goToday = () => {
        const now = new Date();
        setDirection(0);
        setViewYear(now.getFullYear());
        setViewMonth(now.getMonth());
        onSelectDate(getTodayKey());
    };

    const monthKey = `${viewYear}-${viewMonth}`;

    return (
        <div className="mb-6">
            {/* Month Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">
                        {getMonthName(viewMonth)} <span className="text-slate-500">{viewYear}</span>
                    </h2>
                    <button
                        onClick={goToday}
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1
                       bg-emerald-500/10 border border-emerald-500/20 text-emerald-400
                       rounded-lg hover:bg-emerald-500/20 transition-colors"
                    >
                        Today
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => goMonth(-1)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400
                       hover:text-white transition-colors"
                    >
                        <HiChevronLeft className="text-lg" />
                    </button>
                    <button
                        onClick={() => goMonth(1)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400
                       hover:text-white transition-colors"
                    >
                        <HiChevronRight className="text-lg" />
                    </button>
                </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAY_HEADERS.map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={monthKey}
                    initial={{ opacity: 0, x: direction * 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -30 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-7 gap-1"
                >
                    {days.map(({ date, isCurrentMonth }, i) => {
                        const dateKey = getDateKey(date);
                        const isSelected = dateKey === selectedDate;
                        const isTodayDate = isToday(dateKey);
                        const count = monthCounts[dateKey];
                        const hasTaskd = count && count.total > 0;
                        const allDone = hasTaskd && count.completed === count.total;
                        const someStarted = hasTaskd && count.completed > 0 && !allDone;
                        const isPast = dateKey < getTodayKey();

                        return (
                            <motion.button
                                key={i}
                                onClick={() => onSelectDate(dateKey)}
                                whileTap={{ scale: 0.92 }}
                                className={`
                  relative flex flex-col items-center justify-center
                  py-2 rounded-lg transition-all duration-150 min-h-[40px]
                  ${!isCurrentMonth ? 'opacity-25' : ''}
                  ${isSelected
                                        ? 'bg-emerald-500/20 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.12)]'
                                        : 'hover:bg-white/5 border border-transparent'
                                    }
                  ${isTodayDate && !isSelected ? 'border border-emerald-500/20' : ''}
                `}
                            >
                                {/* Date number */}
                                <span className={`text-sm font-semibold leading-none
                  ${isSelected ? 'text-emerald-300' :
                                        isTodayDate ? 'text-emerald-400' :
                                            isCurrentMonth ? 'text-slate-300' : 'text-slate-600'}
                `}>
                                    {date.getDate()}
                                </span>

                                {/* Task indicator dots */}
                                {hasTaskd && isCurrentMonth && (
                                    <div className="flex items-center gap-0.5 mt-1">
                                        <span className={`w-1 h-1 rounded-full ${allDone ? 'bg-emerald-400' :
                                            someStarted ? 'bg-amber-400' :
                                                isPast ? 'bg-red-400' : 'bg-slate-500'
                                            }`}
                                        />
                                        {count.total > 3 && (
                                            <span className="text-[7px] text-slate-600 font-bold">{count.total}</span>
                                        )}
                                    </div>
                                )}

                                {/* Today ring */}
                                {isTodayDate && (
                                    <motion.span
                                        layoutId="today-ring"
                                        className="absolute inset-0 rounded-lg border-2 border-emerald-400/30"
                                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                    />
                                )}
                            </motion.button>
                        );
                    })}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
