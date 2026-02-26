import {
    HiAcademicCap, HiCodeBracket, HiHeart, HiBriefcase,
    HiBookOpen, HiBeaker, HiMusicalNote, HiChatBubbleLeftRight,
    HiCpuChip, HiPaintBrush, HiGlobeAlt, HiCalculator,
    HiCommandLine, HiDocumentText, HiPuzzlePiece, HiRocketLaunch,
    HiClock, HiExclamationTriangle, HiSquares2X2,
} from 'react-icons/hi2';

const ICON_MAP = {
    study: HiAcademicCap,
    academics: HiAcademicCap,
    college: HiAcademicCap,
    leetcode: HiCodeBracket,
    coding: HiCodeBracket,
    code: HiCodeBracket,
    programming: HiCodeBracket,
    dsa: HiCodeBracket,
    workout: HiHeart,
    gym: HiHeart,
    exercise: HiHeart,
    health: HiHeart,
    work: HiBriefcase,
    job: HiBriefcase,
    reading: HiBookOpen,
    book: HiBookOpen,
    science: HiBeaker,
    research: HiBeaker,
    music: HiMusicalNote,
    social: HiChatBubbleLeftRight,
    ml: HiCpuChip,
    ai: HiCpuChip,
    'machine learning': HiCpuChip,
    design: HiPaintBrush,
    creative: HiPaintBrush,
    language: HiGlobeAlt,
    math: HiCalculator,
    terminal: HiCommandLine,
    devops: HiCommandLine,
    writing: HiDocumentText,
    notes: HiDocumentText,
    project: HiPuzzlePiece,
    launch: HiRocketLaunch,
    routine: HiClock,
    punishment: HiExclamationTriangle,
    backlog: HiExclamationTriangle,
    other: HiSquares2X2,
};

/**
 * Resolves the best HeroIcon for a session's category/name.
 * @param {string} category - Session category
 * @param {string} [name] - Session name (fallback keyword match)
 * @returns {React.ComponentType} HeroIcon component
 */
export function getCategoryIcon(category, name) {
    const cat = (category || '').toLowerCase();
    if (ICON_MAP[cat]) return ICON_MAP[cat];

    // Fallback: keyword match on session name
    const n = (name || '').toLowerCase();
    for (const [key, Icon] of Object.entries(ICON_MAP)) {
        if (n.includes(key)) return Icon;
    }

    return HiSquares2X2; // default corporate icon
}

/**
 * Component that renders the resolved category icon.
 */
export default function CategoryIcon({ category, name, className = '' }) {
    const Icon = getCategoryIcon(category, name);
    return <Icon className={className} />;
}
