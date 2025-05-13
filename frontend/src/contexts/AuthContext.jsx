import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import useTokenRefresh from '../hooks/useTokenRefresh';

// Create Authentication Context
const AuthContext = createContext(null);

/**
 * Provider component for authentication state and methods
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Setup token refresh mechanism
  const { refreshNow } = useTokenRefresh();
  
  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to get current user info
        const response = await authService.getUser();
        setUser(response.data);
      } catch (error) {
        // If getUser fails but we have cookies, try refreshing token
        try {
          if (document.cookie.includes('accessToken') || document.cookie.includes('refreshToken')) {
            const refreshed = await refreshNow();
            if (refreshed) {
              // Try again after refresh
              const response = await authService.getUser();
              setUser(response.data);
            }
          }
        } catch (refreshError) {
          console.error('Auth initialization error:', refreshError);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();
  }, [refreshNow]);
  
  // Listen for auth events
  useEffect(() => {
    const handleLoginEvent = (event) => {
      setUser(event.detail);
    };
    
    const handleLogoutEvent = () => {
      setUser(null);
    };
    
    const handleSessionExpired = () => {
      setUser(null);
      navigate('/login', { state: { expired: true } });
    };
    
    // Register event listeners
    window.addEventListener('auth:loggedIn', handleLoginEvent);
    window.addEventListener('auth:loggedOut', handleLogoutEvent);
    window.addEventListener('auth:sessionExpired', handleSessionExpired);
    
    // Cleanup
    return () => {
      window.removeEventListener('auth:loggedIn', handleLoginEvent);
      window.removeEventListener('auth:loggedOut', handleLogoutEvent);
      window.removeEventListener('auth:sessionExpired', handleSessionExpired);
    };
  }, [navigate]);
  
  // Login function
  const login = async (username, password) => {
    try {
      const result = await authService.login(username, password);
      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed'
      };
    }
  };
  
  // Logout function
  const logout = async () => {
    try {
      await authService.logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  // Value object for context
  const value = {
    user,
    isAuthenticated: \!\!user,
    loading,
    login,
    logout
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook for using the auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (\!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
EOF < /dev/null
