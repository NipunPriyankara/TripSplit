import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Header } from './components/Header.js';
import { BottomNav, NavTab } from './components/BottomNav.js';
import { AuthPage } from './pages/AuthPage.js';
import { HomePage } from './pages/HomePage.js';
import { CreateTripPage } from './pages/CreateTripPage.js';
import { TripRoomPage } from './pages/TripRoomPage.js';
import { JoinTripPage } from './pages/JoinTripPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { AdminPage } from './pages/AdminPage.js';
import { api } from './api/client.js';

export const App: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const [activeNavTab, setActiveNavTab] = useState<NavTab>('home');
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [isCreatingTrip, setIsCreatingTrip] = useState<boolean>(false);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);

  // Dynamic base path support (e.g. /TripSplit or empty)
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

  // Check URL pathname for /join/:token or /trip/:id or /admin
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/join/')) {
      const parts = path.split('/join/');
      const token = parts[1]?.split('/')[0];
      if (token) setJoinToken(token);
    } else if (path.includes('/trip/')) {
      const parts = path.split('/trip/');
      const tripId = parts[1]?.split('/')[0];
      if (tripId) setCurrentTripId(tripId);
    } else if (path.includes('/admin')) {
      setIsAdminOpen(true);
    }
  }, []);

  // Update browser URL state gracefully
  const updateUrl = (newPath: string) => {
    const cleanSubPath = newPath.startsWith('/') ? newPath : `/${newPath}`;
    const fullPath = `${basePath}${cleanSubPath}`;
    window.history.pushState({}, '', fullPath);
  };

  // Poll notifications count periodically if online and authenticated
  useEffect(() => {
    if (!user || !navigator.onLine) return;
    const checkNotifs = async () => {
      try {
        const res = await api.getNotifications();
        const unread = res.notifications.filter(n => !n.is_read).length;
        setUnreadNotifsCount(unread);
      } catch (e) {
        // Ignore silent failure
      }
    };
    checkNotifs();
    const interval = setInterval(checkNotifs, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle invitation link view first
  if (joinToken) {
    return (
      <JoinTripPage
        token={joinToken}
        onJoinSubmitted={() => {
          setJoinToken(null);
          updateUrl('/');
        }}
        onGoHome={() => {
          setJoinToken(null);
          updateUrl('/');
        }}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-brand-500 text-white flex items-center justify-center font-black text-xl animate-pulse shadow-lg">
          TS
        </div>
        <p className="text-xs font-semibold text-slate-400">Loading TripSplit...</p>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <AuthPage />;
  }

  // Handle trip room navigation
  const handleSelectTrip = (tripId: string) => {
    setCurrentTripId(tripId);
    updateUrl(`/trip/${tripId}`);
  };

  const handleBackFromTrip = () => {
    setCurrentTripId(null);
    updateUrl('/');
  };

  // Handle Admin Portal View
  if (isAdminOpen && user?.is_admin) {
    return (
      <AdminPage
        onBack={() => {
          setIsAdminOpen(false);
          updateUrl('/');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col safe-top">
      {/* Top Header */}
      <Header
        title={currentTripId ? 'Trip Room' : 'TripSplit'}
        subtitle={currentTripId ? 'Private Room' : undefined}
        onBack={
          currentTripId
            ? handleBackFromTrip
            : isCreatingTrip
            ? () => setIsCreatingTrip(false)
            : undefined
        }
        unreadCount={unreadNotifsCount}
        onOpenNotifications={() => {
          setCurrentTripId(null);
          setIsCreatingTrip(false);
          setActiveNavTab('notifications');
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentTripId ? (
          <TripRoomPage tripId={currentTripId} onBack={handleBackFromTrip} />
        ) : isCreatingTrip ? (
          <CreateTripPage
            onBack={() => setIsCreatingTrip(false)}
            onTripCreated={tripId => {
              setIsCreatingTrip(false);
              handleSelectTrip(tripId);
            }}
          />
        ) : activeNavTab === 'home' || activeNavTab === 'trips' ? (
          <HomePage
            onSelectTrip={handleSelectTrip}
            onCreateTrip={() => setIsCreatingTrip(true)}
          />
        ) : activeNavTab === 'notifications' ? (
          <NotificationsPage
            onSelectTrip={tripId => {
              handleSelectTrip(tripId);
            }}
          />
        ) : (
          <ProfilePage
            onLogout={() => {
              logout();
              updateUrl('/');
            }}
            onOpenAdmin={() => {
              setIsAdminOpen(true);
              updateUrl('/admin');
            }}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      {!isCreatingTrip && (
        <BottomNav
          activeTab={activeNavTab}
          onTabChange={tab => {
            setCurrentTripId(null);
            setIsCreatingTrip(false);
            setActiveNavTab(tab);
            updateUrl('/');
          }}
          unreadCount={unreadNotifsCount}
        />
      )}
    </div>
  );
};
