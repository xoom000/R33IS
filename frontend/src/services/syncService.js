import { openDB } from 'idb';
import { clearAllData } from './storageService';

// Constants
const SYNC_DB_NAME = 'r33is-sync-db';
const SYNC_DB_VERSION = 1;
const SYNC_STORE = 'sync-queue';

// Network status tracking
let isOnline = navigator.onLine;

// Initialize the sync database
const initSyncDB = async () => {
  return openDB(SYNC_DB_NAME, SYNC_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        const store = db.createObjectStore(SYNC_STORE, { 
          keyPath: 'id',
          autoIncrement: true 
        });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('endpoint', 'endpoint');
      }
    }
  });
};

// Get database instance
let syncDbPromise;
const getSyncDB = async () => {
  if (!syncDbPromise) {
    syncDbPromise = initSyncDB();
  }
  return syncDbPromise;
};

// Add an operation to sync queue
const addToSyncQueue = async (operation) => {
  try {
    const db = await getSyncDB();
    const syncItem = {
      ...operation,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending'
    };
    
    await db.add(SYNC_STORE, syncItem);
    console.log('Added to sync queue:', syncItem);
    return true;
  } catch (error) {
    console.error('Error adding to sync queue:', error);
    return false;
  }
};

// Get all pending sync operations
const getPendingSyncOperations = async () => {
  try {
    const db = await getSyncDB();
    return db.getAllFromIndex(SYNC_STORE, 'syncStatus', 'pending');
  } catch (error) {
    console.error('Error getting pending sync operations:', error);
    return [];
  }
};

// Mark sync operation as completed
const markSyncOperationComplete = async (id) => {
  try {
    const db = await getSyncDB();
    const item = await db.get(SYNC_STORE, id);
    if (!item) return false;
    
    item.syncStatus = 'completed';
    item.syncedAt = new Date().toISOString();
    await db.put(SYNC_STORE, item);
    return true;
  } catch (error) {
    console.error('Error marking sync operation complete:', error);
    return false;
  }
};

// Mark sync operation as failed
const markSyncOperationFailed = async (id, error) => {
  try {
    const db = await getSyncDB();
    const item = await db.get(SYNC_STORE, id);
    if (!item) return false;
    
    item.syncStatus = 'failed';
    item.error = error;
    item.lastAttempt = new Date().toISOString();
    item.attempts = (item.attempts || 0) + 1;
    await db.put(SYNC_STORE, item);
    return true;
  } catch (error) {
    console.error('Error marking sync operation failed:', error);
    return false;
  }
};

// Delete a sync operation
const deleteSyncOperation = async (id) => {
  try {
    const db = await getSyncDB();
    await db.delete(SYNC_STORE, id);
    return true;
  } catch (error) {
    console.error('Error deleting sync operation:', error);
    return false;
  }
};

// Clear all sync operations
const clearSyncQueue = async () => {
  try {
    const db = await getSyncDB();
    await db.clear(SYNC_STORE);
    return true;
  } catch (error) {
    console.error('Error clearing sync queue:', error);
    return false;
  }
};

// Process sync queue
const processSyncQueue = async (apiInstance) => {
  if (!isOnline) {
    console.log('Cannot process sync queue: offline');
    return { success: false, message: 'Device is offline' };
  }

  console.log('Processing sync queue...');
  const pendingOperations = await getPendingSyncOperations();
  
  if (pendingOperations.length === 0) {
    console.log('No pending operations to sync');
    return { success: true, processed: 0 };
  }

  console.log(`Found ${pendingOperations.length} operations to sync`);
  let successCount = 0;
  let failureCount = 0;

  // Sort operations by timestamp to ensure proper order
  pendingOperations.sort((a, b) => 
    new Date(a.createdAt) - new Date(b.createdAt)
  );

  // Process each operation
  for (const operation of pendingOperations) {
    try {
      const { method, endpoint, data, id } = operation;
      
      // Execute the API call
      await apiInstance({
        method,
        url: endpoint,
        data: method !== 'GET' ? data : undefined,
        params: method === 'GET' ? data : undefined,
      });
      
      // Mark as completed
      await markSyncOperationComplete(id);
      successCount++;
    } catch (error) {
      console.error(`Error syncing operation ${operation.id}:`, error);
      
      // Mark as failed
      await markSyncOperationFailed(
        operation.id, 
        error.message || 'Unknown error during sync'
      );
      failureCount++;
    }
  }

  return {
    success: true,
    processed: pendingOperations.length,
    successful: successCount,
    failed: failureCount
  };
};

// Setup network listeners
const setupNetworkListeners = (apiInstance) => {
  // Listen for online status
  window.addEventListener('online', async () => {
    console.log('Connection restored - online');
    isOnline = true;
    
    // Attempt to process sync queue when coming back online
    try {
      const result = await processSyncQueue(apiInstance);
      console.log('Sync result:', result);
    } catch (error) {
      console.error('Error processing sync queue on reconnect:', error);
    }
  });

  // Listen for offline status
  window.addEventListener('offline', () => {
    console.log('Connection lost - offline');
    isOnline = false;
  });
};

// Check if device is online
const checkOnlineStatus = () => {
  return isOnline;
};

// Handle offline request
const handleOfflineRequest = async (request) => {
  const { method, url, data, params } = request;
  
  // Don't queue GET requests as they don't modify data
  if (method === 'GET') {
    throw new Error('Cannot fetch data while offline');
  }

  // Extract endpoint from url
  const endpoint = url;
  
  // Add request to sync queue
  await addToSyncQueue({
    method,
    endpoint,
    data: data || params,
  });

  return {
    offline: true,
    queued: true,
    message: 'Request queued for sync when online'
  };
};

// Reset all data (for logout)
const resetAll = async () => {
  try {
    await clearSyncQueue();
    await clearAllData();
    return true;
  } catch (error) {
    console.error('Error resetting all data:', error);
    return false;
  }
};

export {
  addToSyncQueue,
  processSyncQueue,
  getPendingSyncOperations,
  markSyncOperationComplete,
  markSyncOperationFailed,
  deleteSyncOperation,
  clearSyncQueue,
  setupNetworkListeners,
  checkOnlineStatus,
  handleOfflineRequest,
  resetAll
};