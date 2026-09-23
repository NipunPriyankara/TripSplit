import React from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, Bell, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useOfflineSync } from '../hooks/useOfflineSync.js';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  unreadCount?: number;
  onOpenNotifications?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'TripSplit',
  subtitle,
  onBack,
  unreadCount = 0,
  onOpenNotifications,
}) => {
  const { user } = useAuth();
  const { isOnline, isSyncing, pendingCount, syncNow } = useOfflineSync();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 transition-all">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2 overflow-hidden">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="truncate">
            <h1 className="font-bold text-lg text-slate-900 leading-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-slate-500 font-medium truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right side controls: Sync badge & Profile/Notification */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          {/* Sync Status Badge */}
          <button
            onClick={syncNow}
            disabled={isSyncing || !isOnline}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
              !isOnline
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : isSyncing
                ? 'bg-blue-100 text-blue-800 animate-pulse'
                : pendingCount > 0
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
            title={!isOnline ? 'Offline: Changes stored locally' : 'Click to force sync'}
          >
            {!isOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span>Offline {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
              </>
            ) : isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Syncing...</span>
              </>
            ) : pendingCount > 0 ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                <span>{pendingCount} waiting</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Synced</span>
              </>
            )}
          </button>

          {/* Notifications Button */}
          {user && onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="View notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {/* User Avatar */}
          {user && (
            <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
