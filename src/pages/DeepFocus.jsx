import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { HiPlay, HiPause, HiStop, HiCheck } from 'react-icons/hi2';
import toast from 'react-hot-toast';

import { getTodaySessions, updateSessionStatus, tickSessionItem } from '../api';
import CategoryIcon from '../components/CategoryIcon';

const MODES = [
    { label: '25 min', seconds: 25 * 60, color: '#16a34a' },
    { label: '45 min', seconds: 45 * 60, color: '#f59e0b' },
    { label: '60 min', seconds: 60 * 60, color: '#ef4444' },
    { label: 'Custom', seconds: 0, color: '#8b5cf6' },
];

export default function DeepFocus() {
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [modeIdx, setModeIdx] = useState(0);
    const [customMins, setCustomMins] = useState(30);
    const [timeLeft, setTimeLeft] = useState(0);
    const [totalTime, setTotalTime] = useState(0);
    const [running, setRunning] = useState(false);
    const [paused, setPaused] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        getTodaySessions().then(s => setSessions(s.filter(x => x.status !== 'completed'))).catch(() => { });
    }, []);

    const clearTimer = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
    }, []);

    const startFocus = (idx) => {
        clearTimer();
        setModeIdx(idx);
        const m = MODES[idx];
        const secs = m.seconds === 0 ? customMins * 60 : m.seconds;
        setTimeLeft(secs);
        setTotalTime(secs);
        setRunning(true);
        setPaused(false);
        intervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearTimer();
                    setRunning(false);
                    setPaused(false);
                    toast.success('Focus session complete! 🎉', { duration: 4000 });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const pauseResume = () => {
        if (paused) {
            intervalRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) { clearTimer(); setRunning(false); setPaused(false); toast.success('Done! 🎉'); return 0; }
                    return prev - 1;
                });
            }, 1000);
            setPaused(false);
        } else { clearTimer(); setPaused(true); }
    };

    const stopFocus = () => { clearTimer(); setRunning(false); setPaused(false); setTimeLeft(0); setTotalTime(0); };

    const handleTick = async (itemId, current, target) => {
        try {
            await tickSessionItem(itemId, current >= target ? 0 : target);
            const sess = await getTodaySessions();
            setSessions(sess.filter(x => x.status !== 'completed'));
            const linked = sess.find(s => s.id === selectedSession?.id);
            if (linked) setSelectedSession(linked);
        } catch { toast.error('Failed'); }
    };

    const markSessionDone = async () => {
        if (!selectedSession) return;
        try {
            await updateSessionStatus(selectedSession.id, 'completed');
            toast.success('Session complete! ✅');
            const sess = await getTodaySessions();
            setSessions(sess.filter(x => x.status !== 'completed'));
            setSelectedSession(null);
        } catch { toast.error('Failed'); }
    };

    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;
    const activeColor = MODES[modeIdx].color;

    const SIZE = 240, STROKE = 10;
    const R = (SIZE - STROKE) / 2;
    const C = 2 * Math.PI * R;
    const offset = C - (progress / 100) * C;

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--color-text)]">Deep Focus</h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    Lock in and eliminate distractions.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Timer area */}
                <div className="lg:col-span-2 card flex flex-col items-center py-10">
                    {/* Mode selector */}
                    {!running && (
                        <div className="flex gap-3 mb-8">
                            {MODES.map((m, i) => (
                                <button
                                    key={i}
                                    onClick={() => { setModeIdx(i); if (m.seconds > 0) startFocus(i); }}
                                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all border
                                        ${modeIdx === i ? 'text-white border-transparent' : 'bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-text-muted)]'}`}
                                    style={modeIdx === i ? { background: m.color } : {}}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {!running && MODES[modeIdx].seconds === 0 && (
                        <div className="flex gap-3 items-center mb-8">
                            <input
                                type="number"
                                value={customMins}
                                onChange={e => setCustomMins(Math.max(1, Number(e.target.value)))}
                                className="input !w-20 text-center"
                            />
                            <span className="text-sm text-[var(--color-text-muted)]">minutes</span>
                            <button onClick={() => startFocus(modeIdx)} className="btn-primary">
                                <HiPlay /> Start
                            </button>
                        </div>
                    )}

                    {/* Timer ring */}
                    <div className="relative" style={{ width: SIZE, height: SIZE }}>
                        <svg width={SIZE} height={SIZE} className="-rotate-90">
                            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#e2e8f0" strokeWidth={STROKE} />
                            <circle
                                cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
                                stroke={running || paused ? activeColor : '#e2e8f0'}
                                strokeWidth={STROKE}
                                strokeDasharray={C}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-linear"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl font-bold text-[var(--color-text)] font-mono tracking-wide">
                                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                            </span>
                            {running && (
                                <span className="text-xs uppercase tracking-widest mt-2 font-semibold" style={{ color: activeColor }}>
                                    {paused ? 'Paused' : 'Focused'}
                                </span>
                            )}
                        </div>
                    </div>

                    {running && (
                        <div className="flex gap-4 mt-6">
                            <button onClick={pauseResume}
                                className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition">
                                {paused ? <HiPlay className="text-lg" /> : <HiPause className="text-lg" />}
                            </button>
                            <button onClick={stopFocus}
                                className="w-12 h-12 rounded-full flex items-center justify-center bg-[#fef2f2] border border-[#fecaca] text-[var(--color-danger)] hover:bg-[#fee2e2] transition">
                                <HiStop className="text-lg" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Session linking sidebar */}
                <div className="card">
                    <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">Link to Session</h3>
                    <div className="space-y-2">
                        {sessions.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)}
                                className={`w-full text-left p-3 rounded-lg text-sm transition-all border
                                    ${selectedSession?.id === s.id
                                        ? 'bg-[#dcfce7] border-[var(--color-primary)] text-[var(--color-primary)] font-semibold'
                                        : 'bg-[var(--color-bg)] border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)]'
                                    }`}
                            >
                                <CategoryIcon category={s.category} name={s.name} className="text-sm inline-block mr-1" /> {s.name}
                            </button>
                        ))}
                        {sessions.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">No pending sessions</p>}
                    </div>

                    {selectedSession?.items?.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-[var(--color-border-light)] space-y-2">
                            <p className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wider">Items</p>
                            {selectedSession.items.map(item => (
                                <div key={item.id} className="flex items-center justify-between">
                                    <span className={`text-xs ${item.completed ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-secondary)]'}`}>
                                        {item.title}
                                    </span>
                                    <button
                                        onClick={() => handleTick(item.id, item.completedCount, item.targetCount)}
                                        className={`check-box !w-[18px] !h-[18px] !rounded-[3px] ${item.completed ? 'checked' : ''}`}
                                    >
                                        <HiCheck className="text-[10px]" />
                                    </button>
                                </div>
                            ))}
                            {!running && timeLeft === 0 && (
                                <button onClick={markSessionDone} className="btn-primary w-full !py-2 mt-3 !text-xs">
                                    <HiCheck /> Mark Complete
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
