import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, MessageCircle, RefreshCw, ShieldAlert, Link as LinkIcon } from 'lucide-react';
import { Trip } from '../types/index.js';
import { api } from '../api/client.js';

interface InviteModalProps {
  trip: Trip;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ trip, onClose }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrCreateInvite = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.getInvitations(trip.id);
      if (res.invitations && res.invitations.length > 0) {
        setToken(res.invitations[0].token);
      } else {
        const gen = await api.generateInvite(trip.id);
        setToken(gen.invitation.token);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load invitation token');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrCreateInvite();
  }, [trip.id]);

  const handleRegenerate = async () => {
    try {
      setIsLoading(true);
      if (token) {
        await api.revokeInvite(trip.id, token);
      }
      const gen = await api.generateInvite(trip.id);
      setToken(gen.invitation.token);
    } catch (e: any) {
      setError(e.message || 'Failed to regenerate invite token');
    } finally {
      setIsLoading(false);
    }
  };

  const inviteUrl = token
    ? `${window.location.origin}/join/${token}`
    : '';

  const shareText = `Hey! Join our private group trip "${trip.name}" on TripSplit to share and track expenses: ${inviteUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Clipboard copy failed', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${trip.name} on TripSplit`,
          text: shareText,
          url: inviteUrl,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  };

  const handleWhatsAppShare = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-brand-100 text-brand-700 rounded-xl">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Invite Members</h2>
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

        {/* Security Notice */}
        <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed">
            <span className="font-bold">Private Room Protection:</span> This link does NOT grant immediate access. Anyone who clicks must submit a <strong>Join Request</strong> that you must personally approve.
          </div>
        </div>

        {/* Invite Link Box */}
        <div className="mt-5 space-y-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Shareable Invitation Link
          </label>
          <div className="flex items-center p-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <input
              type="text"
              readOnly
              value={isLoading ? 'Generating link...' : inviteUrl}
              className="w-full bg-transparent text-xs font-mono text-slate-700 focus:outline-none select-all truncate px-2"
            />
            <button
              onClick={handleCopy}
              disabled={isLoading || !token}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${
                copied
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sharing Action Buttons */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={handleWhatsAppShare}
            disabled={isLoading || !token}
            className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handleNativeShare}
            disabled={isLoading || !token}
            className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 font-bold text-xs transition-colors"
          >
            <Share2 className="w-4 h-4 text-slate-600" />
            <span>Share Sheet</span>
          </button>
        </div>

        {/* Regenerate Token Option */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Need to invalidate old links?</span>
          <button
            onClick={handleRegenerate}
            disabled={isLoading}
            className="flex items-center space-x-1 text-rose-600 hover:text-rose-800 font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Revoke & Reissue</span>
          </button>
        </div>
      </div>
    </div>
  );
};
