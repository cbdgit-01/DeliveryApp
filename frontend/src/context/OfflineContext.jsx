import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { offlineService } from '../services/offline';
import { tasksAPI, pickupsAPI } from '../services/api';

const OfflineContext = createContext();

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState(null);

  // Initialize IndexedDB and load pending count
  useEffect(() => {
    const initOffline = async () => {
      try {
        await offlineService.init();
        const count = await offlineService.getPendingActionCount();
        setPendingCount(count);
      } catch (error) {
        console.error('Failed to initialize offline service:', error);
      }
    };

    initOffline();
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      syncPendingActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync pending actions to server
  const syncPendingActions = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    setIsSyncing(true);
    setLastSyncError(null);

    try {
      const actions = await offlineService.getPendingActions();

      for (const action of actions) {
        try {
          await executeAction(action);
          await offlineService.clearPendingAction(action.id);
        } catch (error) {
          console.error('Failed to sync action:', error);

          // Increment retry count
          const retryCount = (action.retryCount || 0) + 1;

          if (retryCount >= 3) {
            // Max retries reached, mark as failed
            setLastSyncError(`Failed to sync: ${action.type}`);
            await offlineService.clearPendingAction(action.id);
          } else {
            await offlineService.updatePendingAction(action.id, { retryCount });
          }
        }
      }

      // Update pending count
      const count = await offlineService.getPendingActionCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Sync failed:', error);
      setLastSyncError('Sync failed. Will retry automatically.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Execute a queued action
  const executeAction = async (action) => {
    switch (action.type) {
      case 'UPDATE_TASK':
        await tasksAPI.update(action.taskId, action.data);
        break;

      case 'UPDATE_PICKUP':
        await pickupsAPI.update(action.pickupId, action.data);
        break;

      case 'COMPLETE_PICKUP':
        await pickupsAPI.complete(action.pickupId);
        break;

      default:
        console.warn('Unknown action type:', action.type);
    }
  };

  // Queue an action for later sync
  const queueAction = useCallback(async (action) => {
    await offlineService.queueAction(action);
    const count = await offlineService.getPendingActionCount();
    setPendingCount(count);
  }, []);

  // Cache tasks from API response
  const cacheTasks = useCallback(async (tasks) => {
    try {
      await offlineService.cacheTasks(tasks);
    } catch (error) {
      console.error('Failed to cache tasks:', error);
    }
  }, []);

  // Get cached tasks
  const getCachedTasks = useCallback(async () => {
    try {
      return await offlineService.getCachedTasks();
    } catch (error) {
      console.error('Failed to get cached tasks:', error);
      return [];
    }
  }, []);

  // Get a single cached task by ID
  const getCachedTask = useCallback(async (id) => {
    try {
      return await offlineService.getCachedTask(parseInt(id));
    } catch (error) {
      console.error('Failed to get cached task:', error);
      return null;
    }
  }, []);

  // Update a cached task locally
  const updateCachedTask = useCallback(async (id, updates) => {
    try {
      return await offlineService.updateCachedTask(id, updates);
    } catch (error) {
      console.error('Failed to update cached task:', error);
      return null;
    }
  }, []);

  // Cache pickups from API response
  const cachePickups = useCallback(async (pickups) => {
    try {
      await offlineService.cachePickups(pickups);
    } catch (error) {
      console.error('Failed to cache pickups:', error);
    }
  }, []);

  // Get cached pickups
  const getCachedPickups = useCallback(async () => {
    try {
      return await offlineService.getCachedPickups();
    } catch (error) {
      console.error('Failed to get cached pickups:', error);
      return [];
    }
  }, []);

  // Get a single cached pickup by ID
  const getCachedPickup = useCallback(async (id) => {
    try {
      return await offlineService.getCachedPickup(parseInt(id));
    } catch (error) {
      console.error('Failed to get cached pickup:', error);
      return null;
    }
  }, []);

  // Update a cached pickup locally
  const updateCachedPickup = useCallback(async (id, updates) => {
    try {
      return await offlineService.updateCachedPickup(id, updates);
    } catch (error) {
      console.error('Failed to update cached pickup:', error);
      return null;
    }
  }, []);

  // Cache calendar events from API response
  const cacheCalendarEvents = useCallback(async (events) => {
    try {
      await offlineService.cacheCalendarEvents(events);
    } catch (error) {
      console.error('Failed to cache calendar events:', error);
    }
  }, []);

  // Get cached calendar events
  const getCachedCalendarEvents = useCallback(async () => {
    try {
      return await offlineService.getCachedCalendarEvents();
    } catch (error) {
      console.error('Failed to get cached calendar events:', error);
      return [];
    }
  }, []);

  // Update a cached calendar event locally
  const updateCachedCalendarEvent = useCallback(async (id, updates) => {
    try {
      return await offlineService.updateCachedCalendarEvent(id, updates);
    } catch (error) {
      console.error('Failed to update cached calendar event:', error);
      return null;
    }
  }, []);

  // Add a cached calendar event
  const addCachedCalendarEvent = useCallback(async (event) => {
    try {
      return await offlineService.addCachedCalendarEvent(event);
    } catch (error) {
      console.error('Failed to add cached calendar event:', error);
      return null;
    }
  }, []);

  // Remove a cached calendar event
  const removeCachedCalendarEvent = useCallback(async (id) => {
    try {
      return await offlineService.removeCachedCalendarEvent(id);
    } catch (error) {
      console.error('Failed to remove cached calendar event:', error);
      return null;
    }
  }, []);

  const value = {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncError,
    syncPendingActions,
    queueAction,
    cacheTasks,
    getCachedTasks,
    getCachedTask,
    updateCachedTask,
    cachePickups,
    getCachedPickups,
    getCachedPickup,
    updateCachedPickup,
    cacheCalendarEvents,
    getCachedCalendarEvents,
    updateCachedCalendarEvent,
    addCachedCalendarEvent,
    removeCachedCalendarEvent,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};
