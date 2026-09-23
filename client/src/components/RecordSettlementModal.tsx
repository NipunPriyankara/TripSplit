import React, { useState } from 'react';
import { X, CheckCircle2, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Trip, TripMember, SettlementTransaction } from '../types/index.js';
import { api } from '../api/client.js';

interface RecordSettlementModalProps {
  trip: Trip;
  members: TripMember[];
  recommendation?: SettlementTransaction | null;
  onClose: () => void;
  onSettlementRecorded: () => void;
}

export const RecordSettlementModal: React.FC<RecordSettlementModalProps> = ({
  trip,
  members,
  recommendation,
  onClose,
  onSettlementRecorded,
}) => {
  const [fromUserId, setFromUserId] = useState<string>(recommendation?.from_user_id || members[0]?.user_id || '');
  const [toUserId, setToUserId] = useState<string>(recommendation?.to_user_id || members[1]?.user_id || '');
  const [amountStr, setAmountStr] = useState<string>(
    recommendation ? (recommendation.amount_cents / 100).toString() : ''
  );
  const [status, setStatus] = useState<string>('PAID');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fromUserId === toUserId) {
      setError('Payer and recipient cannot be the same person.');
      return;
    }

    const amountNum = parseFloat(amountStr);
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.recordSettlement(trip.id, {
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount_cents: Math.round(amountNum * 100),
        status,
        notes: notes.trim() || undefined,
      });

      // Trigger celebratory confetti animation!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'],
      });

      onSettlementRecorded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record settlement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Record Settlement</h2>
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

        {error && (
          <div className="mt-4 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Transfer visual preview */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="text-center flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Payer</span>
              <select
                value={fromUserId}
                onChange={e => setFromUserId(e.target.value)}
                className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user?.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="px-3 text-slate-400">
              <ArrowRight className="w-5 h-5" />
            </div>

            <div className="text-center flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Recipient</span>
              <select
                value={toUserId}
                onChange={e => setToUserId(e.target.value)}
                className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user?.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Amount Settled ({trip.currency}) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">
                {trip.currency === 'LKR' ? 'Rs.' : trip.currency}
              </span>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                className="w-full pl-16 pr-4 py-3 text-xl font-extrabold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Settlement Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('PAID')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  status === 'PAID'
                    ? 'border-brand-500 bg-brand-50 text-brand-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Mark as Paid
              </button>
              <button
                type="button"
                onClick={() => setStatus('CONFIRMED')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  status === 'CONFIRMED'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Confirmed / Settled
              </button>
            </div>
          </div>

          {/* Optional notes */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Bank transfer, Commercial Bank"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-[0.99] transition-all"
            >
              {isSubmitting ? 'Recording...' : 'Confirm Settlement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
