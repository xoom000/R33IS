import React, { useState, useEffect } from 'react';
import MapView from '../components/Map/MapView';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { customerService } from '../services/api';
import { batchGeocodeAddresses } from '../services/geocodingService';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const { currentPosition, startTracking } = useLocation();
  
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCustomerId, setActiveCustomerId] = useState(null);
  const [showDirections, setShowDirections] = useState(false);
  
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
            geocodeError: geocodedCustomer?.geocodeError
          };
        });
        
        setCustomers(finalCustomers);
        setError(null);
      } catch (err) {
        console.error('Failed to load customers:', err);
        setError('Failed to load customer data. Please try again.');
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
    setShowDirections(true);
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
      <main className="flex-1 container mx-auto p-4 flex flex-col md:flex-row gap-4">
        {/* Map container - takes full height on mobile, left half on desktop */}
        <div className="flex-1 h-[50vh] md:h-auto">
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
              showDirections={showDirections}
            />
          )}
        </div>
        
        {/* Customer panel - takes full width on mobile, right half on desktop */}
        <div className="flex-1 bg-white rounded-lg shadow-md p-4 overflow-y-auto">
          {activeCustomer ? (
            <div>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">{activeCustomer.name}</h2>
                <button
                  onClick={() => setActiveCustomerId(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4">
                <p>{activeCustomer.address}</p>
                <p>{activeCustomer.city}, {activeCustomer.state} {activeCustomer.zipCode}</p>
                {activeCustomer.phone && <p>Phone: {activeCustomer.phone}</p>}
              </div>
              
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => setShowDirections(!showDirections)}
                  className={`px-4 py-2 rounded ${
                    showDirections 
                      ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                      : 'bg-blue-500 text-white'
                  }`}
                >
                  {showDirections ? 'Hide Directions' : 'Show Directions'}
                </button>
              </div>
              
              {/* Customer dashboard tabs would go here */}
              <div className="border-t pt-4">
                <h3 className="font-bold mb-2">Options</h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded">
                    Notes & Journal
                  </button>
                  <button className="w-full text-left px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded">
                    Orders
                  </button>
                  <button className="w-full text-left px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded">
                    Inventory
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <p className="mb-4">Select a customer from the map</p>
              <p className="text-sm">or</p>
              <div className="mt-4">
                <select
                  className="block w-full p-2 border border-gray-300 rounded"
                  value=""
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                >
                  <option value="" disabled>Select from list</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;