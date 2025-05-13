// src/utils/validation.js
const { body, param, query, validationResult } = require('express-validator');

/**
 * Common validation rules that can be reused across multiple endpoints
 */
const validationRules = {
  // Authentication validation rules
  auth: {
    login: [
      body('username').optional().trim().isString().isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters'),
      body('customerNumber').optional().trim().isNumeric()
        .withMessage('Customer number must be numeric'),
      body('password').notEmpty().withMessage('Password is required')
    ],
    register: [
      body('username').notEmpty().trim().isString().isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters'),
      body('password').notEmpty().isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
      body('customer_number').notEmpty().trim().isNumeric()
        .withMessage('Customer number must be numeric')
    ]
  },
  
  // Customer validation rules
  customer: {
    create: [
      body('CustomerNumber').notEmpty().trim().isNumeric()
        .withMessage('Customer number must be numeric'),
      body('AccountName').notEmpty().trim().isString().isLength({ max: 100 })
        .withMessage('Account name is required and must be less than 100 characters'),
      body('Address').optional().trim().isString().isLength({ max: 200 })
        .withMessage('Address must be less than 200 characters'),
      body('City').optional().trim().isString().isLength({ max: 50 })
        .withMessage('City must be less than 50 characters'),
      body('State').optional().trim().isString().isLength({ max: 2 })
        .withMessage('State must be a valid 2-letter code'),
      body('ZipCode').optional().trim().isString().isLength({ max: 10 })
        .withMessage('Zip code must be valid'),
      body('Phone').optional().trim().isString().isLength({ max: 20 })
        .withMessage('Phone number must be valid'),
      body('Email').optional().trim().isEmail()
        .withMessage('Email must be valid')
    ],
    update: [
      param('id').notEmpty().trim().isNumeric()
        .withMessage('Customer ID must be numeric'),
      body('AccountName').optional().trim().isString().isLength({ max: 100 })
        .withMessage('Account name must be less than 100 characters'),
      body('Address').optional().trim().isString().isLength({ max: 200 })
        .withMessage('Address must be less than 200 characters'),
      body('City').optional().trim().isString().isLength({ max: 50 })
        .withMessage('City must be less than 50 characters'),
      body('State').optional().trim().isString().isLength({ max: 2 })
        .withMessage('State must be a valid 2-letter code'),
      body('ZipCode').optional().trim().isString().isLength({ max: 10 })
        .withMessage('Zip code must be valid'),
      body('Phone').optional().trim().isString().isLength({ max: 20 })
        .withMessage('Phone number must be valid'),
      body('Email').optional().trim().isEmail()
        .withMessage('Email must be valid')
    ],
    getOne: [
      param('id').notEmpty().trim().isNumeric()
        .withMessage('Customer ID must be numeric')
    ]
  },
  
  // Notes validation rules
  notes: {
    create: [
      body('customer_id').notEmpty().trim().isNumeric()
        .withMessage('Customer ID must be numeric'),
      body('note_text').notEmpty().trim().isString().isLength({ max: 2000 })
        .withMessage('Note text is required and must be less than 2000 characters'),
      body('note_type').optional().trim().isString().isIn(['general', 'delivery', 'billing', 'complaint', 'other'])
        .withMessage('Note type must be valid')
    ],
    update: [
      param('id').notEmpty().trim().isNumeric()
        .withMessage('Note ID must be numeric'),
      body('note_text').optional().trim().isString().isLength({ max: 2000 })
        .withMessage('Note text must be less than 2000 characters'),
      body('note_type').optional().trim().isString().isIn(['general', 'delivery', 'billing', 'complaint', 'other'])
        .withMessage('Note type must be valid')
    ],
    getByCustomer: [
      query('customerId').notEmpty().trim().isNumeric()
        .withMessage('Customer ID must be numeric')
    ]
  },
  
  // Journal validation rules
  journal: {
    create: [
      body('customer_id').notEmpty().trim().isNumeric()
        .withMessage('Customer ID must be numeric'),
      body('entry_text').notEmpty().trim().isString().isLength({ max: 5000 })
        .withMessage('Entry text is required and must be less than 5000 characters'),
      body('entry_type').optional().trim().isString()
        .withMessage('Entry type must be a string')
    ],
    update: [
      param('id').notEmpty().trim().isNumeric()
        .withMessage('Journal entry ID must be numeric'),
      body('entry_text').optional().trim().isString().isLength({ max: 5000 })
        .withMessage('Entry text must be less than 5000 characters'),
      body('entry_type').optional().trim().isString()
        .withMessage('Entry type must be a string')
    ]
  },
  
  // Orders validation rules
  orders: {
    create: [
      body('customer_id').notEmpty().trim().isNumeric()
        .withMessage('Customer ID must be numeric'),
      body('order_date').optional().isISO8601().toDate()
        .withMessage('Order date must be a valid date'),
      body('status').optional().trim().isString().isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
        .withMessage('Status must be valid'),
      body('total_amount').optional().isFloat({ min: 0 })
        .withMessage('Total amount must be a positive number'),
      body('order_items').optional().isArray()
        .withMessage('Order items must be an array'),
      body('order_items.*.product_id').optional().isNumeric()
        .withMessage('Product ID must be numeric'),
      body('order_items.*.quantity').optional().isInt({ min: 1 })
        .withMessage('Quantity must be a positive integer'),
      body('order_items.*.price').optional().isFloat({ min: 0 })
        .withMessage('Price must be a positive number')
    ],
    update: [
      param('id').notEmpty().trim().isNumeric()
        .withMessage('Order ID must be numeric'),
      body('status').optional().trim().isString().isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
        .withMessage('Status must be valid'),
      body('order_items').optional().isArray()
        .withMessage('Order items must be an array')
    ]
  },
  
  // Route validation rules
  route: {
    getRoute: [
      query('date').optional().isISO8601().toDate()
        .withMessage('Date must be a valid date')
    ],
    updateRoute: [
      query('date').optional().isISO8601().toDate()
        .withMessage('Date must be a valid date'),
      body('stops').optional().isArray()
        .withMessage('Stops must be an array'),
      body('driver_id').optional().isNumeric()
        .withMessage('Driver ID must be numeric')
    ],
    completeStop: [
      param('stopId').notEmpty().trim().isNumeric()
        .withMessage('Stop ID must be numeric'),
      body('notes').optional().trim().isString().isLength({ max: 500 })
        .withMessage('Notes must be less than 500 characters'),
      body('status').optional().trim().isString().isIn(['completed', 'skipped', 'partial'])
        .withMessage('Status must be valid')
    ]
  },
  
  // User validation rules
  user: {
    create: [
      body('username').notEmpty().trim().isString().isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters'),
      body('password').notEmpty().isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
      body('role').optional().trim().isString().isIn(['Admin', 'Driver', 'Customer', 'SuperAdmin'])
        .withMessage('Role must be valid'),
      body('customer_number').optional().trim().isNumeric()
        .withMessage('Customer number must be numeric')
    ],
    update: [
      param('id').notEmpty().trim().isNumeric()
        .withMessage('User ID must be numeric'),
      body('username').optional().trim().isString().isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters'),
      body('password').optional().isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
      body('role').optional().trim().isString().isIn(['Admin', 'Driver', 'Customer', 'SuperAdmin'])
        .withMessage('Role must be valid')
    ]
  }
};

/**
 * Middleware to handle validation errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  
  const extractedErrors = [];
  errors.array().map(err => {
    extractedErrors.push({ field: err.path, message: err.msg });
  });
  
  return res.status(422).json({
    error: 'Validation failed',
    errors: extractedErrors
  });
};

/**
 * Sanitization functions for cleaning input data
 */
const sanitize = {
  // Sanitize a string - trim and escape HTML
  string: (value) => {
    if (!value) return value;
    return String(value)
      .trim()
      .replace(/[<>]/g, (match) => match === '<' ? '&lt;' : '&gt;');
  },
  
  // Sanitize object by applying sanitizers to all string properties
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
 * Simple security validation functions
 */
const security = {
  // Check for common SQL injection patterns
  hasSqlInjection: (value) => {
    if (!value || typeof value !== 'string') return false;
    
    const sqlPattern = /('|"|--|\/\*|\*\/|;|\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|UNION|INTO|FROM|WHERE)\b)/i;
    return sqlPattern.test(value);
  },
  
  // Check for potential XSS patterns
  hasXss: (value) => {
    if (!value || typeof value !== 'string') return false;
    
    const xssPattern = /<script|javascript:|onerror=|onload=|eval\(|\bon\w+=/i;
    return xssPattern.test(value);
  },
  
  // Apply security checks to an object
  checkObject: (obj, res) => {
    if (!obj || typeof obj !== 'object') return true;
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        if (security.hasSqlInjection(value)) {
          res.status(400).json({
            error: 'Security violation',
            message: `Invalid input detected in ${key}`
          });
          return false;
        }
        
        if (security.hasXss(value)) {
          res.status(400).json({
            error: 'Security violation',
            message: `Invalid input detected in ${key}`
          });
          return false;
        }
      } else if (typeof value === 'object' && value !== null) {
        if (!security.checkObject(value, res)) {
          return false;
        }
      }
    }
    
    return true;
  }
};

// Export all components
module.exports = {
  rules: validationRules,
  validate,
  sanitize,
  security
};