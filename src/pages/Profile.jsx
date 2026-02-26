import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
    HiUser, HiEnvelope, HiLockClosed, HiRocketLaunch,
    HiPuzzlePiece, HiBeaker, HiArrowPath
} from 'react-icons/hi2';
import { getProfile, updateProfile, changePassword } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({
        lifeDescription: '',
        leetcodeTarget: 5,
        leetcodeUsername: '',
        skillFocuses: [],
        waterTarget: 4.0
    });

    const [pwData, setPwData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        getProfile()
            .then(data => {
                setProfile({
                    ...data,
                    skillFocuses: typeof data.skillFocuses === 'string' ? JSON.parse(data.skillFocuses) : data.skillFocuses
                });
            })
            .catch(() => toast.error('Failed to load profile'))
            .finally(() => setLoading(false));
    }, []);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateProfile(profile);
            toast.success('Profile updated successfully');
        } catch (err) {
            toast.error('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (pwData.newPassword !== pwData.confirmPassword) {
            return toast.error('Passwords do not match');
        }
        setSaving(true);
        try {
            await changePassword(pwData.currentPassword, pwData.newPassword);
            toast.success('Password changed successfully');
            setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to change password');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <div className="w-8 h-8 border-4 border-[#16a34a]/20 border-t-[#16a34a] rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <header>
                <h1 className="text-3xl font-extrabold text-[#0f172a] tracking-tight">Account Settings</h1>
                <p className="text-[#64748b] font-medium">Manage your personal information and productivity targets</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* User Info & Password */}
                <div className="space-y-8">
                    <section className="bg-white p-6 rounded-3xl border border-[#e2e8f0] shadow-sm">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#16a34a] to-[#22c55e] flex items-center justify-center text-white text-2xl font-bold border-4 border-[#dcfce7]">
                                {user?.displayName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900">{user?.displayName}</h2>
                                <p className="text-sm text-slate-500">{user?.email}</p>
                            </div>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Change Password</h3>
                            <div className="space-y-3">
                                <div className="relative group">
                                    <HiLockClosed className="absolute left-3 top-3 text-slate-400" />
                                    <input
                                        type="password"
                                        placeholder="Current Password"
                                        required
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#16a34a]/20 outline-none"
                                        value={pwData.currentPassword}
                                        onChange={e => setPwData({ ...pwData, currentPassword: e.target.value })}
                                    />
                                </div>
                                <div className="relative group">
                                    <HiLockClosed className="absolute left-3 top-3 text-slate-400" />
                                    <input
                                        type="password"
                                        placeholder="New Password"
                                        required
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#16a34a]/20 outline-none"
                                        value={pwData.newPassword}
                                        onChange={e => setPwData({ ...pwData, newPassword: e.target.value })}
                                    />
                                </div>
                                <div className="relative group">
                                    <HiLockClosed className="absolute left-3 top-3 text-slate-400" />
                                    <input
                                        type="password"
                                        placeholder="Confirm New Password"
                                        required
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#16a34a]/20 outline-none"
                                        value={pwData.confirmPassword}
                                        onChange={e => setPwData({ ...pwData, confirmPassword: e.target.value })}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-200 active:scale-95 transition-all"
                            >
                                Update Password
                            </button>
                        </form>
                    </section>
                </div>

                {/* Profile Data */}
                <div className="md:col-span-2 space-y-8">
                    <section className="bg-white p-8 rounded-3xl border border-[#e2e8f0] shadow-sm">
                        <form onSubmit={handleUpdateProfile} className="space-y-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <HiRocketLaunch className="text-[#16a34a] text-xl" />
                                    <h2 className="text-xl font-extrabold text-[#0f172a]">Productivity Profile</h2>
                                </div>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-[#16a34a] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#16a34a]/20 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    {saving && <HiArrowPath className="animate-spin" />}
                                    Save Changes
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">My Daily Goal & Lifestyle</label>
                                    <textarea
                                        rows="4"
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-[#16a34a]/20 outline-none resize-none font-medium"
                                        placeholder="Explain your routine and goals for the AI planner..."
                                        value={profile.lifeDescription}
                                        onChange={e => setProfile({ ...profile, lifeDescription: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">LeetCode Daily Target</label>
                                        <div className="relative group">
                                            <HiPuzzlePiece className="absolute left-3 top-3 text-slate-400" />
                                            <input
                                                type="number"
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#16a34a]/20 outline-none font-bold"
                                                value={profile.leetcodeTarget}
                                                onChange={e => setProfile({ ...profile, leetcodeTarget: parseInt(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Water Intake Goal (L)</label>
                                        <div className="relative group">
                                            <HiBeaker className="absolute left-3 top-3 text-slate-400" />
                                            <input
                                                type="number"
                                                step="0.5"
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#16a34a]/20 outline-none font-bold"
                                                value={profile.waterTarget}
                                                onChange={e => setProfile({ ...profile, waterTarget: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">LeetCode Username</label>
                                    <div className="relative group">
                                        <HiBeaker className="absolute left-3 top-3 text-slate-400" />
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#16a34a]/20 outline-none font-bold"
                                            placeholder="leetcode_user"
                                            value={profile.leetcodeUsername}
                                            onChange={e => setProfile({ ...profile, leetcodeUsername: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Specific Skills to Focus</label>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {['React', 'Node.js', 'System Design', 'Algorithms', 'UI/UX', 'Databases'].map(skill => {
                                            const isSelected = profile.skillFocuses.includes(skill);
                                            return (
                                                <button
                                                    key={skill}
                                                    type="button"
                                                    onClick={() => {
                                                        const newSkills = isSelected
                                                            ? profile.skillFocuses.filter(s => s !== skill)
                                                            : [...profile.skillFocuses, skill];
                                                        setProfile({ ...profile, skillFocuses: newSkills });
                                                    }}
                                                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${isSelected
                                                        ? 'bg-[#16a34a] text-white border-[#16a34a] shadow-md shadow-[#16a34a]/20'
                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-[#16a34a] hover:text-[#16a34a]'
                                                        }`}
                                                >
                                                    {skill}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        </div>
    );
}
