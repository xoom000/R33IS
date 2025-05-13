import { useState, useEffect } from 'react';
import { checkOnlineStatus } from '../services/syncService';

/**
 * Custom hook to manage offline status
 * @returns {Object} - Object containing offline status and related functions
 */
const useOfflineStatus = () => {
  const [isOffline, setIsOffline] = useState(!checkOnlineStatus());
  const [hasOfflineData, setHasOfflineData] = useState(false);
  const [offlineContentSource, setOfflineContentSource] = useState('none');

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    // Set up event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check and set offline data availability
    checkOfflineDataAvailability();

    // Clean up event listeners
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Function to check for offline data availability
  const checkOfflineDataAvailability = async () => {
    try {
      // Check if IndexedDB is supported
      if (!('indexedDB' in window)) {
        setHasOfflineData(false);
        return;
      }

      // Check if there's data in IndexedDB
      const dbRequest = indexedDB.open('r33is-db', 1);
      dbRequest.onsuccess = (event) => {
        const db = event.target.result;
        
        // Check if customers store exists and has data
        if (db.objectStoreNames.contains('customers')) {
          const tx = db.transaction('customers', 'readonly');
          const store = tx.objectStore('customers');
          const countRequest = store.count();
          
          countRequest.onsuccess = () => {
            setHasOfflineData(countRequest.result > 0);
            if (countRequest.result > 0) {
              setOfflineContentSource('indexedDB');
            }
          };
        } else {
          // Check if there's data in the cache API
          caches.has('r33is-api').then(hasCache => {
            if (hasCache) {
              setHasOfflineData(true);
              setOfflineContentSource('cache');
            } else {
              setHasOfflineData(false);
              setOfflineContentSource('none');
            }
          });
        }
      };

      dbRequest.onerror = () => {
        // Fall back to checking the cache
        caches.has('r33is-api').then(hasCache => {
          if (hasCache) {
            setHasOfflineData(true);
            setOfflineContentSource('cache');
          } else {
            setHasOfflineData(false);
            setOfflineContentSource('none');
          }
        });
      };
    } catch (error) {
      console.error('Error checking offline data availability:', error);
      setHasOfflineData(false);
      setOfflineContentSource('none');
    }
  };

  // Refresh the offline data status
  const refreshOfflineStatus = () => {
    setIsOffline(!checkOnlineStatus());
    checkOfflineDataAvailability();
  };

  return {
    isOffline,
    hasOfflineData,
    offlineContentSource,
    refreshOfflineStatus
  };
};

export default useOfflineStatus;