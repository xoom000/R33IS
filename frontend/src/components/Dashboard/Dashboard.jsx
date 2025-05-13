import React, { useState, useEffect } from 'react';
import CustomerInfo from './CustomerInfo';
import NotesPanel from './NotesPanel';
import JournalPanel from './JournalPanel';
import OrderPanel from './OrderPanel';
import InventoryPanel from './InventoryPanel';
import { calculateDistance } from '../../services/geocodingService';

const Dashboard = ({ 
  customer, 
  currentPosition,
  onClose,
  expanded = false,
  autoExpandDistance = 100 // Auto-expand when within 100 meters
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [activeTab, setActiveTab] = useState('info');
  
  // Auto-expand when in proximity to customer
  useEffect(() => {
    if (!isExpanded && customer && currentPosition && 
        customer.latitude && customer.longitude) {
      // Calculate distance to customer
      const distance = calculateDistance(
        currentPosition.latitude,
        currentPosition.longitude,
        customer.latitude,
        customer.longitude
      );
      
      // Auto-expand when within specified distance
      if (distance <= autoExpandDistance) {
        setIsExpanded(true);
      }
    }
  }, [customer, currentPosition, autoExpandDistance, isExpanded]);
  
  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Ensure dashboard is expanded when switching tabs
    setIsExpanded(true);
  };
  
  // Toggle expanded state
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  if (!customer) return null;
  
  return (
    <div className={`bg-white rounded-lg shadow-lg transition-all duration-300 overflow-hidden ${
      isExpanded ? 'max-h-[80vh]' : 'max-h-24'
    }`}>
      {/* Header - always visible */}
      <div className="bg-blue-700 text-white p-4 flex justify-between items-center cursor-pointer"
        onClick={toggleExpand}>
        <div className="flex items-center">
          <h2 className="text-xl font-bold">{customer.name}</h2>
          <span className="ml-2 text-sm opacity-75">
            {customer.address}, {customer.city}
          </span>
        </div>
        <div className="flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="ml-2 text-white hover:text-gray-200 focus:outline-none"
            aria-label="Close"
          >
            ✕
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand();
            }}
            className="ml-4 text-white hover:text-gray-200 focus:outline-none"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▲'}
          </button>
        </div>
      </div>
      
      {/* Tab navigation */}
      <div className="bg-gray-100 px-4 border-b">
        <div className="flex overflow-x-auto">
          <button
            onClick={() => handleTabChange('info')}
            className={`py-3 px-4 border-b-2 ${
              activeTab === 'info' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent hover:border-gray-300'
            }`}
          >
            Info
          </button>
          <button
            onClick={() => handleTabChange('notes')}
            className={`py-3 px-4 border-b-2 ${
              activeTab === 'notes' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent hover:border-gray-300'
            }`}
          >
            Notes
          </button>
          <button
            onClick={() => handleTabChange('journal')}
            className={`py-3 px-4 border-b-2 ${
              activeTab === 'journal' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent hover:border-gray-300'
            }`}
          >
            Journal
          </button>
          <button
            onClick={() => handleTabChange('orders')}
            className={`py-3 px-4 border-b-2 ${
              activeTab === 'orders' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent hover:border-gray-300'
            }`}
          >
            Orders
          </button>
          <button
            onClick={() => handleTabChange('inventory')}
            className={`py-3 px-4 border-b-2 ${
              activeTab === 'inventory' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent hover:border-gray-300'
            }`}
          >
            Inventory
          </button>
        </div>
      </div>
      
      {/* Tab content */}
      <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
        {activeTab === 'info' && <CustomerInfo customer={customer} />}
        {activeTab === 'notes' && <NotesPanel customerId={customer.id} />}
        {activeTab === 'journal' && <JournalPanel customerId={customer.id} currentPosition={currentPosition} />}
        {activeTab === 'orders' && <OrderPanel customerId={customer.id} />}
        {activeTab === 'inventory' && <InventoryPanel customerId={customer.id} />}
      </div>
    </div>
  );
};

export default Dashboard;