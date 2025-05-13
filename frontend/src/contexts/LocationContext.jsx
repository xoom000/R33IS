import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const LocationContext = createContext();

export const useLocation = () => useContext(LocationContext);

export const LocationProvider = ({ children }) => {
  const [currentPosition, setCurrentPosition] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  // Start watching position
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);
    
    // Clear any existing watch
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
    }
    
    // Options for geolocation watch
    const options = {
      enableHighAccuracy: true,  // Use GPS if available
      maximumAge: 30000,         // Accept positions up to 30 seconds old
      timeout: 27000             // Wait up to 27 seconds for a position
    };
    
    // Start position watch
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, heading, speed } = position.coords;
        const timestamp = position.timestamp;
        
        setCurrentPosition({
          latitude,
          longitude,
          accuracy,
          heading: heading || null,  // Heading can be null if not moving
          speed: speed || 0,         // Speed in meters per second
          timestamp
        });
        
        setError(null);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError(`Geolocation error: ${err.message}`);
      },
      options
    );
    
    setWatchId(id);
    
    return () => {
      if (id) {
        navigator.geolocation.clearWatch(id);
      }
    };
  }, [watchId]);
  
  // Stop watching position
  const stopTracking = useCallback(() => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  }, [watchId]);
  
  // Get a single position update (one-time)
  const getCurrentPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = new Error('Geolocation is not supported by your browser');
        setError(error.message);
        reject(error);
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const positionData = { latitude, longitude, accuracy };
          setCurrentPosition(positionData);
          resolve(positionData);
        },
        (err) => {
          console.error('Geolocation error:', err);
          setError(`Geolocation error: ${err.message}`);
          reject(err);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 15000
        }
      );
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const value = {
    currentPosition,
    error,
    isTracking,
    startTracking,
    stopTracking,
    getCurrentPosition
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export default LocationContext;