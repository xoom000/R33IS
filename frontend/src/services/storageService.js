import { openDB } from 'idb';

// Constants
const DB_NAME = 'r33is-db';
const DB_VERSION = 1;
const STORES = {
  CUSTOMERS: 'customers',
  NOTES: 'notes',
  JOURNAL: 'journal',
  ORDERS: 'orders',
  ROUTE: 'route',
  GEOCODING: 'geocoding'
};

// Initialize the database
const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        const customerStore = db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
        customerStore.createIndex('name', 'name');
        customerStore.createIndex('address', 'address');
      }

      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        const notesStore = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
        notesStore.createIndex('customerId', 'customerId');
        notesStore.createIndex('createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains(STORES.JOURNAL)) {
        const journalStore = db.createObjectStore(STORES.JOURNAL, { keyPath: 'id' });
        journalStore.createIndex('customerId', 'customerId');
        journalStore.createIndex('createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains(STORES.ORDERS)) {
        const ordersStore = db.createObjectStore(STORES.ORDERS, { keyPath: 'id' });
        ordersStore.createIndex('customerId', 'customerId');
        ordersStore.createIndex('status', 'status');
      }

      if (!db.objectStoreNames.contains(STORES.ROUTE)) {
        db.createObjectStore(STORES.ROUTE, { keyPath: 'date' });
      }

      if (!db.objectStoreNames.contains(STORES.GEOCODING)) {
        db.createObjectStore(STORES.GEOCODING, { keyPath: 'address' });
      }
    }
  });
};

// Get database instance (initialize if needed)
let dbPromise;
const getDB = async () => {
  if (!dbPromise) {
    dbPromise = initDB();
  }
  return dbPromise;
};

// Generic get all items from a store
const getAll = async (storeName) => {
  try {
    const db = await getDB();
    return db.getAll(storeName);
  } catch (error) {
    console.error(`Error getting all items from ${storeName}:`, error);
    throw error;
  }
};

// Generic get item by id
const getById = async (storeName, id) => {
  try {
    const db = await getDB();
    return db.get(storeName, id);
  } catch (error) {
    console.error(`Error getting item from ${storeName}:`, error);
    throw error;
  }
};

// Generic add item to store
const add = async (storeName, item) => {
  try {
    const db = await getDB();
    return db.add(storeName, item);
  } catch (error) {
    console.error(`Error adding item to ${storeName}:`, error);
    throw error;
  }
};

// Generic put (add or update) item in store
const put = async (storeName, item) => {
  try {
    const db = await getDB();
    return db.put(storeName, item);
  } catch (error) {
    console.error(`Error putting item in ${storeName}:`, error);
    throw error;
  }
};

// Generic delete item from store
const deleteItem = async (storeName, id) => {
  try {
    const db = await getDB();
    return db.delete(storeName, id);
  } catch (error) {
    console.error(`Error deleting item from ${storeName}:`, error);
    throw error;
  }
};

// Generic query items by index
const getByIndex = async (storeName, indexName, value) => {
  try {
    const db = await getDB();
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.store.index(indexName);
    return index.getAll(value);
  } catch (error) {
    console.error(`Error querying ${storeName} by ${indexName}:`, error);
    throw error;
  }
};

// Customer-specific methods
const getCustomers = () => getAll(STORES.CUSTOMERS);
const getCustomerById = (id) => getById(STORES.CUSTOMERS, id);
const addCustomer = (customer) => add(STORES.CUSTOMERS, customer);
const updateCustomer = (customer) => put(STORES.CUSTOMERS, customer);
const deleteCustomer = (id) => deleteItem(STORES.CUSTOMERS, id);

// Notes-specific methods
const getNotes = () => getAll(STORES.NOTES);
const getNoteById = (id) => getById(STORES.NOTES, id);
const getNotesByCustomerId = (customerId) => getByIndex(STORES.NOTES, 'customerId', customerId);
const addNote = (note) => add(STORES.NOTES, note);
const updateNote = (note) => put(STORES.NOTES, note);
const deleteNote = (id) => deleteItem(STORES.NOTES, id);

// Journal-specific methods
const getJournalEntries = () => getAll(STORES.JOURNAL);
const getJournalEntryById = (id) => getById(STORES.JOURNAL, id);
const getJournalEntriesByCustomerId = (customerId) => getByIndex(STORES.JOURNAL, 'customerId', customerId);
const addJournalEntry = (entry) => add(STORES.JOURNAL, entry);
const updateJournalEntry = (entry) => put(STORES.JOURNAL, entry);
const deleteJournalEntry = (id) => deleteItem(STORES.JOURNAL, id);

// Order-specific methods
const getOrders = () => getAll(STORES.ORDERS);
const getOrderById = (id) => getById(STORES.ORDERS, id);
const getOrdersByCustomerId = (customerId) => getByIndex(STORES.ORDERS, 'customerId', customerId);
const getOrdersByStatus = (status) => getByIndex(STORES.ORDERS, 'status', status);
const addOrder = (order) => add(STORES.ORDERS, order);
const updateOrder = (order) => put(STORES.ORDERS, order);
const deleteOrder = (id) => deleteItem(STORES.ORDERS, id);

// Route-specific methods
const getRouteForDate = (date) => getById(STORES.ROUTE, date);
const saveRouteForDate = (dateString, routeData) => put(STORES.ROUTE, { date: dateString, ...routeData });

// Geocoding cache methods
const getCachedGeocode = (address) => getById(STORES.GEOCODING, address);
const cacheGeocode = (address, coordinates) => put(STORES.GEOCODING, { address, coordinates, timestamp: Date.now() });

// Clear specific store
const clearStore = async (storeName) => {
  try {
    const db = await getDB();
    return db.clear(storeName);
  } catch (error) {
    console.error(`Error clearing store ${storeName}:`, error);
    throw error;
  }
};

// Clear all data (useful for logout)
const clearAllData = async () => {
  try {
    const db = await getDB();
    const storeNames = Object.values(STORES);
    const tx = db.transaction(storeNames, 'readwrite');
    
    await Promise.all(
      storeNames.map(storeName => tx.objectStore(storeName).clear())
    );
    
    await tx.done;
    return true;
  } catch (error) {
    console.error('Error clearing all data:', error);
    throw error;
  }
};

// Check if IndexedDB is supported
const isIndexedDBSupported = () => {
  return 'indexedDB' in window;
};

export {
  STORES,
  getCustomers,
  getCustomerById,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getNotes,
  getNoteById,
  getNotesByCustomerId,
  addNote,
  updateNote,
  deleteNote,
  getJournalEntries,
  getJournalEntryById,
  getJournalEntriesByCustomerId,
  addJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  getOrders,
  getOrderById,
  getOrdersByCustomerId,
  getOrdersByStatus,
  addOrder,
  updateOrder,
  deleteOrder,
  getRouteForDate,
  saveRouteForDate,
  getCachedGeocode,
  cacheGeocode,
  clearStore,
  clearAllData,
  isIndexedDBSupported
};