import React from 'react';
import { Home, Compass, Bell, User, PlusCircle } from 'lucide-react';

export type NavTab = 'home' | 'trips' | 'notifications' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadCount?: number;
  onAddExpense?: () => void;
  showAddExpense?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
  onAddExpense,
  showAddExpense = false,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 safe-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around relative">
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center py-1 px-3 text-xs font-medium transition-colors ${
            activeTab === 'home' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => onTabChange('trips')}
          className={`flex flex-col items-center py-1 px-3 text-xs font-medium transition-colors ${
            activeTab === 'trips' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span>Trips</span>
        </button>

        {/* Prominent floating Add Expense button if inside trip */}
        {showAddExpense && onAddExpense && (
          <div className="relative -top-5">
            <button
              onClick={onAddExpense}
              className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/30 active:scale-95 transition-all transform"
              aria-label="Add Expense"
            >
              <PlusCircle className="w-8 h-8" />
            </button>
          </div>
        )}

        <button
          onClick={() => onTabChange('notifications')}
          className={`relative flex flex-col items-center py-1 px-3 text-xs font-medium transition-colors ${
            activeTab === 'notifications' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Bell className="w-5 h-5 mb-0.5" />
          <span>Alerts</span>
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center py-1 px-3 text-xs font-medium transition-colors ${
            activeTab === 'profile' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <User className="w-5 h-5 mb-0.5" />
          <span>Profile</span>
        </button>
      </div>
    </nav>
  );
};
