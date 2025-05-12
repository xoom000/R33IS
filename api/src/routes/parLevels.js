// src/routes/parLevels.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authenticate);

/**
 * @route   GET /api/par-levels/customer/:id
 * @desc    Get par levels for a customer
 * @access  Private
 */
router.get('/customer/:id', (req, res) => {
  const db = req.app.locals.db;
  const customerId = req.params.id;

  // First check if customer exists and user has permission
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

          // Get par levels
          getParLevels();
        });
      } else {
        // SuperAdmin can see any customer's par levels
        getParLevels();
      }

      function getParLevels() {
        db.all(`
          SELECT 
            cpl.sku, ds.name, ds.description, ds.base_price, 
            ds.category_id, c.name as category_name,
            cpl.par_level, cpl.date_updated
          FROM customer_par_levels cpl
          JOIN direct_sales ds ON cpl.sku = ds.sku
          LEFT JOIN categories c ON ds.category_id = c.id
          WHERE cpl.customer_number = ?
          ORDER BY ds.name
        `, [customerId], (err, parLevels) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }

          res.json({ par_levels: parLevels });
        });
      }
    }
  );
});

/**
 * @route   PUT /api/par-levels/customer/:id
 * @desc    Update par levels for a customer
 * @access  Private
 */
router.put('/customer/:id', (req, res) => {
  const db = req.app.locals.db;
  const customerId = req.params.id;
  const { levels } = req.body;

  // Validate request
  if (!levels || !Array.isArray(levels)) {
    return res.status(400).json({ message: 'Par levels array is required' });
  }

  // Validate each par level entry
  for (const level of levels) {
    if (!level.sku || level.par_level === undefined || level.par_level < 0) {
      return res.status(400).json({ 
        message: 'Each level must have a valid sku and non-negative par_level' 
      });
    }
  }

  // First check if customer exists and user has permission
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

          // Update par levels
          updateParLevels();
        });
      } else {
        // SuperAdmin can update any customer's par levels
        updateParLevels();
      }

      function updateParLevels() {
        // Begin transaction
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          // Prepare statement for inserting/updating par levels
          const stmt = db.prepare(`
            INSERT INTO customer_par_levels (customer_number, sku, par_level, date_updated)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(customer_number, sku) 
            DO UPDATE SET par_level = excluded.par_level, date_updated = excluded.date_updated
          `);

          // Process each par level entry
          let hasError = false;
          levels.forEach(level => {
            stmt.run([customerId, level.sku, level.par_level], err => {
              if (err) {
                console.error('Error updating par level:', err);
                hasError = true;
              }
            });
          });

          // Finalize prepared statement
          stmt.finalize();

          // Commit or rollback
          if (hasError) {
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Error updating par levels' });
          } else {
            db.run('COMMIT');
            return res.json({ 
              message: 'Par levels updated successfully',
              updated_count: levels.length
            });
          }
        });
      }
    }
  );
});

/**
 * @route   DELETE /api/par-levels/customer/:customerId/product/:sku
 * @desc    Delete a par level for a customer
 * @access  Private
 */
router.delete('/customer/:customerId/product/:sku', (req, res) => {
  const db = req.app.locals.db;
  const customerId = req.params.customerId;
  const sku = req.params.sku;

  // First check if customer exists and user has permission
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

          // Delete par level
          deleteParLevel();
        });
      } else {
        // SuperAdmin can delete any customer's par level
        deleteParLevel();
      }

      function deleteParLevel() {
        db.run(`
          DELETE FROM customer_par_levels
          WHERE customer_number = ? AND sku = ?
        `, [customerId, sku], function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }

          if (this.changes === 0) {
            return res.status(404).json({ message: 'Par level not found' });
          }

          res.json({
            message: 'Par level deleted successfully',
            customer_number: customerId,
            sku
          });
        });
      }
    }
  );
});

/**
 * @route   GET /api/par-levels/suggested-order/:id
 * @desc    Get suggested order based on par levels for a customer
 * @access  Private
 */
router.get('/suggested-order/:id', (req, res) => {
  const db = req.app.locals.db;
  const customerId = req.params.id;

  // First check if customer exists and user has permission
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

          // Get suggested order
          getSuggestedOrder();
        });
      } else {
        // SuperAdmin can see any customer's suggested order
        getSuggestedOrder();
      }

      function getSuggestedOrder() {
        // Get par levels and last order data
        db.all(`
          WITH last_orders AS (
            SELECT 
              oi.sku,
              oi.quantity,
              o.submitted_at
            FROM order_items oi
            JOIN order_requests o ON oi.order_id = o.order_id
            WHERE o.customer_number = ? AND o.status = 'Approved'
            ORDER BY o.submitted_at DESC
          ),
          latest_order AS (
            SELECT
              sku,
              quantity,
              submitted_at,
              ROW_NUMBER() OVER (PARTITION BY sku ORDER BY submitted_at DESC) as rn
            FROM last_orders
          )
          SELECT 
            cpl.sku,
            ds.name,
            ds.description,
            ds.base_price,
            cpl.par_level,
            lo.quantity as last_order_quantity,
            lo.submitted_at as last_order_date,
            CASE 
              WHEN cpl.par_level > COALESCE(lo.quantity, 0) THEN cpl.par_level - COALESCE(lo.quantity, 0)
              ELSE 0
            END as suggested_quantity
          FROM customer_par_levels cpl
          JOIN direct_sales ds ON cpl.sku = ds.sku
          LEFT JOIN latest_order lo ON cpl.sku = lo.sku AND lo.rn = 1
          WHERE cpl.customer_number = ? AND cpl.par_level > 0
          ORDER BY ds.name
        `, [customerId, customerId], (err, suggestedItems) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }

          // Filter to only include items with suggested quantities
          const suggestedOrder = suggestedItems.filter(item => item.suggested_quantity > 0);

          res.json({ 
            customer_number: customerId,
            suggested_items: suggestedOrder,
            total_items: suggestedOrder.length,
            estimated_total: suggestedOrder.reduce((total, item) => 
              total + (item.base_price * item.suggested_quantity), 0).toFixed(2)
          });
        });
      }
    }
  );
});

module.exports = router;
