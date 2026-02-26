import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import {
    HiHome, HiCog6Tooth, HiFire, HiBolt,
    HiCalendarDays, HiChartBar, HiClipboardDocumentList,
    HiMagnifyingGlass, HiBell, HiEnvelope, HiPower, HiUserCircle, HiBars3
} from 'react-icons/hi2';

import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import CalendarView from './pages/CalendarView';
import Analytics from './pages/Analytics';
import ScheduleSetup from './pages/ScheduleSetup';
import DeepFocus from './pages/DeepFocus';
import PunishmentTerminal from './pages/PunishmentTerminal';
import LoginPage from './pages/LoginPage';
import Logo from './components/Logo';

import Profile from './pages/Profile';

import { processPunishment } from './api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useSessionNotifications } from './hooks/useSessionNotifications';

/* ── Protected Route ── */
function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
            <div className="w-8 h-8 border-4 border-[#16a34a]/20 border-t-[#16a34a] rounded-full animate-spin" />
        </div>
    );
    if (!user) return <Navigate to="/login" replace />;
    return children;
}

/* ── Animated routes ── */
function AnimatedRoutes() {
    const location = useLocation();
    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<ProtectedRoute><Page><Dashboard /></Page></ProtectedRoute>} />
                <Route path="/sessions" element={<ProtectedRoute><Page><Sessions /></Page></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><Page><CalendarView /></Page></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Page><Analytics /></Page></ProtectedRoute>} />
                <Route path="/schedule" element={<ProtectedRoute><Page><ScheduleSetup /></Page></ProtectedRoute>} />
                <Route path="/focus" element={<ProtectedRoute><Page><DeepFocus /></Page></ProtectedRoute>} />
                <Route path="/backlog" element={<ProtectedRoute><Page><PunishmentTerminal /></Page></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Page><Profile /></Page></ProtectedRoute>} />
            </Routes>
        </AnimatePresence>
    );
}

function Page({ children }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
        >
            {children}
        </motion.div>
    );
}

/* ── Global search bar ── */
function GlobalSearch() {
    const [query, setQuery] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            navigate(`/sessions?q=${encodeURIComponent(query.trim())}`);
            setQuery('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="search-bar">
            <HiMagnifyingGlass className="text-[var(--color-text-muted)]" />
            <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search sessions..."
            />
        </form>
    );
}

const MENU = [
    { to: '/', icon: HiHome, label: 'Dashboard', end: true },
    { to: '/sessions', icon: HiClipboardDocumentList, label: 'Sessions' },
    { to: '/calendar', icon: HiCalendarDays, label: 'Calendar' },
    { to: '/analytics', icon: HiChartBar, label: 'Analytics' },
];

const GENERAL = [
    { to: '/schedule', icon: HiCog6Tooth, label: 'Schedule Setup' },
    { to: '/focus', icon: HiBolt, label: 'Deep Focus' },
    { to: '/backlog', icon: HiFire, label: 'Backlog' },
];

function AppLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Initialize global session notifications
    useSessionNotifications(user);

    useEffect(() => {
        if (user) {
            processPunishment().catch(() => { });
        }
    }, [user]);

    // Close sidebar on route change (mobile)
    useEffect(() => { setIsSidebarOpen(false); }, [location.pathname]);

    if (!user && location.pathname === '/login') {
        return <AnimatedRoutes />;
    }

    return (
        <div className="app-layout">
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* ── Sidebar ── */}
            <aside className={`sidebar ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 z-50 shadow-2xl md:shadow-none`}>
                <div className="px-6 mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Logo size={32} />
                        <span className="text-xl font-black tracking-tight text-[var(--color-text)]">Productify</span>
                    </div>
                </div>

                <div className="nav-section-label">General</div>
                {MENU.map(({ to, icon: Icon, label, end }) => (
                    <NavLink
                        key={to} to={to} end={end}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <Icon className="text-xl" />
                        <span>{label}</span>
                    </NavLink>
                ))}

                <div className="nav-section-label">Growth</div>
                {GENERAL.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to} to={to}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <Icon className="text-xl" />
                        <span>{label}</span>
                    </NavLink>
                ))}

                {/* Sidebar Bottom: User Info (Mobile) */}
                <div className="mt-auto px-4 py-6 border-t border-[var(--color-border)] md:hidden">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
                        <NavLink to="/profile" className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#16a34a] to-[#22c55e] flex items-center justify-center text-white font-bold border-2 border-white shadow-sm">
                                {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        </NavLink>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{user?.displayName}</p>
                            <p className="text-xs text-slate-500 font-medium truncate">{user?.email}</p>
                        </div>
                        <button onClick={logout} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                            <HiPower className="text-xl" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main content area ── */}
            <div className="main-area">
                <div className="top-bar">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 text-slate-400 md:hidden hover:text-[var(--color-primary)] transition-colors"
                        >
                            <HiBars3 className="text-3xl" />
                        </button>
                        <GlobalSearch />
                    </div>

                    <div className="flex items-center gap-1 md:gap-4">
                        <button onClick={() => toast('Messaging coming soon!', { icon: '✉️' })} className="hidden sm:block text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition p-2">
                            <HiEnvelope className="text-2xl" />
                        </button>
                        <button onClick={() => toast('Notification center coming soon!', { icon: '🔔' })} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition p-2 relative">
                            <HiBell className="text-2xl" />
                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></span>
                        </button>

                        <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden sm:block"></div>

                        <div className="flex items-center gap-3 pl-1">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-slate-900 leading-tight">{user?.displayName}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Premium User</p>
                            </div>
                            <NavLink to="/profile" className="flex items-center gap-2 group p-1">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#16a34a] to-[#22c55e] shadow-[0_4px_12px_rgba(22,163,74,0.25)] flex items-center justify-center text-white text-sm font-bold group-hover:scale-105 transition-all border-2 border-white">
                                    {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                                </div>
                            </NavLink>
                        </div>
                    </div>
                </div>

                <div className="page-content">
                    <AnimatedRoutes />
                </div>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Toaster
                    position="top-center"
                    toastOptions={{
                        style: {
                            background: '#fff',
                            color: '#0f172a',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            padding: '12px 20px',
                            fontSize: '14px',
                            fontWeight: '500',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.06)',
                        },
                    }}
                />
                <AppLayout />
            </BrowserRouter>
        </AuthProvider>
    );
}

