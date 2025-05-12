// routes/customers.js - Customer Routes
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/customers
 * @desc    Get all customers (with filtering & pagination)
 * @access  Private (Driver, SuperAdmin)
 */
router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { search, route, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Base query
    let query = `
      SELECT 
        c.CustomerNumber, c.AccountName, c.Address, c.City, 
        c.State, c.ZipCode, c.RouteNumber, c.ServiceFrequency, 
        c.ServiceDays, c.Email, c.Phone, c.CreatedAt
      FROM customers c
    `;
    
    const params = [];
    const countParams = [];
    let whereClause = '';
    
    // Filter by route - if user is not SuperAdmin, restrict to their route
    if (req.user.role !== 'SuperAdmin') {
      whereClause += ' WHERE c.RouteNumber = ?';
      params.push(req.user.route);
      countParams.push(req.user.route);
    } else if (route) {
      // SuperAdmin can filter by specific route
      whereClause += ' WHERE c.RouteNumber = ?';
      params.push(route);
      countParams.push(route);
    }
    
    // Add search filter if provided
    if (search) {
      // Use FTS if available
      const searchCondition = `c.CustomerNumber IN (
        SELECT rowid FROM customers_fts 
        WHERE customers_fts MATCH ?
      )`;
      
      if (whereClause === '') {
        whereClause = ` WHERE ${searchCondition}`;
      } else {
        whereClause += ` AND ${searchCondition}`;
      }
      
      // Use * as wildcard for partial matching
      params.push(`${search}*`);
      countParams.push(`${search}*`);
    }
    
    // Complete the query with pagination
    const completeQuery = `${query}${whereClause} ORDER BY c.AccountName LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    // Count total results for pagination
    const countQuery = `SELECT COUNT(*) as total FROM customers c${whereClause}`;
    
    // Execute count query first
    db.get(countQuery, countParams, (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Server error',
          message: 'Error retrieving customer count' 
        });
      }
      
      const total = result ? result.total : 0;
      const totalPages = Math.ceil(total / limit);
      
      // Then execute the main query
      db.all(completeQuery, params, (err, customers) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Server error',
            message: 'Error retrieving customers' 
          });
        }
        
        res.json({
          customers,
          pagination: {
            total,
            totalPages,
            currentPage: parseInt(page),
            perPage: parseInt(limit)
          }
        });
      });
    });
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error retrieving customers' 
    });
  }
});

/**
 * @route   GET /api/customers/:id
 * @desc    Get single customer by ID
 * @access  Private (Driver, SuperAdmin)
 */
router.get('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const customerId = req.params.id;
    
    // Query for the customer
    let query = `
      SELECT 
        c.CustomerNumber, c.AccountName, c.Address, c.City, 
        c.State, c.ZipCode, c.RouteNumber, c.ServiceFrequency, 
        c.ServiceDays, c.Email, c.Phone, c.CreatedAt
      FROM customers c
      WHERE c.CustomerNumber = ?
    `;
    
    // Non-SuperAdmin users can only view customers on their route
    if (req.user.role !== 'SuperAdmin') {
      query += ' AND c.RouteNumber = ?';
    }
    
    const params = [customerId];
    if (req.user.role !== 'SuperAdmin') {
      params.push(req.user.route);
    }
    
    db.get(query, params, (err, customer) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Server error',
          message: 'Error retrieving customer' 
        });
      }
      
      if (!customer) {
        return res.status(404).json({ 
          error: 'Not found',
          message: 'Customer not found' 
        });
      }
      
      res.json(customer);
    });
  } catch (err) {
    console.error('Get customer error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error retrieving customer' 
    });
  }
});

/**
 * @route   POST /api/customers
 * @desc    Create a new customer
 * @access  Private (Driver, SuperAdmin)
 */
router.post('/', (req, res) => {
  try {
    const {
      AccountName,
      Address,
      City,
      State,
      ZipCode,
      RouteNumber,
      ServiceFrequency,
      ServiceDays,
      Email,
      Phone
    } = req.body;
    
    // Validate required fields
    if (!AccountName) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Customer name is required' 
      });
    }
    
    const db = req.app.locals.db;
    
    // Non-SuperAdmin users can only create customers for their route
    let routeToUse = RouteNumber;
    if (req.user.role !== 'SuperAdmin') {
      routeToUse = req.user.route;
    }
    
    // Insert the new customer
    db.run(
      `INSERT INTO customers (
        AccountName, Address, City, State, ZipCode, 
        RouteNumber, ServiceFrequency, ServiceDays, Email, Phone, CreatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        AccountName,
        Address || '',
        City || '',
        State || '',
        ZipCode || '',
        routeToUse,
        ServiceFrequency || 'Weekly',
        ServiceDays || '',
        Email || null,
        Phone || null
      ],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Server error',
            message: 'Error creating customer' 
          });
        }
        
        // Get the newly created customer
        db.get(
          `SELECT 
            CustomerNumber, AccountName, Address, City, 
            State, ZipCode, RouteNumber, ServiceFrequency, 
            ServiceDays, Email, Phone, CreatedAt 
          FROM customers 
          WHERE CustomerNumber = ?`,
          [this.lastID],
          (err, customer) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ 
                error: 'Server error',
                message: 'Error retrieving created customer' 
              });
            }
            
            // Update FTS index
            db.run(
              'INSERT INTO customers_fts(rowid, AccountName) VALUES (?, ?)',
              [this.lastID, AccountName],
              (err) => {
                if (err) {
                  console.error('Error updating FTS index:', err);
                  // Continue anyway, as the main data is inserted
                }
                
                res.status(201).json(customer);
              }
            );
          }
        );
      }
    );
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error creating customer' 
    });
  }
});

/**
 * @route   PUT /api/customers/:id
 * @desc    Update a customer
 * @access  Private (Driver, SuperAdmin)
 */
router.put('/:id', (req, res) => {
  try {
    const customerId = req.params.id;
    const {
      AccountName,
      Address,
      City,
      State,
      ZipCode,
      RouteNumber,
      ServiceFrequency,
      ServiceDays,
      Email,
      Phone
    } = req.body;
    
    // Validate required fields
    if (!AccountName) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Customer name is required' 
      });
    }
    
    const db = req.app.locals.db;
    
    // First check if the customer exists and user has permission
    let query = 'SELECT RouteNumber FROM customers WHERE CustomerNumber = ?';
    const params = [customerId];
    
    db.get(query, params, (err, customer) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Server error',
          message: 'Error retrieving customer' 
        });
      }
      
      if (!customer) {
        return res.status(404).json({ 
          error: 'Not found',
          message: 'Customer not found' 
        });
      }
      
      // Non-SuperAdmin can only edit customers on their route
      if (req.user.role !== 'SuperAdmin' && customer.RouteNumber !== req.user.route) {
        return res.status(403).json({ 
          error: 'Permission denied',
          message: 'You do not have permission to edit this customer' 
        });
      }
      
      // Determine route number to use
      let routeToUse = RouteNumber;
      if (req.user.role !== 'SuperAdmin') {
        // Non-SuperAdmin cannot change the route
        routeToUse = customer.RouteNumber;
      }
      
      // Update the customer
      db.run(
        `UPDATE customers SET
          AccountName = ?,
          Address = ?,
          City = ?,
          State = ?,
          ZipCode = ?,
          RouteNumber = ?,
          ServiceFrequency = ?,
          ServiceDays = ?,
          Email = ?,
          Phone = ?
        WHERE CustomerNumber = ?`,
        [
          AccountName,
          Address || '',
          City || '',
          State || '',
          ZipCode || '',
          routeToUse,
          ServiceFrequency || 'Weekly',
          ServiceDays || '',
          Email || null,
          Phone || null,
          customerId
        ],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
              error: 'Server error',
              message: 'Error updating customer' 
            });
          }
          
          // Update FTS index
          db.run(
            'UPDATE customers_fts SET AccountName = ? WHERE rowid = ?',
            [AccountName, customerId],
            (err) => {
              if (err) {
                console.error('Error updating FTS index:', err);
              }
              
              // Get the updated customer
              db.get(
                `SELECT 
                  CustomerNumber, AccountName, Address, City, 
                  State, ZipCode, RouteNumber, ServiceFrequency, 
                  ServiceDays, Email, Phone, CreatedAt
                FROM customers 
                WHERE CustomerNumber = ?`,
                [customerId],
                (err, customer) => {
                  if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ 
                      error: 'Server error',
                      message: 'Error retrieving updated customer' 
                    });
                  }
                  
                  res.json(customer);
                }
              );
            }
          );
        }
      );
    });
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error updating customer' 
    });
  }
});

/**
 * @route   DELETE /api/customers/:id
 * @desc    Delete a customer
 * @access  Private (SuperAdmin only)
 */
router.delete('/:id', authorize(['SuperAdmin']), (req, res) => {
  try {
    const customerId = req.params.id;
    const db = req.app.locals.db;
    
    // Begin transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Delete from FTS index first
      db.run('DELETE FROM customers_fts WHERE rowid = ?', [customerId], (err) => {
        if (err) {
          console.error('Error deleting from FTS index:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ 
            error: 'Server error',
            message: 'Error removing customer from search index' 
          });
        }
        
        // Delete customer
        db.run('DELETE FROM customers WHERE CustomerNumber = ?', [customerId], function(err) {
          if (err) {
            console.error('Database error:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ 
              error: 'Server error',
              message: 'Error deleting customer' 
            });
          }
          
          if (this.changes === 0) {
            db.run('ROLLBACK');
            return res.status(404).json({ 
              error: 'Not found',
              message: 'Customer not found' 
            });
          }
          
          db.run('COMMIT');
          res.json({ 
            success: true,
            message: 'Customer deleted successfully' 
          });
        });
      });
    });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error deleting customer' 
    });
  }
});

/**
 * @route   GET /api/customers/:id/rental-items
 * @desc    Get all rental items for a customer
 * @access  Private (Driver, SuperAdmin)
 */
router.get('/:id/rental-items', (req, res) => {
  try {
    const customerId = req.params.id;
    const db = req.app.locals.db;
    
    // First verify the customer exists and user has permission
    let customerQuery = 'SELECT RouteNumber FROM customers WHERE CustomerNumber = ?';
    
    db.get(customerQuery, [customerId], (err, customer) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Server error',
          message: 'Error retrieving customer' 
        });
      }
      
      if (!customer) {
        return res.status(404).json({ 
          error: 'Not found',
          message: 'Customer not found' 
        });
      }
      
      // Non-SuperAdmin can only view customers on their route
      if (req.user.role !== 'SuperAdmin' && customer.RouteNumber !== req.user.route) {
        return res.status(403).json({ 
          error: 'Permission denied',
          message: 'You do not have permission to view this customer' 
        });
      }
      
      // Get rental items for the customer
      db.all(
        `SELECT 
          cri.*, ric.standardization_score
        FROM 
          customer_rental_items cri
        JOIN
          rental_items_catalog ric ON cri.item_id = ric.item_id
        WHERE 
          cri.CustomerNumber = ?
        ORDER BY 
          cri.description`,
        [customerId],
        (err, items) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
              error: 'Server error',
              message: 'Error retrieving rental items' 
            });
          }
          
          res.json({ items });
        }
      );
    });
  } catch (err) {
    console.error('Get rental items error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error retrieving rental items' 
    });
  }
});

module.exports = router;
