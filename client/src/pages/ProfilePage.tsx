import React, { useState, useRef } from 'react';
import {
  User as UserIcon, LogOut, Wifi, WifiOff, RefreshCw, Database,
  Smartphone, Lock, Mail, Camera, Check, AlertCircle, Sparkles, KeyRound,
  ShieldCheck, ShieldAlert, ArrowRight, Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useOfflineSync } from '../hooks/useOfflineSync.js';
import { api } from '../api/client.js';

interface ProfilePageProps {
  onLogout: () => void;
  onOpenAdmin?: () => void;
}

const PRESET_AVATARS = [
  '✈️', '🌴', '🦁', '🎒', '🏄', '🏕️', '🏎️', '🚀', '🏖️', '🧗', '📸', '🗺️'
];

export const ProfilePage: React.FC<ProfilePageProps> = ({ onLogout, onOpenAdmin }) => {
  const { user, updateProfile, changePassword, refreshMe } = useAuth();
  const { isOnline, isSyncing, pendingCount, lastSyncTime, syncNow } = useOfflineSync();

  // Admin Claim modal state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimPasskey, setClaimPasskey] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle image file upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Image size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Profile update
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccessMsg(null);

    if (!name.trim()) {
      setProfileError('Name cannot be empty');
      return;
    }
    if (!email.trim()) {
      setProfileError('Email cannot be empty');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateProfile({
        name: name.trim(),
        email: email.trim(),
        avatar,
      });
      setProfileSuccessMsg('Profile updated successfully!');
      setTimeout(() => setProfileSuccessMsg(null), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Submit Password update
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccessMsg(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccessMsg(res.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccessMsg(null), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError(null);
    setIsClaiming(true);
    try {
      await api.adminClaimRole(claimPasskey.trim());
      setShowClaimModal(false);
      await refreshMe();
      alert('Administrator privileges granted!');
      if (onOpenAdmin) onOpenAdmin();
    } catch (err: any) {
      setClaimError(err.message || 'Invalid admin passkey.');
    } finally {
      setIsClaiming(false);
    }
  };

  const isPresetEmoji = avatar && !avatar.startsWith('data:') && !avatar.startsWith('http');

  return (
    <div className="pb-28 pt-4 px-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-900">Your Account & Settings</h1>
        {user?.is_admin === 1 && (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Administrator</span>
          </span>
        )}
      </div>

      {/* Admin Portal Card */}
      {user?.is_admin === 1 && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-xl border border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3.5 min-w-0 pr-2">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black tracking-tight truncate">Admin Console</h3>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-500 text-slate-950 uppercase flex-shrink-0">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 truncate">Users list, room inspection & resets</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs font-black flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-500/20 flex-shrink-0"
          >
            <span>Launch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Profile Info & Avatar Customizer */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <UserIcon className="w-4 h-4 text-brand-600" />
          <span>Edit Profile Information</span>
        </div>

        {profileSuccessMsg && (
          <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{profileSuccessMsg}</span>
          </div>
        )}

        {profileError && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          {/* Avatar Preview & Upload */}
          <div className="flex flex-col items-center justify-center space-y-3 pb-2">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-20 h-20 rounded-full bg-brand-500 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-brand-500/25 overflow-hidden border-2 border-white ring-2 ring-brand-400">
                {avatar ? (
                  isPresetEmoji ? (
                    <span className="text-3xl">{avatar}</span>
                  ) : (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  )
                ) : (
                  <span>{name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-6 h-6" />
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center space-x-1"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Upload Custom Photo</span>
            </button>

            {/* Travel Preset Emoji Avatars */}
            <div className="w-full pt-1">
              <span className="text-[11px] font-bold text-slate-400 block text-center mb-1.5">
                or pick a travel icon avatar:
              </span>
              <div className="flex flex-wrap justify-center gap-1.5">
                {PRESET_AVATARS.map(emoji => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => setAvatar(emoji)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-base transition-transform ${
                      avatar === emoji
                        ? 'bg-brand-100 ring-2 ring-brand-500 scale-110'
                        : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full Name / Username */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Your Name (Username) *
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-brand-500/20 transition-all flex items-center justify-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <KeyRound className="w-4 h-4 text-indigo-600" />
          <span>Change Password</span>
        </div>

        {passwordSuccessMsg && (
          <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{passwordSuccessMsg}</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Current Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              New Password (min 6 chars)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-xs shadow-sm transition-all"
            >
              {isChangingPassword ? 'Updating Password...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Offline & Sync Engine Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Database className="w-4 h-4 text-brand-600" />
          <span>Offline & Sync Status</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-400 block mb-1">Network Connection</span>
            <div className="flex items-center space-x-1.5 font-bold">
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-700">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-700">Offline Mode</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-400 block mb-1">Queued Changes</span>
            <div className="flex items-center space-x-1.5 font-bold text-slate-800">
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-500' : 'text-slate-400'}`} />
              <span>{pendingCount} pending</span>
            </div>
          </div>
        </div>

        {lastSyncTime && (
          <p className="text-[11px] text-slate-400">
            Last synced: {lastSyncTime.toLocaleTimeString()}
          </p>
        )}

        <button
          onClick={syncNow}
          disabled={!isOnline || isSyncing}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-800 font-bold text-xs flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Synchronizing...' : 'Force Sync Now'}</span>
        </button>
      </div>

      {/* PWA App Info */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Smartphone className="w-4 h-4 text-indigo-600" />
          <span>Progressive Web App (PWA)</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          TripSplit is installable on Android and iOS. Tap your browser's share or menu button and select <strong>"Add to Home Screen"</strong> to use it just like a native app.
        </p>
      </div>

      {/* Logout */}
      <div className="pt-1">
        <button
          onClick={onLogout}
          className="w-full py-3.5 px-4 rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center space-x-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Claim Admin Option (if not already admin) */}
      {!user?.is_admin && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => { setShowClaimModal(true); setClaimError(null); setClaimPasskey(''); }}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center space-x-1"
          >
            <Key className="w-3 h-3" />
            <span>Administrator Access</span>
          </button>
        </div>
      )}

      {/* Claim Admin Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-scale-up">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Claim Admin Role</h3>
                <p className="text-xs text-slate-500 font-medium">Enter system passkey</p>
              </div>
            </div>

            {claimError && (
              <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                {claimError}
              </div>
            )}

            <form onSubmit={handleClaimAdmin} className="space-y-3">
              <div>
                <input
                  type="password"
                  required
                  placeholder="Master Admin Passkey"
                  value={claimPasskey}
                  onChange={e => setClaimPasskey(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClaiming}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                >
                  {isClaiming ? 'Verifying...' : 'Unlock Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
