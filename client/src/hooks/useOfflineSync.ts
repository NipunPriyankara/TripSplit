import { useState, useEffect, useCallback } from 'react';
import { localDb } from '../db/db.js';
import { api } from '../api/client.js';
import { SyncQueueItem } from '../types/index.js';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await localDb.syncQueue.count();
      setPendingCount(count);
    } catch (e) {
      console.error('Failed to get sync queue count', e);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    try {
      setIsSyncing(true);
      const items = await localDb.syncQueue.toArray();
      if (items.length === 0) {
        setIsSyncing(false);
        setPendingCount(0);
        return;
      }

      const res = await api.syncBatch(items);
      if (res.processedIds && res.processedIds.length > 0) {
        await localDb.syncQueue.bulkDelete(res.processedIds);
      }
      setLastSyncTime(new Date());
      await refreshPendingCount();
    } catch (err) {
      console.warn('Sync failed, will retry later:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshPendingCount();

    // Auto-sync polling every 30 seconds if online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncNow();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [syncNow, refreshPendingCount]);

  const queueMutation = async (
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entity: 'expense' | 'trip' | 'settlement',
    entityId: string,
    payload: any
  ) => {
    const item: SyncQueueItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      action,
      entity,
      entityId,
      payload,
      timestamp: new Date().toISOString(),
    };

    await localDb.syncQueue.put(item);
    await refreshPendingCount();

    // If online, immediately attempt sync in the background
    if (navigator.onLine) {
      syncNow();
    }
  };

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    syncNow,
    queueMutation,
    refreshPendingCount,
  };
}
