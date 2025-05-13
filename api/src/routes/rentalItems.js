// src/routes/rentalItems.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
// Apply auth middleware to all routes
router.use(authenticate);

/**
 * @route   GET /api/rental-items/catalog
 * @desc    Get all rental items catalog
 * @access  Private
 */
router.get('/catalog', (req, res) => {
  const db = req.app.locals.db;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const category = req.query.category;

  let query = `
    SELECT item_id, description, category, is_active, standardization_score
    FROM rental_items_catalog
    WHERE is_active = 1
  `;

  const params = [];

  // Add search filter if provided
  if (search) {
    query += ` AND description LIKE ?`;
    params.push(`%${search}%`);
  }

  // Add category filter if provided
  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }

  // Count total items for pagination
  db.get(`SELECT COUNT(*) as total FROM rental_items_catalog WHERE is_active = 1
    ${search ? ' AND description LIKE ?' : ''}
    ${category ? ' AND category = ?' : ''}`,
    params, 
    (err, count) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      // Add pagination and ordering by standardization score descending
      query += ` ORDER BY standardization_score DESC, description LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      // Get paginated items
      db.all(query, params, (err, items) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Database error' });
        }

        res.json({
          items,
          page,
          limit,
          total: count.total,
          total_pages: Math.ceil(count.total / limit)
        });
      });
    }
  );
});

/**
 * @route   GET /api/rental-items/customer/:id
 * @desc    Get rental items for a specific customer
 * @access  Private
 */
router.get('/customer/:id', (req, res) => {
  const db = req.app.locals.db;
  const customerId = req.params.id;

  // First check if customer exists
  db.get('SELECT CustomerNumber, RouteNumber FROM customers WHERE CustomerNumber = ?', 
    [customerId], 
    (err, customer) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // If not SuperAdmin, check if customer is on driver's route
      if (req.user.role !== 'SuperAdmin') {
        db.get('SELECT route_number FROM drivers WHERE driver_id = ?', [req.user.id], (err, driver) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }

          if (!driver || driver.route_number !== customer.RouteNumber) {
            return res.status(403).json({ message: 'Not authorized to view this customer' });
          }

          // Get customer rental items
          fetchRentalItems();
        });
      } else {
        // SuperAdmin can see any customer's items
        fetchRentalItems();
      }

      function fetchRentalItems() {
        db.all(`
          SELECT cri.id, cri.item_id, cri.description, cri.quantity_used, 
                 cri.delivery_frequency, cri.delivery_day, cri.billing_frequency,
                 cri.customer_price, cri.unit_price, ric.category, ric.standardization_score
          FROM customer_rental_items cri
          LEFT JOIN rental_items_catalog ric ON cri.item_id = ric.item_id
          WHERE cri.CustomerNumber = ?
          ORDER BY cri.description
        `, [customerId], (err, items) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }

          res.json({ items });
        });
      }
    }
  );
});

/**
 * @route   POST /api/rental-items/customer/:id
 * @desc    Add rental item to customer
 * @access  Private
 */
router.post('/customer/:id', (req, res) => {
  const db = req.app.locals.db;
  const customerId = req.params.id;
  const { 
    item_id, description, quantity_used, delivery_frequency,
    delivery_day, billing_frequency, customer_price, unit_price
  } = req.body;

  // Validate required fields
  if (!item_id || !description || !quantity_used) {
    return res.status(400).json({ message: 'Item ID, description, and quantity are required' });
  }

  // First check if customer exists
  db.get('SELECT CustomerNumber, RouteNumber FROM customers WHERE CustomerNumber = ?', 
    [customerId], 
    (err, customer) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // If not SuperAdmin, check if customer is on driver's route
      if (req.user.role !== 'SuperAdmin') {
        db.get('SELECT route_number FROM drivers WHERE driver_id = ?', [req.user.id], (err, driver) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }

          if (!driver || driver.route_number !== customer.RouteNumber) {
            return res.status(403).json({ message: 'Not authorized to update this customer' });
          }

          // Add rental item to customer
          addRentalItem();
        });
      } else {
        // SuperAdmin can update any customer
        addRentalItem();
      }

      function addRentalItem() {
        // Check if the item already exists for this customer
        db.get(`
          SELECT id FROM customer_rental_items 
          WHERE CustomerNumber = ? AND item_id = ?
        `, [customerId, item_id], (err, existingItem) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }

          if (existingItem) {
            return res.status(400).json({ message: 'Item already exists for this customer' });
          }

          // Insert new rental item for customer
          db.run(`
            INSERT INTO customer_rental_items 
            (CustomerNumber, item_id, description, quantity_used, delivery_frequency,
             delivery_day, billing_frequency, customer_price, unit_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            customerId, item_id, description, quantity_used, 
            delivery_frequency || 'Weekly', delivery_day || 1, 
            billing_frequency || 'Monthly', customer_price || null, unit_price || null
          ], function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Database error' });
            }

            // Update the route_load_summary table
            updateLoadSummary();

            // Return the newly created item ID
            res.status(201).json({ 
              message: 'Item added successfully',
              id: this.lastID
            });
          });
        });
      }

      function updateLoadSummary() {
        // Get the route's service day
        db.get('SELECT ServiceDay FROM routes WHERE RouteNumber = ?', [customer.RouteNumber], (err, route) => {
          if (err || !route) {
            console.error('Error finding route:', err);
            return; // Don't fail the whole request if this part fails
          }

          // Check if load summary already exists for this route/item
          db.get(`
            SELECT id FROM route_load_summary
            WHERE RouteNumber = ? AND ServiceDay = ? AND item_id = ?
          `, [customer.RouteNumber, route.ServiceDay, item_id], (err, existing) => {
            if (err) {
              console.error('Error checking load summary:', err);
              return;
            }

            if (existing) {
              // Update existing load summary
              db.run(`
                UPDATE route_load_summary
                SET total_quantity = total_quantity + ?
                WHERE id = ?
              `, [quantity_used, existing.id], (err) => {
                if (err) console.error('Error updating load summary:', err);
              });
            } else {
              // Create new load summary
              db.run(`
                INSERT INTO route_load_summary
                (RouteNumber, ServiceDay, item_id, description, total_quantity)
                VALUES (?, ?, ?, ?, ?)
              `, [customer.RouteNumber, route.ServiceDay, item_id, description, quantity_used], (err) => {
                if (err) console.error('Error creating load summary:', err);
              });
            }
          });
        });
      }
    }
  );
});

/**
 * @route   PUT /api/rental-items/customer/:customerId/item/:itemId
 * @desc    Update customer rental item
 * @access  Private
 */
router.put('/customer/:customerId/item/:itemId', (req, res) => {
  const db = req.app.locals.db;
  const customerId = req.params.customerId;
  const itemId = req.params.itemId;
  const { 
    quantity_used, delivery_frequency, delivery_day,
    billing_frequency, customer_price, unit_price
  } = req.body;

  // Validate required fields
  if (quantity_used === undefined) {
    return res.status(400).json({ message: 'Quantity is required' });
  }

  // First check if customer exists
  db.get('SELECT CustomerNumber, RouteNumber FROM customers WHERE CustomerNumber = ?', 
    [customerId], 
    (err, customer) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // If not SuperAdmin, check if customer is on driver's route
      if (req.user.role !== 'SuperAdmin') {
        db.get('SELECT route_number FROM drivers WHERE driver_id = ?', [req.user.id], (err, driver) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }

          if (!driver || driver.route_number !== customer.RouteNumber) {
            return res.status(403).json({ message: 'Not authorized to update this customer' });
          }

          // Update rental item
          updateRentalItem();
        });
      } else {
        // SuperAdmin can update any customer
        updateRentalItem();
      }

      function updateRentalItem() {
        // Begin transaction
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          // Get current quantity to calculate difference
          db.get(`
            SELECT quantity_used, item_id, description
            FROM customer_rental_items 
            WHERE id = ? AND CustomerNumber = ?
          `, [itemId, customerId], (err, item) => {
            if (err) {
              console.error('Database error:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ message: 'Database error' });
            }

            if (!item) {
              db.run('ROLLBACK');
              return res.status(404).json({ message: 'Item not found' });
            }

            // Build update query parts
            let query = 'UPDATE customer_rental_items SET';
            const params = [];
            
            // Add fields to update
            if (quantity_used !== undefined) {
              query += ' quantity_used = ?,';
              params.push(quantity_used);
            }
            
            if (delivery_frequency) {
              query += ' delivery_frequency = ?,';
              params.push(delivery_frequency);
            }
            
            if (delivery_day) {
              query += ' delivery_day = ?,';
              params.push(delivery_day);
            }
            
            if (billing_frequency) {
              query += ' billing_frequency = ?,';
              params.push(billing_frequency);
            }
            
            if (customer_price !== undefined) {
              query += ' customer_price = ?,';
              params.push(customer_price);
            }
            
            if (unit_price !== undefined) {
              query += ' unit_price = ?,';
              params.push(unit_price);
            }
            
            // Remove trailing comma and add WHERE clause
            query = query.slice(0, -1) + ' WHERE id = ? AND CustomerNumber = ?';
            params.push(itemId, customerId);
            
            // Execute update query
            db.run(query, params, function(err) {
              if (err) {
                console.error('Database error:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Error updating rental item' });
              }
              
              if (this.changes === 0) {
                db.run('ROLLBACK');
                return res.status(404).json({ message: 'Item not found' });
              }
              
              // If quantity changed, update route load summary
              if (quantity_used !== undefined) {
                const quantityDifference = quantity_used - item.quantity_used;
                
                if (quantityDifference !== 0) {
                  updateLoadSummary(item.item_id, item.description, quantityDifference);
                } else {
                  // No quantity change, commit now
                  db.run('COMMIT');
                  res.json({
                    message: 'Rental item updated successfully',
                    id: itemId
                  });
                }
              } else {
                // No quantity update, commit now
                db.run('COMMIT');
                res.json({
                  message: 'Rental item updated successfully',
                  id: itemId
                });
              }
            });
          });
        });
      }

      function updateLoadSummary(itemId, description, quantityDifference) {
        // Get the route's service day
        db.get('SELECT ServiceDay FROM routes WHERE RouteNumber = ?', [customer.RouteNumber], (err, route) => {
          if (err || !route) {
            console.error('Error finding route:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Error updating load summary' });
          }

          // Update route load summary
          db.get(`
            SELECT id, total_quantity FROM route_load_summary
            WHERE RouteNumber = ? AND ServiceDay = ? AND item_id = ?
          `, [customer.RouteNumber, route.ServiceDay, itemId], (err, summary) => {
            if (err) {
              console.error('Error checking load summary:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ message: 'Error updating load summary' });
            }

            if (summary) {
              // Update existing summary
              const newTotal = summary.total_quantity + quantityDifference;
              
              if (newTotal <= 0) {
                // If new total is zero or negative, remove the entry
                db.run(`
                  DELETE FROM route_load_summary
                  WHERE id = ?
                `, [summary.id], (err) => {
                  if (err) {
                    console.error('Error removing load summary:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ message: 'Error updating load summary' });
                  }
                  
                  db.run('COMMIT');
                  res.json({
                    message: 'Rental item updated successfully',
                    id: itemId
                  });
                });
              } else {
                // Update with new total
                db.run(`
                  UPDATE route_load_summary
                  SET total_quantity = ?
                  WHERE id = ?
                `, [newTotal, summary.id], (err) => {
                  if (err) {
                    console.error('Error updating load summary:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ message: 'Error updating load summary' });
                  }
                  
                  db.run('COMMIT');
                  res.json({
                    message: 'Rental item updated successfully',
                    id: itemId
                  });
                });
              }
            } else if (quantityDifference > 0) {
              // Create new summary if it doesn't exist and the difference is positive
              db.run(`
                INSERT INTO route_load_summary
                (RouteNumber, ServiceDay, item_id, description, total_quantity)
                VALUES (?, ?, ?, ?, ?)
              `, [customer.RouteNumber, route.ServiceDay, itemId, description, quantityDifference], (err) => {
                if (err) {
                  console.error('Error creating load summary:', err);
                  db.run('ROLLBACK');
                  return res.status(500).json({ message: 'Error updating load summary' });
                }
                
                db.run('COMMIT');
                res.json({
                  message: 'Rental item updated successfully',
                  id: itemId
                });
              });
            } else {
              // No existing summary and no positive difference, just commit
              db.run('COMMIT');
              res.json({
                message: 'Rental item updated successfully',
                id: itemId
              });
            }
          });
        });
      }
    }
  );
});

/**
 * @route   DELETE /api/rental-items/customer/:customerId/item/:itemId
 * @desc    Delete customer rental item
 * @access  Private
 */
router.delete('/customer/:customerId/item/:itemId', (req, res) => {
  const db = req.app.locals.db;
  const customerId = req.params.customerId;
  const itemId = req.params.itemId;

  // First check if customer exists
  db.get('SELECT CustomerNumber, RouteNumber FROM customers WHERE CustomerNumber = ?', 
    [customerId], 
    (err, customer) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // If not SuperAdmin, check if customer is on driver's route
      if (req.user.role !== 'SuperAdmin') {
        db.get('SELECT route_number FROM drivers WHERE driver_id = ?', [req.user.id], (err, driver) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }

          if (!driver || driver.route_number !== customer.RouteNumber) {
            return res.status(403).json({ message: 'Not authorized to update this customer' });
          }

          // Delete rental item
          deleteRentalItem();
        });
      } else {
        // SuperAdmin can update any customer
        deleteRentalItem();
      }

      function deleteRentalItem() {
        // Begin transaction
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          // Get item details before deleting
          db.get(`
            SELECT item_id, description, quantity_used
            FROM customer_rental_items 
            WHERE id = ? AND CustomerNumber = ?
          `, [itemId, customerId], (err, item) => {
            if (err) {
              console.error('Database error:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ message: 'Database error' });
            }

            if (!item) {
              db.run('ROLLBACK');
              return res.status(404).json({ message: 'Item not found' });
            }

            // Delete the item
            db.run(`
              DELETE FROM customer_rental_items
              WHERE id = ? AND CustomerNumber = ?
            `, [itemId, customerId], function(err) {
              if (err) {
                console.error('Database error:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Error deleting rental item' });
              }

              if (this.changes === 0) {
                db.run('ROLLBACK');
                return res.status(404).json({ message: 'Item not found' });
              }

              // Update route load summary
              updateLoadSummary(item.item_id, item.description, -item.quantity_used);
            });
          });
        });
      }

      function updateLoadSummary(itemId, description, quantityChange) {
        // Get the route's service day
        db.get('SELECT ServiceDay FROM routes WHERE RouteNumber = ?', [customer.RouteNumber], (err, route) => {
          if (err || !route) {
            console.error('Error finding route:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Error updating load summary' });
          }

          // Update route load summary
          db.get(`
            SELECT id, total_quantity FROM route_load_summary
            WHERE RouteNumber = ? AND ServiceDay = ? AND item_id = ?
          `, [customer.RouteNumber, route.ServiceDay, itemId], (err, summary) => {
            if (err) {
              console.error('Error checking load summary:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ message: 'Error updating load summary' });
            }

            if (summary) {
              // Calculate new total
              const newTotal = summary.total_quantity + quantityChange;
              
              if (newTotal <= 0) {
                // Delete the route load entry if total becomes zero or negative
                db.run(`
                  DELETE FROM route_load_summary
                  WHERE id = ?
                `, [summary.id], (err) => {
                  if (err) {
                    console.error('Error removing load summary:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ message: 'Error updating load summary' });
                  }
                  
                  db.run('COMMIT');
                  res.json({
                    message: 'Rental item deleted successfully'
                  });
                });
              } else {
                // Update with new total
                db.run(`
                  UPDATE route_load_summary
                  SET total_quantity = ?
                  WHERE id = ?
                `, [newTotal, summary.id], (err) => {
                  if (err) {
                    console.error('Error updating load summary:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ message: 'Error updating load summary' });
                  }
                  
                  db.run('COMMIT');
                  res.json({
                    message: 'Rental item deleted successfully'
                  });
                });
              }
            } else {
              // No load summary to update, just commit
              db.run('COMMIT');
              res.json({
                message: 'Rental item deleted successfully'
              });
            }
          });
        });
      }
    }
  );
});

/**
 * @route   GET /api/rental-items/route/:routeNumber/loadlist
 * @desc    Get load list for a route
 * @access  Private
 */
router.get('/route/:routeNumber/loadlist', (req, res) => {
  const db = req.app.locals.db;
  const routeNumber = req.params.routeNumber;
  const { day } = req.query;

  // Users can only view their own route's load list unless they're SuperAdmin
  if (req.user.role !== 'SuperAdmin' && req.user.route !== routeNumber) {
    return res.status(403).json({ message: 'Not authorized to view this route' });
  }

  // Get the service day if not provided
  let serviceDay = day;
  if (!serviceDay) {
    // Get the default service day for this route
    db.get('SELECT ServiceDay FROM routes WHERE RouteNumber = ?', [routeNumber], (err, route) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (!route) {
        return res.status(404).json({ message: 'Route not found' });
      }

      serviceDay = route.ServiceDay;
      getLoadList();
    });
  } else {
    getLoadList();
  }

  function getLoadList() {
    // Get load list for the route and day
    db.all(`
      SELECT 
        rls.item_id, rls.description, rls.total_quantity,
        ric.category, ric.standardization_score
      FROM route_load_summary rls
      LEFT JOIN rental_items_catalog ric ON rls.item_id = ric.item_id
      WHERE rls.RouteNumber = ? AND rls.ServiceDay = ?
      ORDER BY ric.category, rls.description
    `, [routeNumber, serviceDay], (err, items) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      // Get route details
      db.get(`
        SELECT RouteNumber, ServiceDay, DriverName
        FROM routes 
        WHERE RouteNumber = ?
      `, [routeNumber], (err, route) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Database error' });
        }

        if (!route) {
          return res.status(404).json({ message: 'Route not found' });
        }

        // Group items by category
        const groupedItems = {};
        items.forEach(item => {
          const category = item.category || 'Uncategorized';
          if (!groupedItems[category]) {
            groupedItems[category] = [];
          }
          groupedItems[category].push(item);
        });

        res.json({
          route: route.RouteNumber,
          service_day: serviceDay,
          driver_name: route.DriverName,
          categories: Object.keys(groupedItems).map(category => ({
            name: category,
            items: groupedItems[category]
          })),
          total_items: items.length,
          total_pieces: items.reduce((sum, item) => sum + item.total_quantity, 0)
        });
      });
    });
  }
});

module.exports = router;
