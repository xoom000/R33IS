// src/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const tokenService = require('../services/tokenService');
const { rules, validate, sanitize, security } = require('../utils/validation');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user with username/password/customer number
 * @access  Public
 */
router.post('/register', rules.auth.register, validate, async (req, res) => {
  const { username, password, customer_number } = req.body;

  // Validate input
  if (!username || !password || !customer_number) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Username, password, and customer number are required.'
    });
  }

  try {
    const db = req.app.locals.db;

    // Check if customer exists
    const getCustomer = () => {
      return new Promise((resolve, reject) => {
        db.get(
          'SELECT CustomerNumber, AccountName FROM customers WHERE CustomerNumber = ?',
          [customer_number],
          (err, customer) => {
            if (err) reject(err);
            else resolve(customer);
          }
        );
      });
    };

    const customer = await getCustomer();
    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found',
        message: 'The provided customer number does not exist.'
      });
    }

    // Check if username is taken
    const getUserByUsername = () => {
      return new Promise((resolve, reject) => {
        db.get(
          'SELECT username FROM users WHERE username = ?',
          [username],
          (err, user) => {
            if (err) reject(err);
            else resolve(user);
          }
        );
      });
    };

    const existingUser = await getUserByUsername();
    if (existingUser) {
      return res.status(409).json({
        error: 'Username taken',
        message: 'This username is already in use.'
      });
    }

    // Check if customer number is already registered
    const getUserByCustomerNumber = () => {
      return new Promise((resolve, reject) => {
        db.get(
          'SELECT customer_number FROM users WHERE customer_number = ?',
          [customer_number],
          (err, user) => {
            if (err) reject(err);
            else resolve(user);
          }
        );
      });
    };

    const existingCustomer = await getUserByCustomerNumber();
    if (existingCustomer) {
      return res.status(409).json({
        error: 'Customer already registered',
        message: 'This customer number is already associated with an account.'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Default role is Customer
    const role = 'Customer';

    // Insert new user
    const insertUser = () => {
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, password_hash, customer_number, role) VALUES (?, ?, ?, ?)',
          [username, hashedPassword, customer_number, role],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
    };

    const userId = await insertUser();

    // Return success response
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      username: username,
      customerNumber: customer_number,
      accountName: customer.AccountName,
      role: role
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({
      error: 'Server error',
      message: 'An unexpected error occurred. Please try again later.'
    });
  }
});

/**
 * Helper function to set authentication cookies
 */
const setAuthCookies = (res, token, refreshToken) => {
  // Set the access token in a cookie
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',  // Helps with CSRF
    maxAge: 1 * 60 * 60 * 1000, // 1 hour
    path: '/' // Cookie is valid for all paths
  });

  // Set the refresh token in a cookie (if provided)
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh' // Only sent to refresh endpoint
    });
  }
};

/**
 * Helper function to clear authentication cookies
 */
const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  
  res.clearCookie('refreshToken', {
    path: '/api/auth/refresh',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token (Username-based)
 * @access  Public
 */
router.post('/login', rules.auth.login, validate, async (req, res) => {
  // Accept either username/password or customerNumber/password
  const { username, customerNumber, password } = req.body;

  // Validate input - need either username or customerNumber
  if ((!username && !customerNumber) || !password) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Username and password are required.',
    });
  }

  try {
    const db = req.app.locals.db;
    let user;

    // If username is provided, check users table
    if (username) {
      // Helper function to fetch user by username
      const getUserByUsername = () => {
        return new Promise((resolve, reject) => {
          db.get(
            `SELECT u.user_id, u.username, u.password_hash, u.customer_number as CustomerNumber, 
                    u.role, c.AccountName 
             FROM users u 
             JOIN customers c ON u.customer_number = c.CustomerNumber 
             WHERE u.username = ?`,
            [username],
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
        });
      };
      
      user = await getUserByUsername();
    } else if (customerNumber) {
      // Otherwise use existing customer number login (for backward compatibility)
      const getUserByCustomerNumber = () => {
        return new Promise((resolve, reject) => {
          db.get(
            `SELECT u.user_id, u.username, u.password_hash, u.customer_number as CustomerNumber, 
                    u.role, c.AccountName 
             FROM users u 
             JOIN customers c ON u.customer_number = c.CustomerNumber 
             WHERE u.customer_number = ?`,
            [customerNumber],
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
        });
      };
      
      user = await getUserByCustomerNumber();
      
      // If not found in users table, try customers table for backward compatibility
      if (!user) {
        const getLegacyCustomer = () => {
          return new Promise((resolve, reject) => {
            db.get(
              `SELECT CustomerNumber, AccountName, password_hash, role FROM customers WHERE CustomerNumber = ?`,
              [customerNumber],
              (err, result) => {
                if (err) reject(err);
                else resolve(result);
              }
            );
          });
        };
        
        user = await getLegacyCustomer();
      }
    }

    // Check if user exists
    if (!user || !user.password_hash) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid credentials.',
      });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid credentials.',
      });
    }

    // Normalize role case to match expected route authorization
    const normalizedRole = user.role
      ? user.role.toLowerCase() === 'superadmin'
        ? 'SuperAdmin'
        : user.role.toLowerCase() === 'driver'
        ? 'Driver'
        : user.role.toLowerCase() === 'admin'
        ? 'Admin'
        : 'Customer'
      : 'Customer';

    // Create JWT payload
    const payload = {
      id: user.CustomerNumber,
      name: user.AccountName,
      role: normalizedRole,
      customerNumber: user.CustomerNumber,
      username: user.username
    };

    // Generate access token - short lived (1 hour)
    const token = tokenService.generateAccessToken(payload);
    
    // Create refresh token and store in database
    const refreshToken = await tokenService.createRefreshToken(req.app.locals.db, user.CustomerNumber);

    // Set httpOnly cookies
    setAuthCookies(res, token, refreshToken);

    // Return success response
    res.json({
      success: true,
      // No longer send token in response body - it's in the httpOnly cookie
      user: {
        id: user.CustomerNumber,
        customerNumber: user.CustomerNumber,
        name: user.AccountName,
        role: normalizedRole,
        username: user.username
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      error: 'Server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user information
 * @access  Private
 */
router.get('/me', (req, res) => {
  try {
    // Get token from cookie instead of Authorization header
    const token = req.cookies.accessToken;
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'yoursecretkey');

    const db = req.app.locals.db;

    // Helper function to fetch user details
    const getUserDetails = () => {
      return new Promise((resolve, reject) => {
        db.get(
          `SELECT u.user_id, u.username, u.customer_number as CustomerNumber, 
                u.role, c.AccountName 
           FROM users u 
           JOIN customers c ON u.customer_number = c.CustomerNumber 
           WHERE u.customer_number = ?`,
          [decoded.customerNumber || decoded.id],
          (err, user) => {
            if (err) reject(err);
            else if (user) {
              resolve(user);
            } else {
              // Fallback to customers table for legacy users
              db.get(
                'SELECT CustomerNumber, AccountName, role FROM customers WHERE CustomerNumber = ?',
                [decoded.id],
                (err, customer) => {
                  if (err) reject(err);
                  else resolve(customer);
                }
              );
            }
          }
        );
      });
    };

    getUserDetails()
      .then((user) => {
        if (!user) {
          return res.status(404).json({
            error: 'User not found',
            message: 'The user associated with this token no longer exists.',
          });
        }

        res.json({
          id: user.CustomerNumber,
          name: user.AccountName,
          role: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase() : 'Customer',
          customerNumber: user.CustomerNumber,
          username: user.username
        });
      })
      .catch((err) => {
        console.error('Database error:', err);
        res.status(500).json({
          error: 'Server error',
          message: 'Error retrieving user data.',
        });
      });
  } catch (err) {
    console.error('Auth check error:', err);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please log in again.',
      });
    }

    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid authentication token.',
    });
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (but requires refresh token cookie)
 */
router.post('/refresh', async (req, res) => {
  // Get refresh token from cookie
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    return res.status(401).json({
      error: 'No refresh token',
      message: 'Refresh token is missing'
    });
  }
  
  try {
    // Get user ID from the expired access token (if present)
    let userId = null;
    const accessToken = req.cookies.accessToken;
    
    if (accessToken) {
      try {
        // We just need the ID, so using decode instead of verify is OK here
        const decoded = jwt.decode(accessToken);
        if (decoded && decoded.id) {
          userId = decoded.id;
        }
      } catch (e) {
        // Ignore token decode errors
      }
    }
    
    if (!userId) {
      return res.status(401).json({
        error: 'Cannot identify user',
        message: 'Both access and refresh tokens are required for token refresh'
      });
    }
    
    const db = req.app.locals.db;
    
    // Rotate the refresh token - this validates the old token, revokes it, and creates a new one
    const newRefreshToken = await tokenService.rotateRefreshToken(db, refreshToken, userId);
    
    // Get user details to create a new access token
    const getUserDetails = () => {
      return new Promise((resolve, reject) => {
        db.get(
          `SELECT u.user_id, u.username, u.customer_number as CustomerNumber, 
                u.role, c.AccountName 
           FROM users u 
           JOIN customers c ON u.customer_number = c.CustomerNumber 
           WHERE u.customer_number = ?`,
          [userId],
          (err, user) => {
            if (err) reject(err);
            else if (user) {
              resolve(user);
            } else {
              // Fallback to customers table for legacy users
              db.get(
                'SELECT CustomerNumber, AccountName, role FROM customers WHERE CustomerNumber = ?',
                [userId],
                (err, customer) => {
                  if (err) reject(err);
                  else resolve(customer);
                }
              );
            }
          }
        );
      });
    };

    const user = await getUserDetails();
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The user associated with this token no longer exists.'
      });
    }

    // Normalize role case to match expected route authorization
    const normalizedRole = user.role
      ? user.role.toLowerCase() === 'superadmin'
        ? 'SuperAdmin'
        : user.role.toLowerCase() === 'driver'
        ? 'Driver'
        : user.role.toLowerCase() === 'admin'
        ? 'Admin'
        : 'Customer'
      : 'Customer';

    // Create new payload for access token
    const payload = {
      id: user.CustomerNumber,
      name: user.AccountName,
      role: normalizedRole,
      customerNumber: user.CustomerNumber,
      username: user.username
    };

    // Create new access token
    const newAccessToken = tokenService.generateAccessToken(payload);

    // Set the new tokens in cookies
    setAuthCookies(res, newAccessToken, newRefreshToken);

    // Return success with user info
    res.json({
      success: true,
      user: {
        id: user.CustomerNumber,
        customerNumber: user.CustomerNumber,
        name: user.AccountName,
        role: normalizedRole,
        username: user.username
      }
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    
    // Clear auth cookies on error
    clearAuthCookies(res);
    
    return res.status(401).json({
      error: 'Invalid refresh token',
      message: 'Your session has expired. Please log in again.'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout by clearing authentication cookies and revoking refresh tokens
 * @access  Public
 */
router.post('/logout', async (req, res) => {
  try {
    // Get user ID from the access token if present
    const accessToken = req.cookies.accessToken;
    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken);
        if (decoded && decoded.id) {
          // Revoke all refresh tokens for this user
          await tokenService.revokeAllUserTokens(req.app.locals.db, decoded.id);
        }
      } catch (e) {
        // Ignore token decode errors
        console.error('Error decoding token during logout:', e);
      }
    }
    
    // Clear the auth cookies
    clearAuthCookies(res);
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    // Still clear cookies even if revoking tokens failed
    clearAuthCookies(res);
    res.json({ success: true, message: 'Logged out successfully' });
  }
});

module.exports = router;
