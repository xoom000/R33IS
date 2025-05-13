import React from 'react';

const CustomerInfo = ({ customer }) => {
  if (!customer) {
    return (
      <div className="text-center py-8 text-gray-500">
        No customer data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contact information */}
      <section>
        <h3 className="font-bold text-gray-700 mb-2 text-lg">Contact Information</h3>
        <div className="bg-gray-50 p-4 rounded">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Address</p>
              <p className="font-medium">{customer.address}</p>
              <p className="font-medium">{customer.city}, {customer.state} {customer.zipCode}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Contact</p>
              {customer.phone && <p className="font-medium">Phone: {customer.phone}</p>}
              {customer.email && <p className="font-medium">Email: {customer.email}</p>}
              {customer.contactName && <p className="font-medium">Contact: {customer.contactName}</p>}
            </div>
          </div>
        </div>
      </section>
      
      {/* Service details */}
      <section>
        <h3 className="font-bold text-gray-700 mb-2 text-lg">Service Details</h3>
        <div className="bg-gray-50 p-4 rounded">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Customer Since</p>
              <p className="font-medium">
                {customer.customerSince 
                  ? new Date(customer.customerSince).toLocaleDateString() 
                  : 'Not available'}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Service Days</p>
              <p className="font-medium">{customer.serviceDays || 'Not specified'}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Route Number</p>
              <p className="font-medium">{customer.route || 'Not assigned'}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Customer Number</p>
              <p className="font-medium">{customer.customerNumber || 'N/A'}</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Account status */}
      <section>
        <h3 className="font-bold text-gray-700 mb-2 text-lg">Account Status</h3>
        <div className="bg-gray-50 p-4 rounded">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Account Status</p>
              <p className={`font-medium ${
                customer.status === 'Active' ? 'text-green-600' : 
                customer.status === 'Inactive' ? 'text-red-600' : 
                'text-yellow-600'
              }`}>
                {customer.status || 'Unknown'}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Account Type</p>
              <p className="font-medium">{customer.accountType || 'Standard'}</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Special instructions */}
      {customer.specialInstructions && (
        <section>
          <h3 className="font-bold text-gray-700 mb-2 text-lg">Special Instructions</h3>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <p>{customer.specialInstructions}</p>
          </div>
        </section>
      )}
      
      {/* Quick actions */}
      <section>
        <h3 className="font-bold text-gray-700 mb-2 text-lg">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
            Call Customer
          </button>
          <button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
            Navigate
          </button>
          <button className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded">
            View History
          </button>
          <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">
            Send Message
          </button>
        </div>
      </section>
    </div>
  );
};

export default CustomerInfo;