import { motion } from 'framer-motion';

export default function ProgressRing({ completed, total, size = 80 }) {
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (circ * pct) / 100;

    const color = pct === 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : pct > 0 ? '#f97316' : '#334155';

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                {/* Track */}
                <circle
                    cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5"
                />
                {/* Progress */}
                <motion.circle
                    cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke={color} strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ type: 'spring', stiffness: 40, damping: 15 }}
                    style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black" style={{ color }}>{pct}</span>
                <span className="text-[9px] text-slate-500 font-semibold">%</span>
            </div>
        </div>
    );
}
