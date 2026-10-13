import React, { useState } from 'react';
import { Compass, Calendar, ArrowLeft, Check, Sparkles, CheckCircle2, Heart, PartyPopper, Music, Home } from 'lucide-react';
import { api } from '../api/client.js';
import { EVENT_TYPES, EventTypeConfig } from '../config/eventTypes.js';

interface CreateTripPageProps {
  onBack: () => void;
  onTripCreated: (tripId: string) => void;
}

export const CreateTripPage: React.FC<CreateTripPageProps> = ({ onBack, onTripCreated }) => {
  const [selectedType, setSelectedType] = useState<string>('trip');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState('LKR');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTypeConfig: EventTypeConfig = EVENT_TYPES.find(t => t.id === selectedType) || EVENT_TYPES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a room/event name');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.createTrip({
        name: name.trim(),
        event_type: selectedType,
        description: description.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        currency,
      });
      onTripCreated(res.trip.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create event room');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Create Event Room</h1>
          <p className="text-xs text-slate-500">Pick an event type and set up expense splitting</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
            {error}
          </div>
        )}

        {/* 1. Select Event Type Grid */}
        <div>
          <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
            1. Select Event Type *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {EVENT_TYPES.map(type => {
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? `border-brand-500 bg-brand-50/30 ring-2 ${type.borderActive}`
                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xl">{type.emoji}</span>
                      {type.badge && (
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${type.badgeBg} ${type.badgeText}`}>
                          {type.badge}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-xs text-slate-900">{type.title}</div>
                  </div>
                  {isSelected && (
                    <div className="mt-2 text-[10px] font-bold text-brand-600 flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Selected</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Interactive Feature & Category Preview Box */}
        <div className={`p-4 rounded-2xl border transition-all ${activeTypeConfig.bgActive} border-slate-200/80`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{activeTypeConfig.emoji}</span>
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                {activeTypeConfig.title} Suite Features
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200">
              Auto-configured
            </span>
          </div>

          <p className="text-xs text-slate-600 mb-3 font-medium">
            {activeTypeConfig.description}
          </p>

          {/* Preset Categories Badges */}
          <div className="mb-3">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
              Included Categories:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {activeTypeConfig.categories.map((cat, i) => (
                <span
                  key={i}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white border border-slate-200/90 shadow-2xs rounded-lg text-[11px] font-bold text-slate-700"
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Key Features Bullet Points */}
          <div className="space-y-1 pt-1 border-t border-slate-200/60">
            {activeTypeConfig.features.map((feat, i) => (
              <div key={i} className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-600">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Event Details Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Event Room Name *
            </label>
            <input
              type="text"
              required
              placeholder={activeTypeConfig.placeholder}
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full px-4 py-2.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
            >
              <option value="LKR">LKR - Sri Lankan Rupee (Rs.)</option>
              <option value="USD">USD - US Dollar ($)</option>
              <option value="EUR">EUR - Euro (€)</option>
              <option value="GBP">GBP - British Pound (£)</option>
              <option value="SGD">SGD - Singapore Dollar (S$)</option>
              <option value="INR">INR - Indian Rupee (₹)</option>
              <option value="AUD">AUD - Australian Dollar (A$)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Budget splitting and vendor payment logs for our event"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating Room...' : `Create ${activeTypeConfig.title} Room`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
