import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { HiEnvelope, HiLockClosed, HiUser, HiArrowRight } from 'react-icons/hi2';
import { login, register, setAuthToken } from '../api';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function LoginPage() {
    const [isRegister, setIsRegister] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        displayName: ''
    });

    const { user, setUser } = useAuth();
    const navigate = useNavigate();

    if (user) return <Navigate to="/" replace />;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            let data;
            if (isRegister) {
                data = await register(formData.email, formData.password, formData.displayName);
                toast.success('Account created successfully!');
            } else {
                data = await login(formData.email, formData.password);
                toast.success('Welcome back!');
            }

            setAuthToken(data.token);
            setUser(data.user);
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[400px]"
            >
                <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#e2e8f0]">
                    {/* Header */}
                    <div className="flex flex-col items-center mb-8">
                        <Logo size={48} />
                        <h1 className="text-2xl font-extrabold text-[#0f172a] mt-4 tracking-tight">
                            {isRegister ? 'Create Account' : 'Welcome to Productify'}
                        </h1>
                        <p className="text-[#64748b] text-sm mt-1 text-center font-medium">
                            {isRegister
                                ? 'Join us to start your AI-powered productivity journey'
                                : 'Master your day with AI-generated schedules'
                            }
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <AnimatePresence mode="wait">
                            {isRegister && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5 ml-1">
                                        Display Name
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <HiUser className="text-[#94a3b8] group-focus-within:text-[#16a34a] transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            required={isRegister}
                                            className="w-full pl-10 pr-4 py-2.5 bg-[#f1f5f9] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#16a34a] focus:ring-4 focus:ring-[#16a34a]/10 transition-all outline-none"
                                            placeholder="John Doe"
                                            value={formData.displayName}
                                            onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div>
                            <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5 ml-1">
                                Email Address
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <HiEnvelope className="text-[#94a3b8] group-focus-within:text-[#16a34a] transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 bg-[#f1f5f9] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#16a34a] focus:ring-4 focus:ring-[#16a34a]/10 transition-all outline-none"
                                    placeholder="name@company.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5 ml-1">
                                Password
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <HiLockClosed className="text-[#94a3b8] group-focus-within:text-[#16a34a] transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 bg-[#f1f5f9] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#16a34a] focus:ring-4 focus:ring-[#16a34a]/10 transition-all outline-none"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg shadow-[#16a34a]/20 flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all mt-4"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                                    <HiArrowRight className="text-lg" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-[#f1f5f9] text-center">
                        <button
                            onClick={() => setIsRegister(!isRegister)}
                            className="text-sm font-semibold text-[#16a34a] hover:text-[#15803d] transition-colors"
                        >
                            {isRegister
                                ? 'Already have an account? Sign In'
                                : "Don't have an account? Create one"
                            }
                        </button>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-xs text-[#94a3b8] font-medium tracking-wide">
                        &copy; 2026 PRODUCTIFY. ALL RIGHTS RESERVED.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
