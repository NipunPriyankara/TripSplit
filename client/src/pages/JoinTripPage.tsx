import React, { useState, useEffect } from 'react';
import { Compass, Calendar, User, ArrowRight, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

interface JoinTripPageProps {
  token: string;
  onJoinSubmitted: () => void;
  onGoHome: () => void;
}

export const JoinTripPage: React.FC<JoinTripPageProps> = ({ token, onJoinSubmitted, onGoHome }) => {
  const { user, register } = useAuth();
  const [invitePreview, setInvitePreview] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // If user is not authenticated, collect their name and email
  const [guestName, setGuestName] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestPassword, setGuestPassword] = useState<string>('guestpass123');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [requestSubmitted, setRequestSubmitted] = useState<boolean>(false);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setIsLoading(true);
        const res = await api.getInvitePreview(token);
        setInvitePreview(res.invitation);
      } catch (err: any) {
        setError(err.message || 'Invitation link is invalid or expired.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchPreview();
  }, [token]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // If not logged in, auto-register the guest account first
      if (!user) {
        if (!guestName.trim() || !guestEmail.trim()) {
          throw new Error('Please enter your name and email to join');
        }
        await register(guestName.trim(), guestEmail.trim(), guestPassword);
      }

      const res = await api.requestToJoin(token);
      setRequestSubmitted(true);
    } catch (err: any) {
      if (err.trip_id) {
        // Already a member!
        onJoinSubmitted();
      } else {
        setError(err.message || 'Failed to submit join request');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-3">
        <Compass className="w-10 h-10 text-brand-500 animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Checking trip invitation...</p>
      </div>
    );
  }

  if (error && !invitePreview) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md mx-auto">
        <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Invalid Invitation</h2>
        <p className="text-xs text-slate-500">{error}</p>
        <button
          onClick={onGoHome}
          className="py-2.5 px-6 rounded-xl bg-slate-900 text-white font-bold text-xs"
        >
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 flex flex-col justify-center px-4 py-8 safe-top safe-bottom">
      <div className="w-full max-w-md mx-auto">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/25 mb-3">
            <Compass className="w-7 h-7" />
          </div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-brand-600 block">
            Trip Invitation
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            You have been invited!
          </h1>
        </div>

        {/* Invitation Preview Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-6 space-y-5">
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Trip Name
            </span>
            <h2 className="text-xl font-extrabold text-slate-900">
              {invitePreview.trip_name}
            </h2>
            {invitePreview.description && (
              <p className="text-xs text-slate-600">{invitePreview.description}</p>
            )}

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span className="flex items-center space-x-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Created by <strong>{invitePreview.owner_name}</strong></span>
              </span>
              {invitePreview.start_date && (
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{invitePreview.start_date}</span>
                </span>
              )}
            </div>
          </div>

          {requestSubmitted ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-base font-extrabold text-emerald-900">
                Join Request Sent!
              </h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Your request has been delivered to <strong>{invitePreview.owner_name}</strong>.
                As soon as they approve, you'll gain access to the private trip room.
              </p>
              <div className="pt-2">
                <button
                  onClick={onGoHome}
                  className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors"
                >
                  Go to My Dashboard
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendRequest} className="space-y-4">
              {error && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                  {error}
                </div>
              )}

              {/* If user not logged in, ask for name & email */}
              {!user && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kasun Perera"
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Your Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="kasun@example.com"
                      value={guestEmail}
                      onChange={e => setGuestEmail(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              {user && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-500">Requesting to join as:</span>
                  <strong className="text-slate-900">{user.name} ({user.email})</strong>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 rounded-2xl bg-brand-500 hover:bg-brand-600 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center space-x-2"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>{isSubmitting ? 'Sending Request...' : 'Send Join Request'}</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-400">
                The Trip Owner must accept before you can view expenses and balances.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
