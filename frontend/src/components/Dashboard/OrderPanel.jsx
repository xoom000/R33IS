import React, { useState, useEffect } from 'react';
import { orderService } from '../../services/api';

const OrderPanel = ({ customerId }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderForm, setOrderForm] = useState({
    items: [{ product_id: '', quantity: 1 }],
    notes: '',
    requested_delivery_date: ''
  });
  const [products, setProducts] = useState([]); // This would be populated from the API
  
  // Fetch customer orders
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        // In a real implementation, you would filter by customer ID
        const response = await orderService.getAll({ customer_id: customerId });
        setOrders(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
        setError('Failed to load orders. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    // For the prototype, we'll use dummy product data
    // In a real implementation, this would come from an API call
    setProducts([
      { id: 1, name: 'Product A', unit: 'EA' },
      { id: 2, name: 'Product B', unit: 'CS' },
      { id: 3, name: 'Product C', unit: 'EA' },
      { id: 4, name: 'Product D', unit: 'BOX' },
    ]);
    
    if (customerId) {
      fetchOrders();
    }
  }, [customerId]);
  
  // Handle order form changes
  const handleOrderFormChange = (field, value) => {
    setOrderForm(prev => ({ ...prev, [field]: value }));
  };
  
  // Handle item changes in the order form
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...orderForm.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setOrderForm(prev => ({ ...prev, items: updatedItems }));
  };
  
  // Add a new item to the order
  const addOrderItem = () => {
    setOrderForm(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', quantity: 1 }]
    }));
  };
  
  // Remove an item from the order
  const removeOrderItem = (index) => {
    const updatedItems = [...orderForm.items];
    updatedItems.splice(index, 1);
    setOrderForm(prev => ({ ...prev, items: updatedItems }));
  };
  
  // Submit order request
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!orderForm.items.length || 
        orderForm.items.some(item => !item.product_id || item.quantity < 1)) {
      setError('Please add at least one valid item to the order.');
      return;
    }
    
    try {
      setLoading(true);
      
      const orderData = {
        ...orderForm,
        customer_id: customerId,
        requested_delivery_date: orderForm.requested_delivery_date || null,
      };
      
      const response = await orderService.requestOrder(orderData);
      
      // Add new order to list
      setOrders(prevOrders => [response.data, ...prevOrders]);
      
      // Reset form
      setOrderForm({
        items: [{ product_id: '', quantity: 1 }],
        notes: '',
        requested_delivery_date: ''
      });
      
      setError(null);
    } catch (err) {
      console.error('Failed to submit order:', err);
      setError('Failed to submit order. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Render order status badge with appropriate color
  const OrderStatusBadge = ({ status }) => {
    const statuses = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      completed: 'bg-blue-100 text-blue-800 border-blue-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
    };
    
    return (
      <span className={`text-xs px-2 py-1 rounded border ${statuses[status] || statuses.pending}`}>
        {status}
      </span>
    );
  };
  
  return (
    <div className="space-y-6">
      {/* Create order form */}
      <form onSubmit={handleSubmitOrder} className="bg-gray-50 p-4 rounded">
        <h3 className="font-bold text-gray-700 mb-3">Request Order</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Order Items
          </label>
          
          {orderForm.items.map((item, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
              <select
                value={item.product_id}
                onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a product</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.unit})
                  </option>
                ))}
              </select>
              
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
              
              <button
                type="button"
                onClick={() => removeOrderItem(index)}
                className="p-2 text-red-500 hover:text-red-700 focus:outline-none"
                disabled={orderForm.items.length <= 1}
              >
                ✕
              </button>
            </div>
          ))}
          
          <button
            type="button"
            onClick={addOrderItem}
            className="mt-2 px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none"
          >
            + Add Item
          </button>
        </div>
        
        <div className="mb-3">
          <label htmlFor="requestedDate" className="block text-sm font-medium text-gray-700 mb-1">
            Requested Delivery Date (Optional)
          </label>
          <input
            type="date"
            id="requestedDate"
            value={orderForm.requested_delivery_date}
            onChange={(e) => handleOrderFormChange('requested_delivery_date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            min={new Date().toISOString().split('T')[0]} // Disable past dates
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="orderNotes" className="block text-sm font-medium text-gray-700 mb-1">
            Order Notes (Optional)
          </label>
          <textarea
            id="orderNotes"
            value={orderForm.notes}
            onChange={(e) => handleOrderFormChange('notes', e.target.value)}
            rows="2"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Any special instructions for this order..."
          />
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || orderForm.items.length === 0 || orderForm.items.some(item => !item.product_id)}
            className={`px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              loading || orderForm.items.length === 0 || orderForm.items.some(item => !item.product_id)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {loading ? 'Submitting...' : 'Submit Order'}
          </button>
        </div>
      </form>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}
      
      {/* Orders list */}
      <div>
        <h3 className="font-bold text-gray-700 mb-3">Recent Orders</h3>
        
        {loading && orders.length === 0 ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded">
            <p className="text-gray-500">No orders available for this customer.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-md p-4 bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium">Order #{order.id}</span>
                    <OrderStatusBadge status={order.status || 'pending'} />
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="mt-3 border-t pt-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Items</h4>
                  <ul className="text-sm text-gray-600 divide-y">
                    {order.items?.map((item, index) => (
                      <li key={index} className="py-1 flex justify-between">
                        <span>{item.product_name || `Product #${item.product_id}`}</span>
                        <span>{item.quantity} {item.unit || 'units'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {order.notes && (
                  <div className="mt-3 text-sm">
                    <p className="text-gray-700 font-medium">Notes:</p>
                    <p className="text-gray-600">{order.notes}</p>
                  </div>
                )}
                
                {order.status === 'pending' && (
                  <div className="mt-3 flex justify-end">
                    <button
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none text-sm"
                      onClick={() => {/* Handle cancel */}}
                    >
                      Cancel Order
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderPanel;