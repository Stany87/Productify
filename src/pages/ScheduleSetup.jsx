import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiChevronDown, HiCheck, HiSparkles, HiPlus, HiXMark,
} from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { generateSchedule, generateSessions, getProfile, updateProfile } from '../api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ScheduleSetup() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0); // 0=form, 1=preview
    const [desc, setDesc] = useState('');
    const [lcTarget, setLcTarget] = useState(3);
    const [skills, setSkills] = useState([]);
    const [skillInput, setSkillInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [schedule, setSchedule] = useState(null);
    const [openDay, setOpenDay] = useState(null);

    useEffect(() => {
        getProfile().then(p => {
            if (p.lifeDescription) setDesc(p.lifeDescription);
            if (p.leetcodeDaily) setLcTarget(p.leetcodeDaily);
            if (p.skillFocuses) {
                try {
                    const parsed = JSON.parse(p.skillFocuses);
                    setSkills(Array.isArray(parsed) ? parsed : [p.skillFocuses]);
                } catch {
                    setSkills([p.skillFocuses]);
                }
            }
        }).catch(() => { });
    }, []);

    const addSkill = () => {
        const s = skillInput.trim();
        if (s && !skills.includes(s)) {
            setSkills([...skills, s]);
            setSkillInput('');
        }
    };

    const handleGenerate = async () => {
        if (!desc.trim()) return toast.error('Describe your routine first');
        setLoading(true);
        try {
            await updateProfile({ lifeDescription: desc, leetcodeDaily: lcTarget, skillFocuses: JSON.stringify(skills) });
            const res = await generateSchedule({
                lifeDescription: desc,
                leetcodeTarget: lcTarget,
                skillFocuses: skills
            });
            setSchedule(res.sessions);
            setStep(1);
            setOpenDay(DAYS[0]);
        } catch { toast.error('Generation failed'); }
        finally { setLoading(false); }
    };

    const handleConfirm = async () => {
        setLoading(true);
        try {
            for (const day of DAYS) {
                if (schedule[day]?.length) {
                    const d = new Date();
                    const todayDow = d.getDay();
                    const targetDow = DAYS.indexOf(day) + 1;
                    const diff = (targetDow - todayDow + 7) % 7;
                    const target = new Date(d);
                    target.setDate(d.getDate() + (diff === 0 && step ? 0 : diff));
                    const dateStr = target.toISOString().split('T')[0];
                    await generateSessions(dateStr, schedule[day]);
                }
            }
            toast.success('Schedule activated! 🚀');
            navigate('/');
        } catch { toast.error('Failed to save'); }
        finally { setLoading(false); }
    };

    return (
        <div className="max-w-2xl">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--color-text)]">
                    {step === 0 ? 'Schedule Setup' : 'Preview Schedule'}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {step === 0 ? 'Tell us about your routine and we\'ll build a personalized schedule.' : 'Review your AI-generated schedule before activating.'}
                </p>
            </div>

            <AnimatePresence mode="wait">
                {step === 0 ? (
                    <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                        {/* Routine */}
                        <div className="card">
                            <label className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wider block mb-2">Your Routine</label>
                            <textarea
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                                placeholder="Describe your daily life — college schedule, work hours, gym time, study habits..."
                                rows={4}
                                className="input"
                            />
                        </div>

                        {/* LC Target */}
                        <div className="card">
                            <label className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wider block mb-2">
                                LeetCode Daily Target
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min={1}
                                    max={10}
                                    value={lcTarget}
                                    onChange={e => setLcTarget(Number(e.target.value))}
                                    className="flex-1 accent-[var(--color-primary)]"
                                />
                                <span className="text-lg font-bold text-[var(--color-primary)] w-8 text-center">{lcTarget}</span>
                            </div>
                        </div>

                        {/* Skills */}
                        <div className="card">
                            <label className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wider block mb-2">Skill Focuses</label>
                            <div className="flex gap-2">
                                <input
                                    value={skillInput}
                                    onChange={e => setSkillInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                                    placeholder="Add a skill..."
                                    className="input flex-1"
                                />
                                <button onClick={addSkill} className="btn-outline !px-3">
                                    <HiPlus />
                                </button>
                            </div>
                            {skills.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {skills.map(s => (
                                        <span key={s} className="badge badge-green flex items-center gap-1">
                                            {s}
                                            <button onClick={() => setSkills(skills.filter(x => x !== s))} className="hover:text-red-500">
                                                <HiXMark className="text-xs" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button onClick={handleGenerate} disabled={loading} className="btn-primary w-full justify-center !py-3">
                            {loading ? 'Generating...' : <><HiSparkles /> Generate Schedule</>}
                        </button>
                    </motion.div>
                ) : (
                    <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        {DAYS.map(day => {
                            const daySessions = schedule?.[day] || [];
                            const isOpen = openDay === day;
                            return (
                                <div key={day} className="card !p-0 overflow-hidden">
                                    <button
                                        onClick={() => setOpenDay(isOpen ? null : day)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-surface-hover)] transition"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-semibold text-[var(--color-text)]">{day}</span>
                                            <span className="badge badge-green text-[10px]">{daySessions.length} sessions</span>
                                        </div>
                                        <HiChevronDown className={`text-[var(--color-text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    <AnimatePresence>
                                        {isOpen && daySessions.length > 0 && (
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: 'auto' }}
                                                exit={{ height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-4 pb-4 space-y-2 border-t border-[var(--color-border-light)]">
                                                    {daySessions.map((s, i) => (
                                                        <div key={i} className="flex items-center gap-3 py-2">
                                                            <span className="text-base">{s.icon || '📚'}</span>
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium text-[var(--color-text)]">{s.name}</p>
                                                                <p className="text-xs text-[var(--color-text-muted)]">{s.startTime}–{s.endTime}</p>
                                                            </div>
                                                            <span className="badge bg-[var(--color-bg)] text-[var(--color-text-muted)] text-[10px]">
                                                                {s.category}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}

                        <div className="flex gap-3 pt-3">
                            <button onClick={() => setStep(0)} className="btn-outline flex-1 justify-center">← Edit</button>
                            <button onClick={handleConfirm} disabled={loading} className="btn-primary flex-1 justify-center">
                                {loading ? 'Saving...' : <><HiCheck /> Activate Schedule</>}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
