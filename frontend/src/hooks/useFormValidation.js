import { useState, useCallback } from 'react';
import { sanitize, formatErrors } from '../utils/validation';

/**
 * Custom hook for form validation and submission
 * 
 * @param {Object} schema - Validation schema from validation.js
 * @param {Function} onSubmit - Function to call with validated data
 * @returns {Object} - Form handling utilities
 */
const useFormValidation = (schema, onSubmit) => {
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate a single field
  const validateField = useCallback((name, value) => {
    if (!schema[name]) return true;
    
    const fieldSchema = schema[name];
    
    // Check required
    if (fieldSchema.required && (!value || value.trim() === '')) {
      return typeof fieldSchema.required === 'string' 
        ? fieldSchema.required 
        : `${name} is required`;
    }
    
    // Check min length
    if (fieldSchema.minLength && value && value.length < fieldSchema.minLength.value) {
      return fieldSchema.minLength.message;
    }
    
    // Check max length
    if (fieldSchema.maxLength && value && value.length > fieldSchema.maxLength.value) {
      return fieldSchema.maxLength.message;
    }
    
    // Check pattern
    if (fieldSchema.pattern && value && !fieldSchema.pattern.value.test(value)) {
      return fieldSchema.pattern.message;
    }
    
    return null;
  }, [schema]);

  // Validate the entire form
  const validateForm = useCallback((data) => {
    const validationErrors = {};
    let isValid = true;
    
    // Check each field against its schema
    Object.entries(schema).forEach(([fieldName, fieldSchema]) => {
      const value = data[fieldName];
      const error = validateField(fieldName, value);
      
      if (error) {
        validationErrors[fieldName] = error;
        isValid = false;
      }
    });
    
    setErrors(validationErrors);
    return isValid;
  }, [schema, validateField]);

  // Handle form submission
  const handleSubmit = useCallback(async (event) => {
    if (event) {
      event.preventDefault();
    }
    
    setIsSubmitting(true);
    
    // Sanitize data before validation
    const cleanData = sanitize.object(formData);
    
    const isValid = validateForm(cleanData);
    if (!isValid) {
      setIsSubmitting(false);
      return false;
    }
    
    try {
      await onSubmit(cleanData);
      return true;
    } catch (error) {
      // Handle submission errors
      if (error.response?.data?.errors) {
        // Format backend validation errors
        setErrors(error.response.data.errors.reduce((acc, curr) => {
          acc[curr.field] = curr.message;
          return acc;
        }, {}));
      } else {
        // General error
        setErrors({ 
          _form: error.response?.data?.message || 'An error occurred during submission'
        });
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, onSubmit]);

  // Handle input changes
  const handleChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    
    // Handle different input types
    const inputValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: inputValue
    }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [errors]);

  // Set form data programmatically
  const setFormValues = useCallback((data) => {
    setFormData(data);
    // Clear errors when setting form data
    setErrors({});
  }, []);

  return {
    formData,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    setFormValues,
    validateField,
    validateForm
  };
};

export default useFormValidation;