import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RouteManagement from './pages/RouteManagement';
import PrivateRoute from './components/common/PrivateRoute';
import OfflineIndicator from './components/common/OfflineIndicator';

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LocationProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Protected routes */}
            <Route element={<PrivateRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/route" element={<RouteManagement />} />
              {/* Add more protected routes here */}
            </Route>
            
            {/* Redirect from root to dashboard or login */}
            <Route path="/" element={<Navigate to="/route" replace />} />
            
            {/* Catch-all route for 404 */}
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold mb-4">404</h1>
                  <p className="mb-6">Page not found</p>
                  <a 
                    href="/route" 
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Go to Route
                  </a>
                </div>
              </div>
            } />
          </Routes>
          <OfflineIndicator />
        </LocationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;