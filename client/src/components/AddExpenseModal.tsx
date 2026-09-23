import React, { useState, useEffect } from 'react';
import { X, Check, DollarSign, Plus, Tag, Layers, Edit3 } from 'lucide-react';
import { SplitType, TripMember, Trip, Expense, TripCategory } from '../types/index.js';
import { api } from '../api/client.js';
import { useOfflineSync } from '../hooks/useOfflineSync.js';
import { localDb } from '../db/db.js';

interface AddExpenseModalProps {
  trip: Trip;
  members: TripMember[];
  currentUserId: string;
  expenseToEdit?: Expense | null;
  onClose: () => void;
  onExpenseAdded: () => void;
}

const DEFAULT_CATEGORIES: TripCategory[] = [
  { id: '1', trip_id: '', name: 'Food', icon: '🍛', subcategories: ['Rice & Curry', 'Kottu', 'Breakfast', 'Lunch', 'Dinner', 'Shorties', 'Snacks'] },
  { id: '2', trip_id: '', name: 'Drinks', icon: '🍻', subcategories: ['Soft Drinks', 'Beer', 'Coffee / Tea', 'Bottled Water', 'Liquor'] },
  { id: '3', trip_id: '', name: 'Hotel', icon: '🏨', subcategories: ['Room Charges', 'Villa Booking', 'Service Fee', 'Camping'] },
  { id: '4', trip_id: '', name: 'Transport', icon: '🚕', subcategories: ['Van / Car Hire', 'Highway Toll', 'Train Tickets', 'Tuk-Tuk', 'Bus'] },
  { id: '5', trip_id: '', name: 'Fuel', icon: '⛽', subcategories: ['Petrol', 'Diesel'] },
  { id: '6', trip_id: '', name: 'Tickets', icon: '🎟️', subcategories: ['Entrance Fees', 'Safari Jeep', 'Boat Ride', 'Activity Pass'] },
  { id: '7', trip_id: '', name: 'Shopping', icon: '🛍️', subcategories: ['Groceries', 'Souvenirs', 'Clothing'] },
  { id: '8', trip_id: '', name: 'Other', icon: '🧾', subcategories: ['Tips', 'Emergency', 'Miscellaneous'] },
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  trip,
  members,
  currentUserId,
  expenseToEdit,
  onClose,
  onExpenseAdded,
}) => {
  const { queueMutation } = useOfflineSync();
  const isEditing = Boolean(expenseToEdit);

  const [title, setTitle] = useState(expenseToEdit?.title || '');
  const [amountStr, setAmountStr] = useState(
    expenseToEdit ? (expenseToEdit.amount_cents / 100).toString() : ''
  );
  const [category, setCategory] = useState<string>(expenseToEdit?.category || 'Food');
  const [subcategory, setSubcategory] = useState<string>(expenseToEdit?.subcategory || '');
  const [paidBy, setPaidBy] = useState<string>(expenseToEdit?.paid_by || currentUserId);
  const [splitType, setSplitType] = useState<SplitType>(expenseToEdit?.split_type || 'EQUAL');
  const [notes, setNotes] = useState(expenseToEdit?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Categories list
  const [categories, setCategories] = useState<TripCategory[]>(DEFAULT_CATEGORIES);
  const [showAddCustomCategory, setShowAddCustomCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🏷️');

  // Custom subcategory input
  const [showAddCustomSub, setShowAddCustomSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');

  // Selected members for split (defaults to all members or pre-existing splits if editing)
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(() => {
    if (expenseToEdit && expenseToEdit.splits && expenseToEdit.splits.length > 0) {
      return new Set(expenseToEdit.splits.map(s => s.user_id));
    }
    return new Set(members.map(m => m.user_id));
  });

  // Custom inputs for EXACT, PERCENTAGE, and SHARES
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (expenseToEdit?.split_type === 'EXACT' && expenseToEdit.splits) {
      for (const s of expenseToEdit.splits) {
        map[s.user_id] = (s.amount_cents / 100).toString();
      }
    }
    return map;
  });

  const [percentages, setPercentages] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (expenseToEdit?.split_type === 'PERCENTAGE' && expenseToEdit.splits) {
      for (const s of expenseToEdit.splits) {
        if (s.percentage !== undefined && s.percentage !== null) {
          map[s.user_id] = s.percentage.toString();
        }
      }
    }
    return map;
  });

  const [shares, setShares] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (expenseToEdit?.split_type === 'SHARES' && expenseToEdit.splits) {
      for (const s of expenseToEdit.splits) {
        if (s.shares !== undefined && s.shares !== null) {
          map[s.user_id] = s.shares.toString();
        }
      }
    }
    return map;
  });

  // Load custom categories from server
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await api.getCategories(trip.id);
        if (res.categories && res.categories.length > 0) {
          setCategories(res.categories);
        }
      } catch (e) {
        // use default categories if offline
      }
    };
    fetchCats();
  }, [trip.id]);

  const activeCategoryObj = categories.find(c => c.name === category);

  const toggleMember = (userId: string) => {
    const updated = new Set(selectedMemberIds);
    if (updated.has(userId)) {
      if (updated.size === 1) return;
      updated.delete(userId);
    } else {
      updated.add(userId);
    }
    setSelectedMemberIds(updated);
  };

  const handleSelectAll = () => {
    setSelectedMemberIds(new Set(members.map(m => m.user_id)));
  };

  // Add custom category
  const handleCreateCustomCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await api.createCategory(trip.id, {
        name: newCatName.trim(),
        icon: newCatIcon || '🏷️',
      });
      setCategories(prev => [...prev, res.category]);
      setCategory(res.category.name);
      setSubcategory('');
      setNewCatName('');
      setShowAddCustomCategory(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    }
  };

  // Add custom subcategory
  const handleAddSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    const sub = newSubName.trim();
    try {
      await api.createCategory(trip.id, {
        name: category,
        subcategory: sub,
      });
      setCategories(prev =>
        prev.map(c =>
          c.name === category ? { ...c, subcategories: [...c.subcategories, sub] } : c
        )
      );
      setSubcategory(sub);
      setNewSubName('');
      setShowAddCustomSub(false);
    } catch (err: any) {
      setSubcategory(sub);
      setShowAddCustomSub(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amountStr);
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid expense amount');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title for the expense');
      return;
    }

    const amount_cents = Math.round(amountNum * 100);
    const activeParticipants = members.filter(m => selectedMemberIds.has(m.user_id));

    if (activeParticipants.length === 0) {
      setError('Please select at least one person to split this expense with');
      return;
    }

    // Build splits array
    let splitsPayload: any[] = [];

    if (splitType === 'EQUAL') {
      splitsPayload = activeParticipants.map(m => ({ user_id: m.user_id }));
    } else if (splitType === 'EXACT') {
      let currentTotalCents = 0;
      for (const m of activeParticipants) {
        const val = parseFloat(exactAmounts[m.user_id] || '0');
        const cents = Math.round(val * 100);
        currentTotalCents += cents;
        splitsPayload.push({ user_id: m.user_id, amount_cents: cents });
      }
      if (currentTotalCents !== amount_cents) {
        setError(
          `Sum of split amounts (${(currentTotalCents / 100).toFixed(2)}) must equal total (${amountNum.toFixed(2)})`
        );
        return;
      }
    } else if (splitType === 'PERCENTAGE') {
      let totalPct = 0;
      for (const m of activeParticipants) {
        const pct = parseFloat(percentages[m.user_id] || '0');
        totalPct += pct;
        splitsPayload.push({ user_id: m.user_id, percentage: pct });
      }
      if (Math.abs(totalPct - 100) > 0.1) {
        setError(`Total percentage must equal 100% (currently ${totalPct.toFixed(1)}%)`);
        return;
      }
    } else if (splitType === 'SHARES') {
      let totalShares = 0;
      for (const m of activeParticipants) {
        const s = parseFloat(shares[m.user_id] || '1');
        if (s <= 0) {
          setError('Shares must be greater than 0');
          return;
        }
        totalShares += s;
        splitsPayload.push({ user_id: m.user_id, shares: s });
      }
      if (totalShares <= 0) {
        setError('Total shares must be greater than 0');
        return;
      }
    }

    setIsSubmitting(true);
    const expenseId = expenseToEdit?.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
    const now = new Date().toISOString();

    const payload = {
      id: expenseId,
      trip_id: trip.id,
      title: title.trim(),
      amount_cents,
      category,
      subcategory: subcategory.trim() || null,
      paid_by: paidBy,
      split_type: splitType,
      expense_date: expenseToEdit?.expense_date || now.split('T')[0],
      notes: notes.trim() || null,
      splits: splitsPayload,
    };

    try {
      if (navigator.onLine) {
        if (isEditing && expenseToEdit) {
          await api.updateExpense(trip.id, expenseToEdit.id, payload);
        } else {
          await api.createExpense(trip.id, payload);
        }
      } else {
        // Offline handling
        const base = Math.floor(amount_cents / activeParticipants.length);
        const rem = amount_cents % activeParticipants.length;
        const calculatedSplits = activeParticipants.map((p, idx) => ({
          user_id: p.user_id,
          amount_cents: base + (idx < rem ? 1 : 0),
        }));

        await localDb.expenses.put({
          ...payload,
          created_by: expenseToEdit?.created_by || currentUserId,
          created_at: expenseToEdit?.created_at || now,
          updated_at: now,
          splits: calculatedSplits.map(c => ({
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
            expense_id: expenseId,
            user_id: c.user_id,
            amount_cents: c.amount_cents,
          })),
        });

        await queueMutation(isEditing ? 'UPDATE' : 'CREATE', 'expense', expenseId, payload);
      }

      onExpenseAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-xl ${isEditing ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700'}`}>
              {isEditing ? <Edit3 className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing ? 'Edit Expense & Re-assign' : 'Add New Expense'}
              </h2>
              <p className="text-xs text-slate-500">{trip.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              {error}
            </div>
          )}

          {/* Amount & Title */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Amount ({trip.currency}) *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">
                  {trip.currency === 'LKR' ? 'Rs.' : trip.currency}
                </span>
                <input
                  type="number"
                  step="any"
                  autoFocus={!isEditing}
                  required
                  placeholder="0.00"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="w-full pl-16 pr-4 py-3.5 text-2xl font-extrabold text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                What was this for? *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dinner, Kottu Night, Safari Jeep, Fuel"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-3 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Category & Custom Category Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Category
              </label>
              <button
                type="button"
                onClick={() => setShowAddCustomCategory(!showAddCustomCategory)}
                className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Category</span>
              </button>
            </div>

            {/* Inline Custom Category Creator */}
            {showAddCustomCategory && (
              <div className="mb-3 p-3 bg-brand-50 border border-brand-200 rounded-2xl space-y-2">
                <span className="text-[11px] font-bold text-brand-900 block">
                  Add Custom Category to this Trip:
                </span>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Icon (e.g. 🏄, 🏕️, 🍕)"
                    value={newCatIcon}
                    onChange={e => setNewCatIcon(e.target.value)}
                    className="w-16 px-2 py-1.5 text-xs text-center border border-brand-300 rounded-xl bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Category Name (e.g. Water Sports)"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-brand-300 rounded-xl bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCustomCategory}
                    className="px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              {categories.map(cat => (
                <button
                  type="button"
                  key={cat.name}
                  onClick={() => {
                    setCategory(cat.name);
                    setSubcategory('');
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-medium transition-all ${
                    category === cat.name
                      ? 'border-brand-500 bg-brand-50/80 text-brand-900 font-bold shadow-sm'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="text-xl mb-1">{cat.icon || '🏷️'}</span>
                  <span className="truncate w-full text-center">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subcategories (e.g. Food -> Rice, Kottu, Dinner) */}
          {activeCategoryObj && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <span>Subcategory ({activeCategoryObj.name})</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCustomSub(!showAddCustomSub)}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800"
                >
                  + Custom Item
                </button>
              </div>

              {showAddCustomSub && (
                <div className="flex items-center space-x-2 mb-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="text"
                    placeholder={`e.g. Special ${activeCategoryObj.name} item`}
                    value={newSubName}
                    onChange={e => setNewSubName(e.target.value)}
                    className="flex-1 px-2.5 py-1 text-xs border rounded-lg bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubcategory}
                    className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold"
                  >
                    Save
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {activeCategoryObj.subcategories.map(sub => {
                  const isSelected = subcategory === sub;
                  return (
                    <button
                      type="button"
                      key={sub}
                      onClick={() => setSubcategory(isSelected ? '' : sub)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-brand-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Paid By Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Paid By
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {members.map(m => {
                const isSelected = paidBy === m.user_id;
                return (
                  <button
                    type="button"
                    key={m.user_id}
                    onClick={() => setPaidBy(m.user_id)}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-full border text-xs whitespace-nowrap transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500 text-white font-semibold shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>{m.user?.name || 'Member'}</span>
                    {m.user_id === currentUserId && <span className="text-[10px] opacity-80">(You)</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Split Mode Selector & Member Assignment */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Split Between Members
                </label>
                {isEditing && (
                  <span className="text-[10px] text-amber-600 font-bold">
                    💡 Check any new members below to assign them this expense!
                  </span>
                )}
              </div>
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                {(['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'] as SplitType[]).map(type => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setSplitType(type)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      splitType === type
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Split Members Checklist / Inputs */}
            <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 text-xs">
                <span className="font-semibold text-slate-600">
                  Participating: {selectedMemberIds.size} of {members.length} members
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-brand-600 hover:text-brand-800 font-bold"
                >
                  Select All
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
                {members.map(m => {
                  const isChecked = selectedMemberIds.has(m.user_id);
                  return (
                    <div
                      key={m.user_id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100 shadow-2xs"
                    >
                      <button
                        type="button"
                        onClick={() => toggleMember(m.user_id)}
                        className="flex items-center space-x-2.5 text-left flex-1"
                      >
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                            isChecked
                              ? 'bg-brand-500 border-brand-500 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span className="text-xs font-semibold text-slate-800">
                          {m.user?.name}
                          {m.user_id === currentUserId ? ' (You)' : ''}
                        </span>
                      </button>

                      {/* Exact Amounts */}
                      {isChecked && splitType === 'EXACT' && (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-slate-400">Rs.</span>
                          <input
                            type="number"
                            step="any"
                            placeholder="0"
                            value={exactAmounts[m.user_id] || ''}
                            onChange={e =>
                              setExactAmounts({ ...exactAmounts, [m.user_id]: e.target.value })
                            }
                            className="w-20 px-2 py-1 text-xs border rounded-md text-right font-medium"
                          />
                        </div>
                      )}

                      {/* Percentage */}
                      {isChecked && splitType === 'PERCENTAGE' && (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            step="any"
                            placeholder="0"
                            value={percentages[m.user_id] || ''}
                            onChange={e =>
                              setPercentages({ ...percentages, [m.user_id]: e.target.value })
                            }
                            className="w-16 px-2 py-1 text-xs border rounded-md text-right font-medium"
                          />
                          <span className="text-xs text-slate-400">%</span>
                        </div>
                      )}

                      {/* Shares */}
                      {isChecked && splitType === 'SHARES' && (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            placeholder="1"
                            value={shares[m.user_id] || '1'}
                            onChange={e =>
                              setShares({ ...shares, [m.user_id]: e.target.value })
                            }
                            className="w-16 px-2 py-1 text-xs border rounded-md text-right font-medium"
                          />
                          <span className="text-xs text-slate-400">shares</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Paid cash, or any receipt note"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
            />
          </div>

          {/* Save / Update Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-2xl bg-brand-500 hover:bg-brand-600 active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <span>{isEditing ? 'Updating...' : 'Saving Expense...'}</span>
              ) : (
                <>
                  <span>{isEditing ? 'Update & Re-split Expense' : 'Save Expense'}</span>
                  <span>(Rs. {parseFloat(amountStr || '0').toLocaleString()})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
