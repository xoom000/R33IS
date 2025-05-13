import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import MapView from '../components/Map/MapView';
import RouteList from '../components/Route/RouteList';
import CompletionTracker from '../components/Route/CompletionTracker';
import Dashboard from '../components/Dashboard/Dashboard';
import { customerService } from '../services/api';
import { batchGeocodeAddresses } from '../services/geocodingService';

const RouteManagement = () => {
  const { currentUser } = useAuth();
  const { currentPosition, startTracking } = useLocation();
  
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCustomerId, setActiveCustomerId] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  
  // Start location tracking when component mounts
  useEffect(() => {
    startTracking();
  }, [startTracking]);
  
  // Load customers for the current user's route
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoading(true);
        
        // Get current user's route number
        const routeNumber = currentUser?.route;
        
        if (!routeNumber) {
          setError('No route assigned to current user');
          setLoading(false);
          return;
        }
        
        // Fetch customers for this route
        const response = await customerService.getAll({ route: routeNumber });
        const routeCustomers = response.data;
        
        // Geocode customer addresses
        const customersWithCoordinates = await batchGeocodeAddresses(
          routeCustomers.map(customer => ({
            id: customer.id,
            name: customer.name,
            address: customer.address,
            city: customer.city,
            state: customer.state,
            zipCode: customer.zipCode
          }))
        );
        
        // Merge geocoded data back into customer objects
        const finalCustomers = routeCustomers.map(customer => {
          const geocodedCustomer = customersWithCoordinates.find(c => c.id === customer.id);
          return {
            ...customer,
            latitude: geocodedCustomer?.latitude,
            longitude: geocodedCustomer?.longitude,
            geocodeError: geocodedCustomer?.geocodeError,
            completed: false, // Track completion state
            eta: null // Estimated time to arrival
          };
        });
        
        setCustomers(finalCustomers);
        setError(null);
      } catch (err) {
        console.error('Failed to load customers:', err);
        setError('Failed to load route data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    if (currentUser) {
      loadCustomers();
    }
  }, [currentUser]);
  
  // Handle customer selection
  const handleCustomerSelect = (customerId) => {
    setActiveCustomerId(customerId);
    setShowDashboard(true);
  };
  
  // Handle dashboard close
  const handleDashboardClose = () => {
    setShowDashboard(false);
    setActiveCustomerId(null);
  };
  
  // Handle route reordering
  const handleReorderRoute = (reorderedCustomers) => {
    setCustomers(reorderedCustomers);
  };
  
  // Get the active customer
  const activeCustomer = customers.find(c => c.id === activeCustomerId);
  
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-blue-700 text-white shadow-md p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">R33IS</h1>
          <div className="flex items-center space-x-4">
            <span>{currentUser?.username}</span>
            <span className="text-sm bg-blue-900 px-2 py-1 rounded">
              Route {currentUser?.route}
            </span>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 container mx-auto p-4 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* Left sidebar - Route list */}
        <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col gap-4 overflow-y-auto">
          <CompletionTracker stops={customers} />
          
          <RouteList
            currentPosition={currentPosition}
            onSelectCustomer={handleCustomerSelect}
            activeCustomerId={activeCustomerId}
            onReorderRoute={handleReorderRoute}
          />
        </div>
        
        {/* Main area - Map and dashboard */}
        <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col gap-4 overflow-hidden">
          {/* Map container */}
          <div className="flex-1 min-h-[400px] relative">
            {loading ? (
              <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="h-full flex items-center justify-center bg-red-100 text-red-700 rounded-lg p-4">
                {error}
              </div>
            ) : (
              <MapView 
                customers={customers}
                activeCustomerId={activeCustomerId}
                onCustomerSelect={handleCustomerSelect}
                showDirections={activeCustomerId !== null}
              />
            )}
          </div>
          
          {/* Customer dashboard */}
          {showDashboard && activeCustomer && (
            <div className="h-1/2 overflow-y-auto">
              <Dashboard
                customer={activeCustomer}
                currentPosition={currentPosition}
                onClose={handleDashboardClose}
                expanded={true}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default RouteManagement;