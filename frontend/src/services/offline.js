/**
 * Offline Service - IndexedDB for caching and action queue
 */

const DB_NAME = 'DeliveryAppOffline';
const DB_VERSION = 2;

const STORES = {
  TASKS: 'tasks',
  PICKUPS: 'pickups',
  CALENDAR_EVENTS: 'calendarEvents',
  PENDING_ACTIONS: 'pendingActions',
  META: 'meta',
};

class OfflineService {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Tasks store
        if (!db.objectStoreNames.contains(STORES.TASKS)) {
          db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
        }

        // Pickups store
        if (!db.objectStoreNames.contains(STORES.PICKUPS)) {
          db.createObjectStore(STORES.PICKUPS, { keyPath: 'id' });
        }

        // Calendar events store
        if (!db.objectStoreNames.contains(STORES.CALENDAR_EVENTS)) {
          db.createObjectStore(STORES.CALENDAR_EVENTS, { keyPath: 'id' });
        }

        // Pending actions store (auto-increment ID)
        if (!db.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
          const actionStore = db.createObjectStore(STORES.PENDING_ACTIONS, {
            keyPath: 'id',
            autoIncrement: true,
          });
          actionStore.createIndex('timestamp', 'timestamp');
        }

        // Metadata store (last sync times, etc.)
        if (!db.objectStoreNames.contains(STORES.META)) {
          db.createObjectStore(STORES.META, { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  // ========== TASKS ==========

  async cacheTasks(tasks) {
    await this.init();
    const tx = this.db.transaction(STORES.TASKS, 'readwrite');
    const store = tx.objectStore(STORES.TASKS);

    // Clear existing and add new
    await this._promisify(store.clear());
    for (const task of tasks) {
      await this._promisify(store.add(task));
    }

    // Update last sync time
    await this.setMeta('tasksLastSync', Date.now());
  }

  async getCachedTasks() {
    await this.init();
    const tx = this.db.transaction(STORES.TASKS, 'readonly');
    const store = tx.objectStore(STORES.TASKS);
    return this._promisify(store.getAll());
  }

  async getCachedTask(id) {
    await this.init();
    const tx = this.db.transaction(STORES.TASKS, 'readonly');
    const store = tx.objectStore(STORES.TASKS);
    return this._promisify(store.get(id));
  }

  async updateCachedTask(id, updates) {
    await this.init();
    const tx = this.db.transaction(STORES.TASKS, 'readwrite');
    const store = tx.objectStore(STORES.TASKS);

    const existing = await this._promisify(store.get(id));
    if (existing) {
      const updated = { ...existing, ...updates };
      await this._promisify(store.put(updated));
      return updated;
    }
    return null;
  }

  // ========== PICKUPS ==========

  async cachePickups(pickups) {
    await this.init();
    const tx = this.db.transaction(STORES.PICKUPS, 'readwrite');
    const store = tx.objectStore(STORES.PICKUPS);

    await this._promisify(store.clear());
    for (const pickup of pickups) {
      await this._promisify(store.add(pickup));
    }

    await this.setMeta('pickupsLastSync', Date.now());
  }

  async getCachedPickups() {
    await this.init();
    const tx = this.db.transaction(STORES.PICKUPS, 'readonly');
    const store = tx.objectStore(STORES.PICKUPS);
    return this._promisify(store.getAll());
  }

  async getCachedPickup(id) {
    await this.init();
    const tx = this.db.transaction(STORES.PICKUPS, 'readonly');
    const store = tx.objectStore(STORES.PICKUPS);
    return this._promisify(store.get(id));
  }

  async updateCachedPickup(id, updates) {
    await this.init();
    const tx = this.db.transaction(STORES.PICKUPS, 'readwrite');
    const store = tx.objectStore(STORES.PICKUPS);

    const existing = await this._promisify(store.get(id));
    if (existing) {
      const updated = { ...existing, ...updates };
      await this._promisify(store.put(updated));
      return updated;
    }
    return null;
  }

  // ========== CALENDAR EVENTS ==========

  async cacheCalendarEvents(events) {
    await this.init();
    const tx = this.db.transaction(STORES.CALENDAR_EVENTS, 'readwrite');
    const store = tx.objectStore(STORES.CALENDAR_EVENTS);

    await this._promisify(store.clear());
    for (const event of events) {
      await this._promisify(store.add(event));
    }

    await this.setMeta('calendarEventsLastSync', Date.now());
  }

  async getCachedCalendarEvents() {
    await this.init();
    const tx = this.db.transaction(STORES.CALENDAR_EVENTS, 'readonly');
    const store = tx.objectStore(STORES.CALENDAR_EVENTS);
    return this._promisify(store.getAll());
  }

  async updateCachedCalendarEvent(id, updates) {
    await this.init();
    const tx = this.db.transaction(STORES.CALENDAR_EVENTS, 'readwrite');
    const store = tx.objectStore(STORES.CALENDAR_EVENTS);

    const existing = await this._promisify(store.get(id));
    if (existing) {
      const updated = { ...existing, ...updates };
      await this._promisify(store.put(updated));
      return updated;
    }
    return null;
  }

  async removeCachedCalendarEvent(id) {
    await this.init();
    const tx = this.db.transaction(STORES.CALENDAR_EVENTS, 'readwrite');
    const store = tx.objectStore(STORES.CALENDAR_EVENTS);
    return this._promisify(store.delete(id));
  }

  async addCachedCalendarEvent(event) {
    await this.init();
    const tx = this.db.transaction(STORES.CALENDAR_EVENTS, 'readwrite');
    const store = tx.objectStore(STORES.CALENDAR_EVENTS);
    return this._promisify(store.put(event));
  }

  // ========== PENDING ACTIONS ==========

  async queueAction(action) {
    await this.init();
    const tx = this.db.transaction(STORES.PENDING_ACTIONS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_ACTIONS);

    const actionWithMeta = {
      ...action,
      timestamp: Date.now(),
      retryCount: 0,
    };

    return this._promisify(store.add(actionWithMeta));
  }

  async getPendingActions() {
    await this.init();
    const tx = this.db.transaction(STORES.PENDING_ACTIONS, 'readonly');
    const store = tx.objectStore(STORES.PENDING_ACTIONS);
    return this._promisify(store.getAll());
  }

  async getPendingActionCount() {
    await this.init();
    const tx = this.db.transaction(STORES.PENDING_ACTIONS, 'readonly');
    const store = tx.objectStore(STORES.PENDING_ACTIONS);
    return this._promisify(store.count());
  }

  async clearPendingAction(id) {
    await this.init();
    const tx = this.db.transaction(STORES.PENDING_ACTIONS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_ACTIONS);
    return this._promisify(store.delete(id));
  }

  async updatePendingAction(id, updates) {
    await this.init();
    const tx = this.db.transaction(STORES.PENDING_ACTIONS, 'readwrite');
    const store = tx.objectStore(STORES.PENDING_ACTIONS);

    const existing = await this._promisify(store.get(id));
    if (existing) {
      const updated = { ...existing, ...updates };
      await this._promisify(store.put(updated));
      return updated;
    }
    return null;
  }

  // ========== METADATA ==========

  async setMeta(key, value) {
    await this.init();
    const tx = this.db.transaction(STORES.META, 'readwrite');
    const store = tx.objectStore(STORES.META);
    return this._promisify(store.put({ key, value }));
  }

  async getMeta(key) {
    await this.init();
    const tx = this.db.transaction(STORES.META, 'readonly');
    const store = tx.objectStore(STORES.META);
    const result = await this._promisify(store.get(key));
    return result?.value;
  }

  // ========== UTILITIES ==========

  _promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll() {
    await this.init();
    const tx = this.db.transaction(
      [STORES.TASKS, STORES.PICKUPS, STORES.CALENDAR_EVENTS, STORES.PENDING_ACTIONS, STORES.META],
      'readwrite'
    );

    await Promise.all([
      this._promisify(tx.objectStore(STORES.TASKS).clear()),
      this._promisify(tx.objectStore(STORES.PICKUPS).clear()),
      this._promisify(tx.objectStore(STORES.CALENDAR_EVENTS).clear()),
      this._promisify(tx.objectStore(STORES.PENDING_ACTIONS).clear()),
      this._promisify(tx.objectStore(STORES.META).clear()),
    ]);
  }
}

export const offlineService = new OfflineService();
