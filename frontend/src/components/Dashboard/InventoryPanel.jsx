import React, { useState, useEffect } from 'react';
import { customerService } from '../../services/api';

const InventoryPanel = ({ customerId }) => {
  const [rentalItems, setRentalItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch customer rental items
  useEffect(() => {
    const fetchRentalItems = async () => {
      try {
        setLoading(true);
        const response = await customerService.getCustomerRentalItems(customerId);
        setRentalItems(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch rental items:', err);
        setError('Failed to load inventory data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    if (customerId) {
      fetchRentalItems();
    }
  }, [customerId]);

  // Function to get status class for condition field
  const getConditionClass = (condition) => {
    switch (condition?.toLowerCase()) {
      case 'excellent':
        return 'text-green-600';
      case 'good':
        return 'text-blue-600';
      case 'fair':
        return 'text-yellow-600';
      case 'poor':
        return 'text-orange-600';
      case 'damaged':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };
  
  return (
    <div className="space-y-6">
      <h3 className="font-bold text-gray-700 mb-3">Customer Inventory</h3>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}
      
      {/* Inventory stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-100">
          <span className="text-2xl font-bold text-blue-600">
            {loading ? '...' : rentalItems.length}
          </span>
          <p className="text-sm text-blue-800">Total Items</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg text-center border border-green-100">
          <span className="text-2xl font-bold text-green-600">
            {loading ? '...' : rentalItems.filter(item => !item.needs_attention).length}
          </span>
          <p className="text-sm text-green-800">Good Condition</p>
        </div>
        
        <div className="bg-yellow-50 p-4 rounded-lg text-center border border-yellow-100">
          <span className="text-2xl font-bold text-yellow-600">
            {loading ? '...' : rentalItems.filter(item => item.needs_attention).length}
          </span>
          <p className="text-sm text-yellow-800">Needs Attention</p>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg text-center border border-purple-100">
          <span className="text-2xl font-bold text-purple-600">
            {loading ? '...' : rentalItems.reduce((sum, item) => sum + (item.monthly_rate || 0), 0).toFixed(2)}
          </span>
          <p className="text-sm text-purple-800">Monthly Value</p>
        </div>
      </div>
      
      {/* Inventory items list */}
      <div>
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading inventory...</p>
          </div>
        ) : rentalItems.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded">
            <p className="text-gray-500">No inventory items found for this customer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Condition
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Service
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rentalItems.map((item) => (
                  <tr key={item.id} className={item.needs_attention ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.item_number || item.id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.item_type}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.description}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={getConditionClass(item.condition)}>
                        {item.condition || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.last_service_date 
                        ? new Date(item.last_service_date).toLocaleDateString() 
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      ${item.monthly_rate?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mt-4">
        <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
          Record Inspection
        </button>
        <button className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500">
          Add New Item
        </button>
        <button className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500">
          Generate Report
        </button>
      </div>
    </div>
  );
};

export default InventoryPanel;