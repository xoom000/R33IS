/**
 * Frontend validation utility
 * 
 * This file contains common validation functions for use across the application
 * It provides both form validation helpers and input sanitizers
 */

// Simple email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Phone validation regex (simple but flexible)
const PHONE_REGEX = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;

// Customer number validation (can be customized to match actual format)
const CUSTOMER_NUMBER_REGEX = /^[0-9]{1,10}$/;

// Zip code validation (supports 5 and 9 digit formats)
const ZIP_REGEX = /^[0-9]{5}(?:-[0-9]{4})?$/;

// US State validation (2 letter code)
const STATE_REGEX = /^[A-Z]{2}$/;

/**
 * Validation functions that can be used with react-hook-form
 */
const validators = {
  required: (value) => (value ? true : 'This field is required'),
  
  minLength: (min) => (value) => 
    !value || value.length >= min || `Must be at least ${min} characters`,
  
  maxLength: (max) => (value) => 
    !value || value.length <= max || `Must be less than ${max} characters`,
  
  email: (value) => 
    !value || EMAIL_REGEX.test(value) || 'Must be a valid email address',
  
  phone: (value) => 
    !value || PHONE_REGEX.test(value) || 'Must be a valid phone number',
  
  customerNumber: (value) => 
    !value || CUSTOMER_NUMBER_REGEX.test(value) || 'Must be a valid customer number',
  
  zipCode: (value) => 
    !value || ZIP_REGEX.test(value) || 'Must be a valid ZIP code',
  
  state: (value) => 
    !value || STATE_REGEX.test(value) || 'Must be a valid 2-letter state code',
  
  numeric: (value) => 
    !value || /^[0-9]+$/.test(value) || 'Must contain only numbers',
  
  decimal: (value) => 
    !value || /^[0-9]+(\.[0-9]{1,2})?$/.test(value) || 'Must be a valid number',
  
  password: (value) => {
    if (!value) return true;
    
    const errors = [];
    if (value.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(value)) errors.push('Password must include an uppercase letter');
    if (!/[a-z]/.test(value)) errors.push('Password must include a lowercase letter');
    if (!/[0-9]/.test(value)) errors.push('Password must include a number');
    
    return errors.length === 0 || errors;
  },
  
  match: (field, fieldName) => (value, formValues) => 
    !value || value === formValues[field] || `Must match ${fieldName || field}`,
};

/**
 * Common validation schemas for different form types
 * These can be used directly with react-hook-form's resolver
 */
const schemas = {
  login: {
    username: {
      required: 'Username is required',
    },
    password: {
      required: 'Password is required',
    },
  },
  
  customerForm: {
    AccountName: {
      required: 'Account name is required',
      maxLength: { value: 100, message: 'Account name must be less than 100 characters' },
    },
    Address: {
      maxLength: { value: 200, message: 'Address must be less than 200 characters' },
    },
    City: {
      maxLength: { value: 50, message: 'City must be less than 50 characters' },
    },
    State: {
      pattern: { value: STATE_REGEX, message: 'State must be a valid 2-letter code' },
    },
    ZipCode: {
      pattern: { value: ZIP_REGEX, message: 'Must be a valid ZIP code' },
    },
    Phone: {
      pattern: { value: PHONE_REGEX, message: 'Must be a valid phone number' },
    },
    Email: {
      pattern: { value: EMAIL_REGEX, message: 'Must be a valid email address' },
    },
  },
  
  noteForm: {
    note_text: {
      required: 'Note text is required',
      maxLength: { value: 2000, message: 'Note must be less than 2000 characters' },
    },
    note_type: {
      required: 'Note type is required',
    },
  },
  
  journalForm: {
    entry_text: {
      required: 'Journal entry text is required',
      maxLength: { value: 5000, message: 'Entry must be less than 5000 characters' },
    },
  },
  
  orderForm: {
    status: {
      required: 'Order status is required',
    },
  },
};

/**
 * Sanitization functions for cleaning user input
 */
const sanitize = {
  // Basic string sanitization - remove leading/trailing whitespace and escape HTML
  string: (value) => {
    if (!value) return value;
    return String(value)
      .trim()
      .replace(/[<>]/g, (match) => match === '<' ? '&lt;' : '&gt;');
  },
  
  // Sanitize all string properties in an object
  object: (obj, excludeKeys = []) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (excludeKeys.includes(key)) {
        sanitized[key] = value;
        continue;
      }
      
      if (typeof value === 'string') {
        sanitized[key] = sanitize.string(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'object' ? sanitize.object(item, excludeKeys) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitize.object(value, excludeKeys);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
};

/**
 * Format validation errors into a more user-friendly structure
 */
const formatErrors = (errors) => {
  if (!errors) return {};
  
  // Create a flat object of field:message pairs from react-hook-form errors
  const formatted = {};
  Object.entries(errors).forEach(([field, error]) => {
    if (error) {
      if (typeof error.message === 'string') {
        formatted[field] = error.message;
      } else if (Array.isArray(error)) {
        formatted[field] = error.join(', ');
      } else if (error.type === 'required') {
        formatted[field] = `${field} is required`;
      } else {
        formatted[field] = `Invalid ${field}`;
      }
    }
  });
  
  return formatted;
};

export {
  validators,
  schemas,
  sanitize,
  formatErrors,
  EMAIL_REGEX,
  PHONE_REGEX,
  CUSTOMER_NUMBER_REGEX,
  ZIP_REGEX,
  STATE_REGEX
};