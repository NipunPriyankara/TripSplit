import React, { useState } from 'react';
import { X, Plus, Trash2, Check, Receipt, DollarSign, Layers, Users, Sparkles } from 'lucide-react';
import { Trip, TripMember, TripCategory } from '../types/index.js';
import { api } from '../api/client.js';

interface BatchExpenseModalProps {
  trip: Trip;
  members: TripMember[];
  currentUserId: string;
  onClose: () => void;
  onExpensesAdded: () => void;
}

interface BatchItemRow {
  id: string;
  title: string;
  amountStr: string;
  category: string;
  subcategory: string;
}

const DEFAULT_CATEGORIES = [
  'Food', 'Drinks', 'Hotel', 'Transport', 'Fuel', 'Tickets', 'Shopping', 'Other'
];

export const BatchExpenseModal: React.FC<BatchExpenseModalProps> = ({
  trip,
  members,
  currentUserId,
  onClose,
  onExpensesAdded,
}) => {
  const [paidBy, setPaidBy] = useState<string>(currentUserId);
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    new Set(members.map(m => m.user_id))
  );

  // Rows of expenses
  const [items, setItems] = useState<BatchItemRow[]>([
    { id: '1', title: 'Lunch', amountStr: '', category: 'Food', subcategory: '' },
    { id: '2', title: 'Transport / Fuel', amountStr: '', category: 'Transport', subcategory: '' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add a new row
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2),
        title: '',
        amountStr: '',
        category: 'Food',
        subcategory: '',
      },
    ]);
  };

  // Remove a row
  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Update row field
  const handleItemChange = (id: string, field: keyof BatchItemRow, value: string) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Toggle member
  const toggleMember = (userId: string) => {
    const next = new Set(selectedMemberIds);
    if (next.has(userId)) {
      if (next.size === 1) return;
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelectedMemberIds(next);
  };

  // Calculations
  const grandTotalCents = items.reduce((acc, it) => {
    const val = parseFloat(it.amountStr || '0');
    return acc + (isNaN(val) ? 0 : Math.round(val * 100));
  }, 0);

  const activeParticipantCount = selectedMemberIds.size || 1;
  const perPersonCents = Math.floor(grandTotalCents / activeParticipantCount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const validItems: { title: string; amount_cents: number; category: string; subcategory?: string | null }[] = [];

    for (const it of items) {
      if (!it.title.trim()) {
        setError('Please provide a title for all expense items');
        return;
      }
      const amt = parseFloat(it.amountStr);
      if (!amt || amt <= 0) {
        setError(`Please enter a valid amount for "${it.title}"`);
        return;
      }
      validItems.push({
        title: it.title.trim(),
        amount_cents: Math.round(amt * 100),
        category: it.category,
        subcategory: it.subcategory.trim() || null,
      });
    }

    if (validItems.length === 0) {
      setError('Please add at least one expense item');
      return;
    }

    if (selectedMemberIds.size === 0) {
      setError('Please select at least one member to split with');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createBatchExpenses(trip.id, {
        paid_by: paidBy,
        split_type: 'EQUAL',
        expense_date: expenseDate,
        participant_ids: Array.from(selectedMemberIds),
        items: validItems,
      });

      onExpensesAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save batch expenses');
    } finally {
      setIsSubmitting(false);
    }
  };

  const payerName = members.find(m => m.user_id === paidBy)?.user?.name || 'You';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto animate-slideUp flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Batch Expense Entry (Multiple Items)
              </h2>
              <p className="text-xs text-slate-500">
                One person paid for multiple items? Split them all in one go!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              {error}
            </div>
          )}

          {/* Top Controls: Who Paid & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Who Paid for Everything? *
              </label>
              <select
                value={paidBy}
                onChange={e => setPaidBy(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user?.name} {m.user_id === currentUserId ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Split Members Checklist */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Split Total Between ({selectedMemberIds.size} of {members.length} members)</span>
              </label>
              <button
                type="button"
                onClick={() => setSelectedMemberIds(new Set(members.map(m => m.user_id)))}
                className="text-[11px] font-bold text-brand-600 hover:text-brand-800"
              >
                Select All
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {members.map(m => {
                const isSelected = selectedMemberIds.has(m.user_id);
                return (
                  <button
                    type="button"
                    key={m.user_id}
                    onClick={() => toggleMember(m.user_id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 text-brand-900 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                        isSelected ? 'bg-brand-500 text-white' : 'border border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span>{m.user?.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multiple Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Expense Items ({items.length})
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center space-x-1 py-1 px-2 rounded-lg hover:bg-brand-50"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Item</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 shadow-2xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold text-slate-400 w-5">
                      #{index + 1}
                    </span>

                    {/* Title */}
                    <input
                      type="text"
                      required
                      placeholder="Title (e.g. Lunch, Kottu, Fuel)"
                      value={item.title}
                      onChange={e => handleItemChange(item.id, 'title', e.target.value)}
                      className="flex-1 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />

                    {/* Amount */}
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        Rs.
                      </span>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="0.00"
                        value={item.amountStr}
                        onChange={e => handleItemChange(item.id, 'amountStr', e.target.value)}
                        className="w-full pl-8 pr-2.5 py-2 text-xs font-extrabold text-right bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>

                    {/* Remove button */}
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pl-7">
                    {/* Category */}
                    <select
                      value={item.category}
                      onChange={e => handleItemChange(item.id, 'category', e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-700"
                    >
                      {DEFAULT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    {/* Subcategory */}
                    <input
                      type="text"
                      placeholder="Subcategory (e.g. Rice, Petrol)"
                      value={item.subcategory}
                      onChange={e => handleItemChange(item.id, 'subcategory', e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-700"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-brand-400 hover:bg-brand-50/50 rounded-2xl text-xs font-bold text-slate-600 hover:text-brand-700 transition-all flex items-center justify-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Expense Item</span>
            </button>
          </div>

          {/* Grand Total Calculation Banner */}
          <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl flex items-center justify-between shadow-md">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                Grand Total ({items.length} Items) • Paid by {payerName}
              </span>
              <span className="text-xl font-black">
                Rs. {(grandTotalCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">
                Each Person's Share
              </span>
              <span className="text-base font-extrabold text-emerald-300">
                Rs. {(perPersonCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 block">
                ({activeParticipantCount} members)
              </span>
            </div>
          </div>

          {/* Submit */}
          <div>
            <button
              type="submit"
              disabled={isSubmitting || grandTotalCents <= 0}
              className="w-full py-4 px-6 rounded-2xl bg-brand-500 hover:bg-brand-600 active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>
                {isSubmitting
                  ? 'Saving All Expenses...'
                  : `Save All ${items.length} Expenses (Rs. ${(grandTotalCents / 100).toLocaleString()})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
