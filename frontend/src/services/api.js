import axios from 'axios';
import * as storageService from './storageService';
import { 
  setupNetworkListeners, 
  checkOnlineStatus, 
  handleOfflineRequest, 
  processSyncQueue 
} from './syncService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // This is important for cookies to be sent/received
});

// Keep CSRF token
let csrfToken = null;

// Setup network status listeners
setupNetworkListeners(api);

// Add a request interceptor
api.interceptors.request.use(
  async (config) => {
    // We no longer need to add Authorization header, as we're using cookies
    // But we do need to add CSRF token for non-GET requests
    if (csrfToken && ['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase())) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    // Check if device is online
    if (!checkOnlineStatus()) {
      console.log(`Device is offline, request to ${config.url} will use offline strategy`);
      
      // For GET requests, try to fetch from IndexedDB
      if (config.method.toLowerCase() === 'get') {
        const offlineData = await handleOfflineGet(config);
        
        // This will throw an error that axios will catch and resolve as a response
        // with the offline data
        throw {
          response: {
            status: 200,
            data: offlineData,
            headers: {},
            config,
            offline: true
          }
        };
      } else {
        // For write operations, queue for later sync
        const offlineResult = await handleOfflineRequest(config);
        
        // Similarly, throw with a successful response to handle offline writes
        throw {
          response: {
            status: 202, // Accepted
            data: offlineResult,
            headers: {},
            config,
            offline: true
          }
        };
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
api.interceptors.response.use(
  async (response) => {
    // Handle successful responses
    if (response.offline) {
      // Mark this as offline data
      return { ...response, offline: true };
    }
    
    // If we just came online and this is a successful response,
    // try to process the sync queue
    if (checkOnlineStatus() && !response.config._isRetry) {
      try {
        const syncResult = await processSyncQueue(api);
        if (syncResult.processed > 0) {
          console.log(`Synced ${syncResult.successful}/${syncResult.processed} items`);
        }
      } catch (error) {
        console.error('Error processing sync queue:', error);
      }
    }
    
    return response;
  },
  async (error) => {
    // If this error has a 'response' with offline=true, it's our offline handling
    if (error.response && error.response.offline) {
      return Promise.resolve(error.response);
    }
    
    const originalRequest = error.config;
    
    // If the error is due to an expired token (401) and we haven't already tried to refresh
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        await refreshAuthToken();
        
        // Retry the original request with the new token
        return api(originalRequest);
      } catch (refreshError) {
        // If refreshing fails, redirect to login
        console.error('Error refreshing token:', refreshError);
        // We already dispatch the event in refreshAuthToken, no need to do it again here
        return Promise.reject(refreshError);
      }
    }
    
    // Otherwise it's a real error
    return Promise.reject(error);
  }
);

// Handle GET requests when offline
const handleOfflineGet = async (config) => {
  const url = config.url;
  const params = config.params || {};
  
  // Parse the URL to determine which store to query
  if (url.includes('/customers')) {
    if (url.match(/\/customers\/\d+$/)) {
      // Single customer request
      const customerId = url.split('/').pop();
      return await storageService.getCustomerById(parseInt(customerId));
    } else {
      // All customers request
      return await storageService.getCustomers();
    }
  } 
  else if (url.includes('/notes')) {
    if (url.match(/\/notes\/\d+$/)) {
      // Single note request
      const noteId = url.split('/').pop();
      return await storageService.getNoteById(parseInt(noteId));
    } else if (params.customerId) {
      // Notes by customer ID
      return await storageService.getNotesByCustomerId(parseInt(params.customerId));
    } else {
      // All notes
      return await storageService.getNotes();
    }
  }
  else if (url.includes('/journal')) {
    if (url.match(/\/journal\/\d+$/)) {
      // Single journal entry request
      const journalId = url.split('/').pop();
      return await storageService.getJournalEntryById(parseInt(journalId));
    } else if (params.customerId) {
      // Journal entries by customer ID
      return await storageService.getJournalEntriesByCustomerId(parseInt(params.customerId));
    } else {
      // All journal entries
      return await storageService.getJournalEntries();
    }
  }
  else if (url.includes('/orders')) {
    if (url.match(/\/orders\/\d+$/)) {
      // Single order request
      const orderId = url.split('/').pop();
      return await storageService.getOrderById(parseInt(orderId));
    } else if (params.customerId) {
      // Orders by customer ID
      return await storageService.getOrdersByCustomerId(parseInt(params.customerId));
    } else if (params.status) {
      // Orders by status
      return await storageService.getOrdersByStatus(params.status);
    } else {
      // All orders
      return await storageService.getOrders();
    }
  }
  else if (url.includes('/route')) {
    // Get today's route or specific date
    const date = params.date || new Date().toISOString().split('T')[0];
    return await storageService.getRouteForDate(date);
  }
  
  // If we don't have offline support for this endpoint, return empty data
  return { message: 'No offline data available for this endpoint' };
};

// Get CSRF token for form submissions
const getCsrfToken = async () => {
  try {
    const response = await api.get('/csrf-token');
    if (response.data && response.data.csrfToken) {
      csrfToken = response.data.csrfToken;
      return csrfToken;
    }
    return null;
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    return null;
  }
};

// Automatic token refresh logic
let refreshPromise = null;
let isRefreshing = false;

// Function to refresh the token
const refreshAuthToken = async () => {
  // If we're already refreshing, return the existing promise
  if (isRefreshing) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  refreshPromise = api.post('/auth/refresh')
    .then(response => {
      isRefreshing = false;
      
      // Dispatch an event to inform the app that tokens were refreshed
      window.dispatchEvent(new CustomEvent('auth:tokenRefreshed'));
      
      return response.data;
    })
    .catch(error => {
      isRefreshing = false;
      
      // If refresh fails, dispatch an event so the app can handle it
      window.dispatchEvent(new CustomEvent('auth:sessionExpired'));
      
      throw error;
    });
  
  return refreshPromise;
};

// Authentication service
const authService = {
  login: async (email, password) => {
    // Get CSRF token first if we don't have one
    if (!csrfToken) {
      await getCsrfToken();
    }
    
    const response = await api.post('/auth/login', { email, password });
    
    // If user just logged in and we're online, sync any pending changes
    if (checkOnlineStatus()) {
      await processSyncQueue(api);
    }
    
    // Dispatch auth event
    window.dispatchEvent(new CustomEvent('auth:loggedIn', { detail: response.data.user }));
    
    return response.data;
  },
  
  logout: async () => {
    // Get CSRF token first if we don't have one
    if (!csrfToken) {
      await getCsrfToken();
    }
    
    const response = await api.post('/auth/logout');
    
    // Clear IndexedDB data on logout for security
    await storageService.clearAllData();
    
    // Dispatch auth event
    window.dispatchEvent(new CustomEvent('auth:loggedOut'));
    
    return response.data;
  },
  
  refreshToken: async () => {
    const result = await refreshAuthToken();
    return result;
  },
  
  getUser: async () => {
    return api.get('/auth/me');
  }
};

// Customer service
const customerService = {
  getCustomers: async () => {
    const response = await api.get('/customers');
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      // Store each customer
      for (const customer of response.data) {
        await storageService.updateCustomer(customer);
      }
    }
    
    return response.data;
  },
  
  getCustomer: async (id) => {
    const response = await api.get(`/customers/${id}`);
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.updateCustomer(response.data);
    }
    
    return response.data;
  },
  
  createCustomer: async (customer) => {
    const response = await api.post('/customers', customer);
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.updateCustomer(response.data);
    }
    
    return response.data;
  },
  
  updateCustomer: async (id, customer) => {
    const response = await api.put(`/customers/${id}`, customer);
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.updateCustomer(response.data);
    }
    
    return response.data;
  },
  
  deleteCustomer: async (id) => {
    const response = await api.delete(`/customers/${id}`);
    
    // If this was an online request, remove from offline storage
    if (!response.offline) {
      await storageService.deleteCustomer(id);
    }
    
    return response.data;
  }
};

// Notes service
const notesService = {
  getNotes: async () => {
    const response = await api.get('/notes');
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      // Store each note
      for (const note of response.data) {
        await storageService.updateNote(note);
      }
    }
    
    return response.data;
  },
  
  getNotesByCustomer: async (customerId) => {
    const response = await api.get('/notes', { params: { customerId } });
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      // Store each note
      for (const note of response.data) {
        await storageService.updateNote(note);
      }
    }
    
    return response.data;
  },
  
  getNote: async (id) => {
    const response = await api.get(`/notes/${id}`);
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.updateNote(response.data);
    }
    
    return response.data;
  },
  
  createNote: async (note) => {
    const response = await api.post('/notes', note);
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.updateNote(response.data);
    }
    
    return response.data;
  },
  
  updateNote: async (id, note) => {
    const response = await api.put(`/notes/${id}`, note);
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.updateNote(response.data);
    }
    
    return response.data;
  },
  
  deleteNote: async (id) => {
    const response = await api.delete(`/notes/${id}`);
    
    // If this was an online request, remove from offline storage
    if (!response.offline) {
      await storageService.deleteNote(id);
    }
    
    return response.data;
  }
};

// Journal service
const journalService = {
  getJournalEntries: async () => {
    const response = await api.get('/journal');
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      // Store each journal entry
      for (const entry of response.data) {
        await storageService.updateJournalEntry(entry);
      }
    }
    
    return response.data;
  },
  
  getJournalEntriesByCustomer: async (customerId) => {
    const response = await api.get('/journal', { params: { customerId } });
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      // Store each journal entry
      for (const entry of response.data) {
        await storageService.updateJournalEntry(entry);
      }
    }
    
    return response.data;
  },
  
  getJournalEntry: async (id) => {
    const response = await api.get(`/journal/${id}`);
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.updateJournalEntry(response.data);
    }
    
    return response.data;
  },
  
  createJournalEntry: async (entry) => {
    const response = await api.post('/journal', entry);
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.updateJournalEntry(response.data);
    }
    
    return response.data;
  },
  
  updateJournalEntry: async (id, entry) => {
    const response = await api.put(`/journal/${id}`, entry);
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.updateJournalEntry(response.data);
    }
    
    return response.data;
  },
  
  deleteJournalEntry: async (id) => {
    const response = await api.delete(`/journal/${id}`);
    
    // If this was an online request, remove from offline storage
    if (!response.offline) {
      await storageService.deleteJournalEntry(id);
    }
    
    return response.data;
  }
};

// Order service
const orderService = {
  getOrders: async () => {
    const response = await api.get('/orders');
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      // Store each order
      for (const order of response.data) {
        await storageService.updateOrder(order);
      }
    }
    
    return response.data;
  },
  
  getOrdersByCustomer: async (customerId) => {
    const response = await api.get('/orders', { params: { customerId } });
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      // Store each order
      for (const order of response.data) {
        await storageService.updateOrder(order);
      }
    }
    
    return response.data;
  },
  
  getOrdersByStatus: async (status) => {
    const response = await api.get('/orders', { params: { status } });
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      // Store each order
      for (const order of response.data) {
        await storageService.updateOrder(order);
      }
    }
    
    return response.data;
  },
  
  getOrder: async (id) => {
    const response = await api.get(`/orders/${id}`);
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.updateOrder(response.data);
    }
    
    return response.data;
  },
  
  createOrder: async (order) => {
    const response = await api.post('/orders', order);
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.updateOrder(response.data);
    }
    
    return response.data;
  },
  
  updateOrder: async (id, order) => {
    const response = await api.put(`/orders/${id}`, order);
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.updateOrder(response.data);
    }
    
    return response.data;
  },
  
  deleteOrder: async (id) => {
    const response = await api.delete(`/orders/${id}`);
    
    // If this was an online request, remove from offline storage
    if (!response.offline) {
      await storageService.deleteOrder(id);
    }
    
    return response.data;
  }
};

// Route service
const routeService = {
  getRouteForDate: async (date = new Date().toISOString().split('T')[0]) => {
    const response = await api.get('/route', { params: { date } });
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.saveRouteForDate(date, response.data);
    }
    
    return response.data;
  },
  
  updateRoute: async (date, routeData) => {
    const response = await api.put('/route', routeData, { params: { date } });
    
    // If this was an online request, store the data for offline use
    if (!response.offline && response.data) {
      await storageService.saveRouteForDate(date, response.data);
    }
    
    return response.data;
  },
  
  completeStop: async (stopId, completionData) => {
    const response = await api.post(`/route/stops/${stopId}/complete`, completionData);
    
    // If this was an online request, we need to update the route data
    if (!response.offline && response.data) {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch the updated route data
      const routeResponse = await api.get('/route', { params: { date: today } });
      if (routeResponse.data) {
        await storageService.saveRouteForDate(today, routeResponse.data);
      }
    }
    
    return response.data;
  }
};

export {
  api,
  authService,
  customerService,
  notesService,
  journalService,
  orderService,
  routeService
};