import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Compass, ArrowRight } from 'lucide-react';
import { NotificationItem } from '../types/index.js';
import { api } from '../api/client.js';

interface NotificationsPageProps {
  onSelectTrip?: (tripId: string) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onSelectTrip }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchNotifs = async () => {
    try {
      setIsLoading(true);
      const res = await api.getNotifications();
      setNotifications(res.notifications);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      api.markNotificationRead(notif.id).catch(console.error);
      setNotifications(prev =>
        prev.map(n => (n.id === notif.id ? { ...n, is_read: 1 } : n))
      );
    }
    if (notif.trip_id && onSelectTrip) {
      onSelectTrip(notif.trip_id);
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-900">Notifications</h1>
        {notifications.some(n => !n.is_read) && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center space-x-1 text-xs font-bold text-brand-600 hover:text-brand-800"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center space-y-2 border border-slate-200">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">All Caught Up!</h3>
          <p className="text-xs text-slate-400">
            You'll receive notifications when friends join your trips or expenses are logged.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                notif.is_read
                  ? 'bg-white border-slate-200/80 text-slate-600'
                  : 'bg-emerald-50/50 border-emerald-200 shadow-2xs text-slate-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-xs leading-tight mb-0.5">{notif.title}</h4>
                  <p className="text-xs text-slate-600">{notif.message}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {notif.created_at?.split('T')[0]}
                  </span>
                </div>
                {!notif.is_read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-500 flex-shrink-0 mt-1" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
