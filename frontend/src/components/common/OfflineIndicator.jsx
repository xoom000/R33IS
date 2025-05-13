import React, { useState, useEffect } from 'react';
import { FaWifi, FaExclamationTriangle } from 'react-icons/fa';

/**
 * Component that displays an indicator when the user is offline
 * and provides an update notification when a new service worker is available
 */
const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [waitingServiceWorker, setWaitingServiceWorker] = useState(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
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

  // Handle service worker updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Listen for service worker updates
      navigator.serviceWorker.ready.then(registration => {
        // When a new service worker is waiting
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            // When a new service worker is installed and waiting
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingServiceWorker(newWorker);
              setShowUpdateNotification(true);
            }
          });
        });
      });
    }
  }, []);

  // Function to update the service worker
  const updateServiceWorker = () => {
    if (waitingServiceWorker) {
      // Send a message to the service worker to skip waiting
      waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // Reset state
      setShowUpdateNotification(false);
      setWaitingServiceWorker(null);
      
      // Reload the page to ensure the new service worker is used
      window.location.reload();
    }
  };

  if (isOnline && !showUpdateNotification) {
    // Don't render anything when online and no update is available
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center justify-between">
          <div className="flex items-center">
            <FaWifi className="mr-2" />
            <span>You are currently offline. Some features may be limited.</span>
          </div>
        </div>
      )}

      {showUpdateNotification && (
        <div className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center justify-between">
          <div className="flex items-center">
            <FaExclamationTriangle className="mr-2" />
            <span>A new version is available!</span>
          </div>
          <button
            onClick={updateServiceWorker}
            className="ml-4 bg-white text-blue-600 px-3 py-1 rounded-md text-sm font-medium"
          >
            Update Now
          </button>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;