import React, { useState, useEffect } from 'react';
import { customerService } from '../../services/api';
import useFormValidation from '../../hooks/useFormValidation';
import { schemas } from '../../utils/validation';

/**
 * Customer form component with validation
 * 
 * @param {Object} props
 * @param {Object} props.customer - Customer data for editing (null for create mode)
 * @param {Function} props.onSuccess - Callback for successful submission
 * @param {Function} props.onCancel - Callback for form cancellation
 */
const CustomerForm = ({ customer, onSuccess, onCancel }) => {
  const [serverError, setServerError] = useState('');
  const isEditMode = !!customer;
  
  // Form validation hook
  const {
    formData,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    setFormValues
  } = useFormValidation(schemas.customerForm, onSubmit);
  
  // Initialize form with customer data if in edit mode
  useEffect(() => {
    if (customer) {
      setFormValues({
        AccountName: customer.AccountName || '',
        Address: customer.Address || '',
        City: customer.City || '',
        State: customer.State || '',
        ZipCode: customer.ZipCode || '',
        Phone: customer.Phone || '',
        Email: customer.Email || '',
        RouteNumber: customer.RouteNumber || '',
        ServiceFrequency: customer.ServiceFrequency || 'Weekly',
        ServiceDays: customer.ServiceDays || ''
      });
    }
  }, [customer, setFormValues]);
  
  // Handle form submission
  async function onSubmit(data) {
    try {
      setServerError('');
      let response;
      
      if (isEditMode) {
        // Update existing customer
        response = await customerService.updateCustomer(customer.CustomerNumber, data);
      } else {
        // Create new customer
        response = await customerService.createCustomer(data);
      }
      
      // Call success callback with the result
      if (onSuccess) {
        onSuccess(response);
      }
      
    } catch (error) {
      console.error('Customer form error:', error);
      setServerError(
        error.response?.data?.message || 
        'An error occurred. Please try again.'
      );
    }
  }
  
  // Helper for field classes
  const getFieldClass = (fieldName) => {
    return `w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errors[fieldName] ? 'border-red-500' : 'border-gray-300'
    }`;
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">
        {isEditMode ? 'Edit Customer' : 'Add New Customer'}
      </h2>
      
      {/* Show server errors if any */}
      {serverError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {serverError}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Account Name field */}
        <div>
          <label 
            htmlFor="AccountName" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Account Name *
          </label>
          <input
            id="AccountName"
            name="AccountName"
            type="text"
            required
            value={formData.AccountName || ''}
            onChange={handleChange}
            className={getFieldClass('AccountName')}
          />
          {errors.AccountName && (
            <p className="mt-1 text-sm text-red-600">{errors.AccountName}</p>
          )}
        </div>
        
        {/* Address field */}
        <div>
          <label 
            htmlFor="Address" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Address
          </label>
          <input
            id="Address"
            name="Address"
            type="text"
            value={formData.Address || ''}
            onChange={handleChange}
            className={getFieldClass('Address')}
          />
          {errors.Address && (
            <p className="mt-1 text-sm text-red-600">{errors.Address}</p>
          )}
        </div>
        
        {/* City, State, Zip row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label 
              htmlFor="City" 
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              City
            </label>
            <input
              id="City"
              name="City"
              type="text"
              value={formData.City || ''}
              onChange={handleChange}
              className={getFieldClass('City')}
            />
            {errors.City && (
              <p className="mt-1 text-sm text-red-600">{errors.City}</p>
            )}
          </div>
          
          <div>
            <label 
              htmlFor="State" 
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              State
            </label>
            <input
              id="State"
              name="State"
              type="text"
              value={formData.State || ''}
              onChange={handleChange}
              className={getFieldClass('State')}
              placeholder="2-letter code"
              maxLength={2}
            />
            {errors.State && (
              <p className="mt-1 text-sm text-red-600">{errors.State}</p>
            )}
          </div>
          
          <div>
            <label 
              htmlFor="ZipCode" 
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              ZIP Code
            </label>
            <input
              id="ZipCode"
              name="ZipCode"
              type="text"
              value={formData.ZipCode || ''}
              onChange={handleChange}
              className={getFieldClass('ZipCode')}
            />
            {errors.ZipCode && (
              <p className="mt-1 text-sm text-red-600">{errors.ZipCode}</p>
            )}
          </div>
        </div>
        
        {/* Phone and Email row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label 
              htmlFor="Phone" 
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Phone
            </label>
            <input
              id="Phone"
              name="Phone"
              type="tel"
              value={formData.Phone || ''}
              onChange={handleChange}
              className={getFieldClass('Phone')}
            />
            {errors.Phone && (
              <p className="mt-1 text-sm text-red-600">{errors.Phone}</p>
            )}
          </div>
          
          <div>
            <label 
              htmlFor="Email" 
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="Email"
              name="Email"
              type="email"
              value={formData.Email || ''}
              onChange={handleChange}
              className={getFieldClass('Email')}
            />
            {errors.Email && (
              <p className="mt-1 text-sm text-red-600">{errors.Email}</p>
            )}
          </div>
        </div>
        
        {/* Route Information */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label 
              htmlFor="ServiceFrequency" 
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Service Frequency
            </label>
            <select
              id="ServiceFrequency"
              name="ServiceFrequency"
              value={formData.ServiceFrequency || 'Weekly'}
              onChange={handleChange}
              className={getFieldClass('ServiceFrequency')}
            >
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Biweekly">Biweekly</option>
              <option value="Monthly">Monthly</option>
              <option value="OnCall">On Call</option>
            </select>
          </div>
          
          <div>
            <label 
              htmlFor="ServiceDays" 
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Service Days
            </label>
            <input
              id="ServiceDays"
              name="ServiceDays"
              type="text"
              value={formData.ServiceDays || ''}
              onChange={handleChange}
              className={getFieldClass('ServiceDays')}
              placeholder="e.g. Mon, Wed, Fri"
            />
          </div>
        </div>
        
        {/* Buttons */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update Customer' : 'Create Customer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerForm;