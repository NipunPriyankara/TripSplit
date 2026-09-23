import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass, Plus, Share2, Users, DollarSign, ArrowRight,
  Filter, Search, Trash2, Edit3, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, Clock, Shield, UserPlus, AlertCircle, RefreshCw,
  FileText
} from 'lucide-react';
import { Trip, TripMember, Expense, MemberBalance, SettlementTransaction, Settlement, ExpenseCategory } from '../types/index.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { AddExpenseModal } from '../components/AddExpenseModal.js';
import { InviteModal } from '../components/InviteModal.js';
import { JoinRequestsModal } from '../components/JoinRequestsModal.js';
import { RecordSettlementModal } from '../components/RecordSettlementModal.js';
import { ExportSummaryModal } from '../components/ExportSummaryModal.js';
import { BatchExpenseModal } from '../components/BatchExpenseModal.js';

interface TripRoomPageProps {
  tripId: string;
  onBack: () => void;
}

type RoomTab = 'overview' | 'expenses' | 'balances' | 'members';

const CATEGORY_ICONS: Record<string, string> = {
  Food: '🍛',
  Drinks: '🍻',
  Hotel: '🏨',
  Transport: '🚕',
  Fuel: '⛽',
  Tickets: '🎟️',
  Shopping: '🛍️',
  Other: '🧾',
};

export const TripRoomPage: React.FC<TripRoomPageProps> = ({ tripId, onBack }) => {
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [recommendations, setRecommendations] = useState<SettlementTransaction[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<RoomTab>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for expense timeline
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showAddExpense, setShowAddExpense] = useState<boolean>(false);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [showRequestsModal, setShowRequestsModal] = useState<boolean>(false);
  const [showExportSummary, setShowExportSummary] = useState<boolean>(false);
  const [settlementToRecord, setSettlementToRecord] = useState<SettlementTransaction | null>(null);
  const [showRecordSettlement, setShowRecordSettlement] = useState<boolean>(false);

  const isOwner = trip?.role === 'OWNER';

  const loadTripRoomData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch trip details, members, expenses, and balances in parallel
      const [tripRes, membersRes, expensesRes, balancesRes] = await Promise.all([
        api.getTrip(tripId),
        api.getMembers(tripId),
        api.getExpenses(tripId),
        api.getBalances(tripId),
      ]);

      setTrip(tripRes.trip);
      setMembers(membersRes.members);
      setExpenses(expensesRes.expenses);
      setBalances(balancesRes.balances);
      setRecommendations(balancesRes.recommendations);
      setSettlements(balancesRes.settlements);

      // If owner, check for pending join requests
      if (tripRes.trip.role === 'OWNER' && navigator.onLine) {
        try {
          const reqRes = await api.getJoinRequests(tripId);
          setPendingRequestsCount(reqRes.requests.length);
        } catch (e) {
          // Ignore if offline
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load trip room.');
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadTripRoomData();
  }, [loadTripRoomData]);

  // Compute current user's personal financial stats in this trip
  const currentUserBalance = balances.find(b => b.user_id === user?.id);
  const userPaidCents = currentUserBalance?.total_paid_cents || 0;
  const userShareCents = currentUserBalance?.total_share_cents || 0;
  const userNetCents = currentUserBalance?.net_balance_cents || 0;

  // Filter expenses
  const filteredExpenses = expenses.filter(exp => {
    if (categoryFilter !== 'ALL' && exp.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = exp.title.toLowerCase().includes(q);
      const matchNotes = exp.notes?.toLowerCase().includes(q);
      const matchPayer = exp.payer?.name.toLowerCase().includes(q);
      if (!matchTitle && !matchNotes && !matchPayer) return false;
    }
    return true;
  });

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.deleteExpense(tripId, expenseId);
      loadTripRoomData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense');
    }
  };

  const handleRemoveMember = async (targetUserId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from this trip?`)) return;
    try {
      await api.removeMember(tripId, targetUserId);
      loadTripRoomData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  const handleLeaveTrip = async () => {
    if (!confirm('Are you sure you want to leave this trip room?')) return;
    try {
      await api.removeMember(tripId, user!.id);
      onBack();
    } catch (err: any) {
      alert(err.message || 'Failed to leave trip');
    }
  };

  if (isLoading && !trip) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Entering private trip room...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Denied or Not Found</h2>
        <p className="text-xs text-slate-600">{error || 'Unable to open trip room.'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
        >
          Back to Trips
        </button>
      </div>
    );
  }

  return (
    <div className="pb-28 pt-2 px-4 max-w-lg mx-auto space-y-5">
      {/* Trip Header Banner */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {trip.name}
              </h1>
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  isOwner ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {isOwner ? 'Owner' : 'Member'}
              </span>
            </div>
            {trip.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{trip.description}</p>
            )}
            <div className="flex items-center space-x-2 text-xs text-slate-400 mt-2 font-medium">
              <span>{members.length} Members</span>
              <span>•</span>
              <span>{trip.currency}</span>
              {trip.start_date && (
                <>
                  <span>•</span>
                  <span>{trip.start_date}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {isOwner && (
              <button
                onClick={() => setShowRequestsModal(true)}
                className="relative p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl transition-colors"
                title="View Join Requests"
              >
                <UserPlus className="w-4 h-4" />
                {pendingRequestsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setShowExportSummary(true)}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl transition-colors flex items-center space-x-1"
              title="Export Trip Summary / PDF Report"
            >
              <FileText className="w-4 h-4 text-slate-700" />
              <span className="text-xs font-bold hidden sm:inline">Report / PDF</span>
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="p-2.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-2xl transition-colors flex items-center space-x-1"
              title="Invite Members"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-xs font-bold hidden sm:inline">Invite</span>
            </button>
          </div>
        </div>

        {/* Quick Action Ribbon */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2">
          <button
            onClick={() => setShowAddExpense(true)}
            className="py-2.5 px-2 bg-brand-500 hover:bg-brand-600 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-brand-500/20 flex items-center justify-center space-x-1 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="truncate">+ Single</span>
          </button>
          <button
            onClick={() => setShowBatchModal(true)}
            className="py-2.5 px-2 bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-purple-600/20 flex items-center justify-center space-x-1 transition-all"
            title="Split multiple items/bills paid by one person"
          >
            <span className="text-xs">⚡</span>
            <span className="truncate">Multi-Items</span>
          </button>
          <button
            onClick={() => {
              setSettlementToRecord(null);
              setShowRecordSettlement(true);
            }}
            className="py-2.5 px-2 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-slate-900/10 flex items-center justify-center space-x-1 transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate">Settle Up</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-slate-200/80 p-1 rounded-2xl text-xs font-bold">
        {(['overview', 'expenses', 'balances', 'members'] as RoomTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-xl transition-all capitalize ${
              activeTab === tab
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab}
            {tab === 'expenses' && expenses.length > 0 && ` (${expenses.length})`}
          </button>
        ))}
      </div>

      {/* ================= TAB 1: OVERVIEW ================= */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Main User Balance Hero Card */}
          <div
            className={`rounded-3xl p-5 shadow-lg border transition-all ${
              userNetCents > 0
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-emerald-400/30'
                : userNetCents < 0
                ? 'bg-gradient-to-br from-rose-500 to-rose-700 text-white border-rose-400/30'
                : 'bg-gradient-to-br from-slate-700 to-slate-900 text-white border-slate-600/30'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider opacity-90">
                Your Net Balance
              </span>
              <div className="flex items-center space-x-1 text-xs font-bold bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full">
                {userNetCents > 0 ? (
                  <>
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>You Receive</span>
                  </>
                ) : userNetCents < 0 ? (
                  <>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>You Owe</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Settled Up</span>
                  </>
                )}
              </div>
            </div>

            <div className="text-3xl font-black tracking-tight my-2">
              {userNetCents >= 0 ? '+' : '-'}Rs.{' '}
              {(Math.abs(userNetCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/20 text-xs mt-3">
              <div>
                <span className="opacity-80 block text-[11px]">Your Total Paid</span>
                <span className="font-bold text-sm">
                  Rs. {(userPaidCents / 100).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="opacity-80 block text-[11px]">Your Total Share</span>
                <span className="font-bold text-sm">
                  Rs. {(userShareCents / 100).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Group Totals Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                Total Group Expenses
              </span>
              <span className="text-lg font-extrabold text-slate-900">
                Rs. {((trip.total_expenses_cents || 0) / 100).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                Total Expenses Logged
              </span>
              <span className="text-lg font-extrabold text-slate-900">
                {expenses.length} Records
              </span>
            </div>
          </div>

          {/* Recommended Settlements Teaser */}
          {recommendations.length > 0 && (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Minimized Settlement Suggestions
                </h3>
                <button
                  onClick={() => setActiveTab('balances')}
                  className="text-xs font-bold text-brand-600 hover:text-brand-800"
                >
                  View All
                </button>
              </div>

              <div className="space-y-2">
                {recommendations.slice(0, 3).map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl"
                  >
                    <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                      <span className="text-slate-900">{rec.from_user.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-900">{rec.to_user.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black text-slate-900">
                        Rs. {(rec.amount_cents / 100).toLocaleString()}
                      </span>
                      <button
                        onClick={() => {
                          setSettlementToRecord(rec);
                          setShowRecordSettlement(true);
                        }}
                        className="py-1 px-2.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[11px] transition-colors"
                      >
                        Settle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: EXPENSES TIMELINE ================= */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Search & Category Filter Bar */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search expenses by title or notes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Category horizontal scroll */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setCategoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  categoryFilter === 'ALL'
                    ? 'bg-brand-500 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                All
              </button>
              {(Object.keys(CATEGORY_ICONS) as ExpenseCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                    categoryFilter === cat
                      ? 'bg-brand-500 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{CATEGORY_ICONS[cat]}</span>
                  <span>{cat}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Expenses List */}
          {filteredExpenses.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center space-y-2 border border-slate-200">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Expenses Found</h3>
              <p className="text-xs text-slate-400">
                {expenses.length === 0
                  ? 'No expenses recorded yet. Tap "+ Add Expense" to start.'
                  : 'No expenses match your filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExpenses.map(exp => {
                const canModify = isOwner || exp.created_by === user?.id;
                const icon = CATEGORY_ICONS[exp.category] || '🧾';
                const splitCount = exp.splits?.length || members.length;

                return (
                  <div
                    key={exp.id}
                    className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-xl shadow-2xs">
                          {icon}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-bold text-sm text-slate-900 leading-tight">
                              {exp.title}
                            </h4>
                            {exp.subcategory && (
                              <span className="text-[10px] bg-brand-50 text-brand-700 font-bold px-2 py-0.5 rounded-full border border-brand-200">
                                {exp.subcategory}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                            <span>Paid by <strong className="text-slate-700">{exp.payer?.name || 'Member'}</strong></span>
                            <span>•</span>
                            <span>Shared by {splitCount} people</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-sm text-slate-900 block">
                          Rs. {(exp.amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {exp.expense_date}
                        </span>
                      </div>
                    </div>

                    {exp.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        {exp.notes}
                      </p>
                    )}

                    {canModify && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setExpenseToEdit(exp);
                            setShowAddExpense(true);
                          }}
                          className="flex items-center space-x-1 text-[11px] text-slate-600 hover:text-brand-600 font-bold px-2.5 py-1 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit / Re-assign</span>
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-rose-600 font-bold px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: BALANCES & SETTLEMENTS ================= */}
      {activeTab === 'balances' && (
        <div className="space-y-5">
          {/* Member Balance Summary Table */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Member Balances
            </h3>
            <div className="space-y-2.5">
              {balances.map(b => (
                <div
                  key={b.user_id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 border border-slate-100"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {b.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-slate-900">{b.user.name}</span>
                        {b.user_id === user?.id && (
                          <span className="text-[10px] text-slate-400">(You)</span>
                        )}
                        {b.role === 'OWNER' && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold uppercase px-1.5 rounded-sm">
                            Owner
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Paid: Rs. {(b.total_paid_cents / 100).toLocaleString()} • Share: Rs. {(b.total_share_cents / 100).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`text-xs font-black px-2.5 py-1 rounded-full ${
                      b.net_balance_cents > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : b.net_balance_cents < 0
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {b.net_balance_cents > 0 ? '+' : b.net_balance_cents < 0 ? '-' : ''}
                    Rs. {(Math.abs(b.net_balance_cents) / 100).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Minimized Settlement Algorithm Output */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Optimized Settlement Plan
                </h3>
                <p className="text-[11px] text-slate-500">
                  Mathematically minimized transactions to clear all debts
                </p>
              </div>
            </div>

            {recommendations.length === 0 ? (
              <div className="p-6 text-center text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl">
                🎉 All balances are settled up! No transactions needed.
              </div>
            ) : (
              <div className="space-y-2">
                {recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs"
                  >
                    <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                      <span className="text-rose-700">{rec.from_user.name}</span>
                      <span className="text-slate-400 font-normal">pays</span>
                      <span className="text-emerald-700">{rec.to_user.name}</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-black text-slate-900">
                        Rs. {(rec.amount_cents / 100).toLocaleString()}
                      </span>
                      <button
                        onClick={() => {
                          setSettlementToRecord(rec);
                          setShowRecordSettlement(true);
                        }}
                        className="py-1.5 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-xs transition-all"
                      >
                        Record Pay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Export Report / PDF Action Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm">Need to send a complete statement to everyone?</h4>
              <p className="text-xs text-slate-400 mt-0.5">Generate a clean PDF report or copy a WhatsApp summary</p>
            </div>
            <button
              onClick={() => setShowExportSummary(true)}
              className="py-2.5 px-4 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 flex-shrink-0"
            >
              <FileText className="w-4 h-4" />
              <span>Generate PDF / Share</span>
            </button>
          </div>

          {/* Settlement Payment History */}
          {settlements.length > 0 && (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Settlement History ({settlements.length})
              </h3>
              <div className="space-y-2">
                {settlements.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {s.from_user?.name} paid {s.to_user?.name}
                      </div>
                      <div className="text-[10px] text-slate-400">{s.created_at?.split('T')[0]}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900">
                        Rs. {(s.amount_cents / 100).toLocaleString()}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: MEMBERS ================= */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Trip Members ({members.length})
            </h3>
            <button
              onClick={() => setShowInviteModal(true)}
              className="text-xs font-bold text-brand-600 hover:text-brand-800"
            >
              + Invite Friends
            </button>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs divide-y divide-slate-100">
            {members.map(m => {
              const isSelf = m.user_id === user?.id;
              const isTargetOwner = m.role === 'OWNER';

              return (
                <div key={m.id} className="py-3 flex items-center justify-between first:pt-1 last:pb-1">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-brand-500 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                      {m.user?.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-bold text-slate-900">{m.user?.name}</span>
                        {isSelf && <span className="text-xs text-slate-400">(You)</span>}
                        {isTargetOwner && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold uppercase px-1.5 rounded-sm">
                            Owner
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{m.user?.email}</p>
                    </div>
                  </div>

                  {/* Remove or Leave Action */}
                  <div>
                    {isOwner && !isTargetOwner && (
                      <button
                        onClick={() => handleRemoveMember(m.user_id, m.user?.name || '')}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {!isOwner && isSelf && (
                      <button
                        onClick={handleLeaveTrip}
                        className="py-1 px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      >
                        Leave Trip
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddExpense && (
        <AddExpenseModal
          trip={trip}
          members={members}
          currentUserId={user!.id}
          expenseToEdit={expenseToEdit}
          onClose={() => {
            setShowAddExpense(false);
            setExpenseToEdit(null);
          }}
          onExpenseAdded={loadTripRoomData}
        />
      )}

      {showBatchModal && (
        <BatchExpenseModal
          trip={trip}
          members={members}
          currentUserId={user!.id}
          onClose={() => setShowBatchModal(false)}
          onExpensesAdded={loadTripRoomData}
        />
      )}

      {showInviteModal && (
        <InviteModal
          trip={trip}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {showExportSummary && (
        <ExportSummaryModal
          trip={trip}
          members={members}
          expenses={expenses}
          balances={balances}
          recommendations={recommendations}
          onClose={() => setShowExportSummary(false)}
        />
      )}

      {showRequestsModal && (
        <JoinRequestsModal
          trip={trip}
          onClose={() => setShowRequestsModal(false)}
          onRequestHandled={loadTripRoomData}
        />
      )}

      {showRecordSettlement && (
        <RecordSettlementModal
          trip={trip}
          members={members}
          recommendation={settlementToRecord}
          onClose={() => {
            setShowRecordSettlement(false);
            setSettlementToRecord(null);
          }}
          onSettlementRecorded={loadTripRoomData}
        />
      )}
    </div>
  );
};
