import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/api';
import useFormValidation from '../../hooks/useFormValidation';
import { schemas } from '../../utils/validation';

/**
 * Login form component with validation
 * 
 * @param {Object} props
 * @param {Function} props.onLoginSuccess - Callback for successful login
 */
const LoginForm = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  
  // Form validation hook
  const {
    formData,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    setFormValues
  } = useFormValidation(schemas.login, onSubmit);
  
  // Handle form submission
  async function onSubmit(data) {
    try {
      setServerError('');
      const response = await authService.login(data.username, data.password);
      
      if (response.success) {
        // Call the success callback
        if (onLoginSuccess) {
          onLoginSuccess(response.user);
        }
        
        // Redirect to dashboard or home page
        navigate('/dashboard');
      } else {
        setServerError('Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setServerError(
        error.response?.data?.message || 
        'An error occurred during login. Please try again.'
      );
    }
  }
  
  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Login to R33IS
      </h2>
      
      {/* Show server errors if any */}
      {serverError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {serverError}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Username field */}
        <div>
          <label 
            htmlFor="username" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={formData.username || ''}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.username ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your username or customer number"
          />
          {errors.username && (
            <p className="mt-1 text-sm text-red-600">{errors.username}</p>
          )}
        </div>
        
        {/* Password field */}
        <div>
          <label 
            htmlFor="password" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password || ''}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.password ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your password"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password}</p>
          )}
        </div>
        
        {/* Submit button */}
        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;