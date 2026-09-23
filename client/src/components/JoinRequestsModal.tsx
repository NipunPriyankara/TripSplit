import React, { useState, useEffect } from 'react';
import { X, Check, UserPlus, AlertCircle } from 'lucide-react';
import { JoinRequest, Trip } from '../types/index.js';
import { api } from '../api/client.js';

interface JoinRequestsModalProps {
  trip: Trip;
  onClose: () => void;
  onRequestHandled: () => void;
}

export const JoinRequestsModal: React.FC<JoinRequestsModalProps> = ({
  trip,
  onClose,
  onRequestHandled,
}) => {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const res = await api.getJoinRequests(trip.id);
      setRequests(res.requests);
    } catch (e: any) {
      setError(e.message || 'Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [trip.id]);

  const handleApprove = async (requestId: string) => {
    try {
      setActionId(requestId);
      await api.approveJoinRequest(trip.id, requestId);
      setRequests(prev => prev.filter(r => r.id !== requestId));
      onRequestHandled();
    } catch (e: any) {
      setError(e.message || 'Failed to approve request');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setActionId(requestId);
      await api.rejectJoinRequest(trip.id, requestId);
      setRequests(prev => prev.filter(r => r.id !== requestId));
      onRequestHandled();
    } catch (e: any) {
      setError(e.message || 'Failed to reject request');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Join Requests</h2>
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

        {/* List */}
        <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading pending requests...</div>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No Pending Requests</p>
              <p className="text-xs text-slate-400">
                When friends click your invite link, their join requests will appear here for your approval.
              </p>
            </div>
          ) : (
            requests.map(req => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-2xs"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-brand-500 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                    {req.user?.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">
                      {req.user?.name}
                    </h3>
                    <p className="text-xs text-slate-500">{req.user?.email}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={actionId === req.id}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors"
                    title="Reject"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={actionId === req.id}
                    className="flex items-center space-x-1 py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Accept</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
