import React, { useState, useEffect } from 'react';
import { Plus, Users, Compass, Calendar, ArrowRight, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { Trip } from '../types/index.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { EVENT_TYPES } from '../config/eventTypes.js';

interface HomePageProps {
  onSelectTrip: (tripId: string) => void;
  onCreateTrip: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onSelectTrip, onCreateTrip }) => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.getTrips();
      setTrips(res.trips);
    } catch (err: any) {
      setError(err.message || 'Failed to load trips');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const totalTripExpensesCents = trips.reduce(
    (acc, t) => acc + (t.total_expenses_cents || 0),
    0
  );

  return (
    <div className="pb-24 pt-4 px-4 max-w-lg mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Hello, {user?.name || 'Traveler'} 👋
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Ready to split trip expenses?</p>
        </div>
        <button
          onClick={onCreateTrip}
          className="flex items-center space-x-1 py-2 px-3.5 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-brand-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Trip</span>
        </button>
      </div>

      {/* Aggregate Balance Stats Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-5 shadow-xl shadow-slate-900/15 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-brand-500/20 rounded-full blur-2xl pointer-events-none" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
          Active Trips Portfolio
        </span>
        <div className="text-3xl font-black tracking-tight mb-4">
          Rs. {(totalTripExpensesCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/60">
          <div>
            <span className="text-[11px] text-slate-400 block mb-0.5">Total Trips</span>
            <span className="text-sm font-bold text-white flex items-center space-x-1">
              <Compass className="w-4 h-4 text-brand-400 inline" />
              <span>{trips.length} Active</span>
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block mb-0.5">Offline Ready</span>
            <span className="text-sm font-bold text-emerald-400 flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4 inline" />
              <span>Auto-Syncing</span>
            </span>
          </div>
        </div>
      </div>

      {/* Trips Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Your Trips ({trips.length})
          </h2>
        </div>

        {error && (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-28 bg-slate-200/70 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3 shadow-xs">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
              <Compass className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Trips Yet</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Create a trip to start splitting food, hotel, fuel, and travel expenses with friends.
            </p>
            <div className="pt-2">
              <button
                onClick={onCreateTrip}
                className="py-2.5 px-5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
              >
                + Create Your First Trip
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map(trip => (
              <div
                key={trip.id}
                onClick={() => onSelectTrip(trip.id)}
                className="group bg-white border border-slate-200 hover:border-brand-300 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-brand-600 transition-colors">
                        {trip.name}
                      </h3>
                      {(() => {
                        const typeInfo = EVENT_TYPES.find(t => t.id === trip.event_type);
                        if (!typeInfo) return null;
                        return (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${typeInfo.badgeBg} ${typeInfo.badgeText}`}>
                            {typeInfo.emoji} {typeInfo.title}
                          </span>
                        );
                      })()}
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          trip.role === 'OWNER'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {trip.role === 'OWNER' ? 'Owner' : 'Member'}
                      </span>
                    </div>
                    {trip.description && (
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {trip.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Total
                    </span>
                    <span className="text-sm font-extrabold text-slate-900">
                      Rs. {((trip.total_expenses_cents || 0) / 100).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{trip.member_count || 1} members</span>
                    </span>
                    {trip.start_date && (
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{trip.start_date}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 font-bold text-brand-600 group-hover:translate-x-0.5 transition-transform">
                    <span>Enter Room</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
