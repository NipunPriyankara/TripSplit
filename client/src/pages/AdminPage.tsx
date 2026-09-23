import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  Compass, 
  Receipt, 
  ArrowLeft, 
  Search, 
  Key, 
  Trash2, 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  UserCheck,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../api/client.js';
import { AdminStats, AdminUser, AdminTrip } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

interface AdminPageProps {
  onBack: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onBack }) => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'trips'>('users');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search filters
  const [userSearch, setUserSearch] = useState('');
  const [tripSearch, setTripSearch] = useState('');

  // Expandable trip members state
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);

  // Modal states
  const [resetModalUser, setResetModalUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const [deleteModalUser, setDeleteModalUser] = useState<AdminUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [deleteModalTrip, setDeleteModalTrip] = useState<AdminTrip | null>(null);
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes, tripsRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAdminTrips(),
      ]);
      setStats(statsRes.stats);
      setUsers(usersRes.users);
      setTrips(tripsRes.trips);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch admin data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Password reset handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }

    setIsSubmittingPassword(true);
    try {
      await api.adminResetPassword(resetModalUser.id, newPassword);
      triggerSuccess(`Password for ${resetModalUser.name} reset successfully!`);
      setResetModalUser(null);
      setNewPassword('');
    } catch (err: any) {
      alert(err.message || 'Failed to reset password.');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  // Toggle admin role
  const handleToggleAdmin = async (targetUser: AdminUser) => {
    if (targetUser.id === currentUser?.id) {
      alert('You cannot change your own admin privileges.');
      return;
    }

    const action = targetUser.is_admin ? 'revoke' : 'grant';
    if (!confirm(`Are you sure you want to ${action} Admin privileges for ${targetUser.name}?`)) {
      return;
    }

    try {
      const res = await api.adminToggleUser(targetUser.id);
      triggerSuccess(res.message);
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_admin: res.is_admin } : u));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle admin role.');
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!deleteModalUser) return;
    setIsDeletingUser(true);
    try {
      await api.adminDeleteUser(deleteModalUser.id);
      triggerSuccess(`User ${deleteModalUser.name} deleted.`);
      setDeleteModalUser(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Delete trip
  const handleDeleteTrip = async () => {
    if (!deleteModalTrip) return;
    setIsDeletingTrip(true);
    try {
      await api.adminDeleteTrip(deleteModalTrip.id);
      triggerSuccess(`Trip room "${deleteModalTrip.name}" deleted.`);
      setDeleteModalTrip(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete trip.');
    } finally {
      setIsDeletingTrip(false);
    }
  };

  // Filtered lists
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredTrips = trips.filter(t => 
    t.name.toLowerCase().includes(tripSearch.toLowerCase()) ||
    t.owner_name.toLowerCase().includes(tripSearch.toLowerCase()) ||
    t.owner_email.toLowerCase().includes(tripSearch.toLowerCase())
  );

  const formatMoney = (cents: number, currency: string = 'LKR') => {
    return `${currency} ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 safe-top">
      {/* Top Admin Navbar */}
      <div className="bg-slate-900 text-white shadow-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Return to App"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight flex items-center space-x-2">
                  <span>TripSplit Administration</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                    Admin
                  </span>
                </h1>
                <p className="text-xs text-slate-400">System Overview & Management</p>
              </div>
            </div>
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Success Alert */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Metric Overview Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80 flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Users</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.total_users}</h3>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80 flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trip Rooms</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.total_trips}</h3>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80 flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expenses</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.total_expenses}</h3>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80 flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Settlements</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.total_settlements}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Tab Controls */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex space-x-1.5">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'users'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users Directory ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('trips')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'trips'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Trip Rooms & Members ({trips.length})</span>
          </button>
        </div>

        {/* TAB 1: USERS DIRECTORY */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user by name or email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder-slate-400 shadow-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            {/* Users List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No users matching "{userSearch}"
                  </div>
                ) : (
                  filteredUsers.map(u => {
                    const isSelf = u.id === currentUser?.id;
                    const initials = u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                    return (
                      <div key={u.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center space-x-3.5 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-600 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-bold text-slate-900 truncate">{u.name}</h4>
                              {u.is_admin ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Shield className="w-2.5 h-2.5" />
                                  <span>ADMIN</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                  MEMBER
                                </span>
                              )}
                              {isSelf && (
                                <span className="text-[10px] font-bold text-slate-400">(You)</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-medium truncate">{u.email}</p>
                            <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1">
                              <span>Rooms Owned: <strong className="text-slate-700 font-semibold">{u.owned_trips_count}</strong></span>
                              <span>•</span>
                              <span>Rooms Joined: <strong className="text-slate-700 font-semibold">{u.member_trips_count}</strong></span>
                              <span>•</span>
                              <span>Joined: {new Date(u.created_at || '').toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-2 self-end sm:self-center flex-shrink-0">
                          {/* Reset Password */}
                          <button
                            onClick={() => { setResetModalUser(u); setNewPassword(''); }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs"
                            title="Reset User Password"
                          >
                            <Key className="w-3.5 h-3.5 text-amber-500" />
                            <span>Reset Password</span>
                          </button>

                          {/* Toggle Admin */}
                          {!isSelf && (
                            <button
                              onClick={() => handleToggleAdmin(u)}
                              className={`p-2 rounded-xl border transition-colors shadow-2xs ${
                                u.is_admin 
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                                  : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                              }`}
                              title={u.is_admin ? 'Revoke Admin Privileges' : 'Make Admin'}
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete User */}
                          {!isSelf && (
                            <button
                              onClick={() => setDeleteModalUser(u)}
                              className="p-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition-colors shadow-2xs"
                              title="Delete User from System"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TRIP ROOMS & MEMBERS */}
        {activeTab === 'trips' && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search trip by room name or owner..."
                value={tripSearch}
                onChange={e => setTripSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder-slate-400 shadow-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            {/* Trip Cards */}
            {filteredTrips.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400 text-sm shadow-xs">
                No trips matching "{tripSearch}"
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTrips.map(trip => {
                  const isExpanded = expandedTripId === trip.id;

                  return (
                    <div key={trip.id} className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between">
                      <div>
                        {/* Title and Currency */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                              {trip.currency} Room
                            </span>
                            <h3 className="text-base font-extrabold text-slate-900 mt-1">{trip.name}</h3>
                            {trip.description && (
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{trip.description}</p>
                            )}
                          </div>

                          <button
                            onClick={() => setDeleteModalTrip(trip)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Trip Room"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Owner & Created date */}
                        <div className="mt-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Created By (Owner)</span>
                            <span className="font-bold text-slate-800 truncate block">{trip.owner_name}</span>
                            <span className="text-[11px] text-slate-500 truncate block">{trip.owner_email}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Created</span>
                            <span className="font-semibold text-slate-700">{new Date(trip.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Members</span>
                            <span className="text-base font-black text-slate-900">{trip.member_count}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Expenses</span>
                            <span className="text-base font-black text-emerald-600">{formatMoney(trip.total_expense_cents, trip.currency)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Member List */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                          className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between transition-colors"
                        >
                          <span className="flex items-center space-x-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            <span>View All Members ({trip.members.length})</span>
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 max-h-48 overflow-y-auto">
                            {trip.members.map(m => (
                              <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 last:border-0">
                                <div className="min-w-0 pr-2">
                                  <p className="font-bold text-slate-800 truncate">{m.name}</p>
                                  <p className="text-[10px] text-slate-500 truncate">{m.email}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold flex-shrink-0 ${
                                  m.role === 'OWNER' 
                                    ? 'bg-amber-100 text-amber-800' 
                                    : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {m.role}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: RESET PASSWORD */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Reset User Password</h3>
                  <p className="text-xs text-slate-500 font-medium">For {resetModalUser.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setResetModalUser(null)} 
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  New Password (min 6 characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter new strong password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md shadow-slate-900/20"
                >
                  {isSubmittingPassword ? 'Updating...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DELETE USER CONFIRMATION */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-extrabold text-slate-900">Delete User Account?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete <strong className="text-slate-800">{deleteModalUser.name}</strong> ({deleteModalUser.email})? All owned trips and memberships will be removed.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20"
              >
                {isDeletingUser ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE TRIP CONFIRMATION */}
      {deleteModalTrip && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-extrabold text-slate-900">Delete Trip Room?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete the room <strong className="text-slate-800">"{deleteModalTrip.name}"</strong>? All expenses, splits, and calculations in this room will be deleted.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalTrip(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTrip}
                disabled={isDeletingTrip}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20"
              >
                {isDeletingTrip ? 'Deleting...' : 'Delete Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
