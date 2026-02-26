import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiChevronLeft, HiChevronRight, HiPlus } from 'react-icons/hi2';

import { getMonthSessions, getSessionsByDate, generateSessions } from '../api';
import { getTodayKey, getDateKey, getMonthDays, getMonthName, formatDate } from '../utils/dateHelpers';
import CategoryIcon from '../components/CategoryIcon';
import toast from 'react-hot-toast';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView() {
    const today = getTodayKey();
    const now = new Date();
    const [calYear, setCalYear] = useState(now.getFullYear());
    const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
    const [monthCounts, setMonthCounts] = useState({});
    const [selectedDate, setSelectedDate] = useState(today);
    const [daySessions, setDaySessions] = useState([]);

    useEffect(() => {
        getMonthSessions(calYear, calMonth).then(setMonthCounts).catch(() => { });
    }, [calYear, calMonth]);

    useEffect(() => {
        if (selectedDate) {
            getSessionsByDate(selectedDate).then(setDaySessions).catch(() => setDaySessions([]));
        }
    }, [selectedDate]);

    const handleAddEvent = async () => {
        const name = window.prompt('Event Name (e.g., Team Meeting, Project Work):');
        if (!name) return;
        const timeInput = window.prompt('Start Time (in HH:MM format, or leave blank for flexible):');
        const startTime = timeInput?.trim() ? timeInput.trim() : 'flexible';

        const newSession = {
            name, startTime, endTime: startTime === 'flexible' ? 'flexible' : startTime,
            type: 'fixed', category: 'other', icon: '📅', color: '#64748b', items: []
        };

        try {
            await generateSessions(selectedDate, [...daySessions, newSession]);
            toast.success('Event added successfully!');
            getSessionsByDate(selectedDate).then(setDaySessions);
            getMonthSessions(calYear, calMonth).then(setMonthCounts);
        } catch {
            toast.error('Failed to add event');
        }
    };

    const prevMonth = () => { if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
    const nextMonth = () => { if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };

    const days = getMonthDays(calYear, calMonth);

    return (
        <div>
            {/* Page header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">Calendar</h1>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        Schedule and track your events and sessions.
                    </p>
                </div>
                <button onClick={handleAddEvent} className="btn-primary">
                    <HiPlus /> Add Event
                </button>
            </div>

            {/* Two column: Calendar + Today's Events */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar grid */}
                <div className="lg:col-span-2 card">
                    {/* Month nav */}
                    <div className="flex items-center gap-4 mb-6">
                        <button onClick={prevMonth} className="btn-outline !p-2"><HiChevronLeft /></button>
                        <h3 className="text-base font-semibold text-[var(--color-text)]">
                            {getMonthName(calMonth)} {calYear}
                        </h3>
                        <button onClick={nextMonth} className="btn-outline !p-2"><HiChevronRight /></button>
                    </div>

                    {/* Header row */}
                    <div className="grid grid-cols-7 gap-0 mb-1">
                        {DOW.map(d => (
                            <div key={d} className="text-center text-xs text-[var(--color-text-muted)] font-semibold py-2">{d}</div>
                        ))}
                    </div>

                    {/* Day grid */}
                    <div className="grid grid-cols-7 gap-0">
                        {days.map((cell, i) => {
                            const key = getDateKey(cell.date);
                            const data = monthCounts[key];
                            const isToday = key === today;
                            const isSelected = key === selectedDate;
                            return (
                                <button
                                    key={i}
                                    onClick={() => cell.inMonth && setSelectedDate(key)}
                                    className={`aspect-square flex flex-col items-center justify-center text-sm font-medium transition-all border border-transparent
                                        ${!cell.inMonth ? 'text-[var(--color-text-muted)] opacity-40' : 'text-[var(--color-text)]'}
                                        ${isToday && !isSelected ? 'bg-[var(--color-primary)] text-white rounded-lg font-bold' : ''}
                                        ${isSelected ? 'bg-[var(--color-primary)] text-white rounded-lg font-bold' : 'hover:bg-[var(--color-surface-hover)] rounded-lg'}
                                    `}
                                >
                                    <span>{cell.day}</span>
                                    {data && cell.inMonth && !isToday && !isSelected && (
                                        <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${data.completed === data.total ? 'bg-[var(--color-primary)]' : data.completed > 0 ? 'bg-[var(--color-warn)]' : 'bg-[#cbd5e1]'}`} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Today's Events sidebar */}
                <div className="card">
                    <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">
                        {selectedDate === today ? "Today's Events" : formatDate(selectedDate)}
                    </h3>
                    <div className="space-y-3">
                        {daySessions.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-muted)] py-4">No sessions this day</p>
                        ) : (
                            <AnimatePresence>
                                {daySessions.map(s => (
                                    <motion.div
                                        key={s.id}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-3 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border-light)]"
                                    >
                                        <div className="flex items-center gap-2">
                                            <CategoryIcon category={s.category} name={s.name} className="text-sm text-[var(--color-text-secondary)]" />
                                            <p className="text-sm font-semibold text-[var(--color-text)]">{s.name}</p>
                                        </div>
                                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                            {s.startTime === 'flexible' ? 'Flexible' : `${s.startTime}`}
                                        </p>
                                        <span className="badge badge-blue mt-2 text-[10px]">
                                            {s.endTime && s.startTime !== 'flexible'
                                                ? (() => {
                                                    const [sh, sm] = s.startTime.split(':').map(Number);
                                                    const [eh, em] = s.endTime.split(':').map(Number);
                                                    const diff = (eh * 60 + em) - (sh * 60 + sm);
                                                    return diff >= 60 ? `${Math.floor(diff / 60)} hour${diff >= 120 ? 's' : ''}` : `${diff} min`;
                                                })()
                                                : 'Flexible'
                                            }
                                        </span>

                                        {s.items?.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-[var(--color-border-light)] space-y-1">
                                                {s.items.map(item => (
                                                    <div key={item.id} className="flex items-center justify-between">
                                                        <span className={`text-[11px] ${item.completed ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-secondary)]'}`}>
                                                            {item.title}
                                                        </span>
                                                        <span className={`text-[10px] font-mono ${item.completed ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                                            {item.completedCount}/{item.targetCount}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
