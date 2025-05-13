import { useRef, useCallback, useEffect } from 'react';
import jwt_decode from 'jwt-decode'; // Note: You may need to install this dependency
import { authService } from '../services/api';

/**
 * Custom hook for managing token refresh
 * 
 * This hook:
 * 1. Sets up a timer to refresh the access token before it expires
 * 2. Maintains only one active timer at a time
 * 3. Cleans up properly on unmount
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.refreshMargin - Milliseconds before expiration to refresh (default: 5 minutes)
 * @returns {Object} - Token refresh utilities
 */
const useTokenRefresh = (options = {}) => {
  const { refreshMargin = 5 * 60 * 1000 } = options; // 5 minutes before expiration
  const refreshTimeoutRef = useRef(null);
  
  // Helper to get access token expiration time from cookie
  const getTokenExpirationTime = useCallback(() => {
    // This only works if we can use document.cookie (for development purposes)
    // In a production environment, we would rely on the server sending expiration info
    // or just use a conservative estimate
    
    try {
      const cookies = document.cookie.split(';');
      const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('accessToken='));
      
      if (tokenCookie) {
        // For security, we don't actually read the cookie value
        // Use a standard token lifetime of 1 hour (matching the server setting)
        return Date.now() + (60 * 60 * 1000);
      }
    } catch (error) {
      console.error('Error checking for token cookie', error);
    }
    
    return null;
  }, []);
  
  // Setup refresh timer
  const setupRefreshTimer = useCallback(async () => {
    // Clear any existing timer
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    // Get token expiration time
    const tokenExpiration = getTokenExpirationTime();
    
    if (!tokenExpiration) {
      // No token or can't determine expiration
      return;
    }
    
    const currentTime = Date.now();
    
    // Calculate time until refresh (5 minutes before expiration by default)
    const timeUntilRefresh = Math.max(0, tokenExpiration - currentTime - refreshMargin);
    
    console.log(`Token refresh scheduled in ${timeUntilRefresh / 1000} seconds`);
    
    // Set up refresh timer
    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('Refreshing access token...');
        await authService.refreshToken();
        console.log('Token refreshed successfully');
        
        // Set up the next refresh
        setupRefreshTimer();
      } catch (error) {
        console.error('Failed to refresh token', error);
        // Handle refresh failure - could dispatch an event or redirect to login
        window.dispatchEvent(new CustomEvent('auth:sessionExpired'));
      }
    }, timeUntilRefresh);
  }, [getTokenExpirationTime, refreshMargin]);
  
  // Force an immediate token refresh
  const refreshNow = useCallback(async () => {
    try {
      await authService.refreshToken();
      console.log('Token refreshed successfully');
      setupRefreshTimer();
      return true;
    } catch (error) {
      console.error('Failed to refresh token', error);
      return false;
    }
  }, [setupRefreshTimer]);
  
  // Setup on mount and cleanup on unmount
  useEffect(() => {
    setupRefreshTimer();
    
    // Set up listener for authentication events
    const handleAuthEvent = (event) => {
      if (event.type === 'auth:loggedIn') {
        setupRefreshTimer();
      } else if (event.type === 'auth:loggedOut' || event.type === 'auth:sessionExpired') {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
          refreshTimeoutRef.current = null;
        }
      }
    };
    
    // Listen for authentication events
    window.addEventListener('auth:loggedIn', handleAuthEvent);
    window.addEventListener('auth:loggedOut', handleAuthEvent);
    window.addEventListener('auth:sessionExpired', handleAuthEvent);
    
    // Cleanup
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      window.removeEventListener('auth:loggedIn', handleAuthEvent);
      window.removeEventListener('auth:loggedOut', handleAuthEvent);
      window.removeEventListener('auth:sessionExpired', handleAuthEvent);
    };
  }, [setupRefreshTimer]);
  
  return {
    setupRefreshTimer,
    refreshNow
  };
};

export default useTokenRefresh;