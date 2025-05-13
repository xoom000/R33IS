// src/routes/orders.js
const express = require('express');
const router = express.Router();

// Apply auth middleware to all routes
const { authenticate, authorize } = require('../middleware/authMiddleware');
router.use(authenticate);

/**
 * @route   GET /api/orders
 * @desc    Get orders (with filtering & pagination)
 * @access  Private
 */
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status || 'all';
  const customer = req.query.customer;

  // Base query
  let query = `
    SELECT o.order_id, o.customer_number, c.AccountName as customer_name, 
           o.status, o.submitted_at, o.approved_at, o.declined_reason,
           o.driver_id, d.name as driver_name, o.total_amount, o.note
    FROM order_requests o
    JOIN customers c ON o.customer_number = c.CustomerNumber
    JOIN drivers d ON o.driver_id = d.driver_id
    WHERE 1=1
  `;

  const params = [];

  // Add status filter
  if (status !== 'all') {
    query += ` AND o.status = ?`;
    params.push(status);
  }

  // Add customer filter
  if (customer) {
    query += ` AND o.customer_number = ?`;
    params.push(customer);
  }

  // If not SuperAdmin, only show orders for the driver's route customers
  if (req.user.role !== 'SuperAdmin') {
    db.get('SELECT route_number FROM drivers WHERE driver_id = ?', [req.user.id], (err, driver) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      query += ` AND c.RouteNumber = ?`;
      params.push(driver.route_number);

      executeQuery();
    });
  } else {
    // SuperAdmin can see all orders
    executeQuery();
  }

  function executeQuery() {
    // Count total orders for pagination
    db.get(`SELECT COUNT(*) as total FROM (${query})`, params, (err, count) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      // Add pagination and ordering
      query += ` ORDER BY o.submitted_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      // Get paginated orders
      db.all(query, params, (err, orders) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Database error' });
        }

        // Get order items for all orders
        const orderIds = orders.map(order => order.order_id);
        
        if (orderIds.length === 0) {
          return res.json({
            orders: [],
            page,
            limit,
            total: 0,
            total_pages: 0
          });
        }

        const placeholders = orderIds.map(() => '?').join(',');
        
        db.all(`
          SELECT oi.order_id, oi.sku, ds.name, oi.quantity, oi.price_at_order
          FROM order_items oi
          JOIN direct_sales ds ON oi.sku = ds.sku
          WHERE oi.order_id IN (${placeholders})
        `, orderIds, (err, items) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }

          // Group items by order_id
          const itemsByOrder = {};
          items.forEach(item => {
            if (!itemsByOrder[item.order_id]) {
              itemsByOrder[item.order_id] = [];
            }
            itemsByOrder[item.order_id].push(item);
          });

          // Add items to each order
          const ordersWithItems = orders.map(order => ({
            ...order,
            items: itemsByOrder[order.order_id] || []
          }));

          res.json({
            orders: ordersWithItems,
            page,
            limit,
            total: count.total,
            total_pages: Math.ceil(count.total / limit)
          });
        });
      });
    });
  }
});

/**
 * @route   GET /api/orders/pending
 * @desc    Get pending orders
 * @access  Private
 */
router.get('/pending', (req, res) => {
  const db = req.app.locals.db;

  // If not SuperAdmin, only show pending orders for driver's route
  if (req.user.role !== 'SuperAdmin') {
    db.get('SELECT route_number FROM drivers WHERE driver_id = ?', [req.user.id], (err, driver) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      // Get pending orders for driver's route
      db.all(`
        SELECT o.order_id, o.customer_number, c.AccountName as customer_name, 
               o.submitted_at, o.total_amount, o.note
        FROM order_requests o
        JOIN customers c ON o.customer_number = c.CustomerNumber
        WHERE o.status = 'Pending' AND c.RouteNumber = ?
        ORDER BY o.submitted_at DESC
      `, [driver.route_number], (err, orders) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Database error' });
        }

        // Get items for each order
        getOrderItems(orders);
      });
    });
  } else {
    // SuperAdmin can see all pending orders
    db.all(`
      SELECT o.order_id, o.customer_number, c.AccountName as customer_name, 
             o.submitted_at, o.total_amount, o.note
      FROM order_requests o
      JOIN customers c ON o.customer_number = c.CustomerNumber
      WHERE o.status = 'Pending'
      ORDER BY o.submitted_at DESC
    `, [], (err, orders) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      // Get items for each order
      getOrderItems(orders);
    });
  }

  function getOrderItems(orders) {
    if (orders.length === 0) {
      return res.json({ orders: [] });
    }

    const orderIds = orders.map(order => order.order_id);
    const placeholders = orderIds.map(() => '?').join(',');
    
    db.all(`
      SELECT oi.order_id, oi.sku, ds.name, oi.quantity, oi.price_at_order
      FROM order_items oi
      JOIN direct_sales ds ON oi.sku = ds.sku
      WHERE oi.order_id IN (${placeholders})
    `, orderIds, (err, items) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      // Group items by order_id
      const itemsByOrder = {};
      items.forEach(item => {
        if (!itemsByOrder[item.order_id]) {
          itemsByOrder[item.order_id] = [];
        }
        itemsByOrder[item.order_id].push(item);
      });

      // Add items to each order
      const ordersWithItems = orders.map(order => ({
        ...order,
        items: itemsByOrder[order.order_id] || []
      }));

      res.json({ orders: ordersWithItems });
    });
  }
});

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID
 * @access  Private
 */
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const orderId = req.params.id;

  // Get order
  db.get(`
    SELECT o.order_id, o.customer_number, c.AccountName as customer_name, 
           o.status, o.submitted_at, o.approved_at, o.declined_reason,
           o.driver_id, d.name as driver_name, o.total_amount, o.note,
           c.RouteNumber, c.Address, c.City, c.State, c.ZipCode
    FROM order_requests o
    JOIN customers c ON o.customer_number = c.CustomerNumber
    JOIN drivers d ON o.driver_id = d.driver_id
    WHERE o.order_id = ?
  `, [orderId], (err, order) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // If not SuperAdmin, check if order is for a customer on driver's route
    if (req.user.role !== 'SuperAdmin') {
      db.get('SELECT route_number FROM drivers WHERE driver_id = ?', [req.user.id], (err, driver) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Database error' });
        }

        if (!driver || driver.route_number !== order.RouteNumber) {
          return res.status(403).json({ message: 'Not authorized to view this order' });
        }

        // Get order items
        getOrderItems();
      });
    } else {
      // SuperAdmin can see any order
      getOrderItems();
    }

    function getOrderItems() {
      db.all(`
        SELECT oi.sku, ds.name, oi.quantity, oi.price_at_order
        FROM order_items oi
        JOIN direct_sales ds ON oi.sku = ds.sku
        WHERE oi.order_id = ?
      `, [orderId], (err, items) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Database error' });
        }

        // Return complete order data
        res.json({
          ...order,
          items
        });
      });
    }
  });
});

/**
 * @route   POST /api/orders/request
 * @desc    Submit order request
 * @access  Private
 */
router.post('/request', (req, res) => {
  const db = req.app.locals.db;
  const { customer_number, items, note } = req.body;

  // Validate request
  if (!customer_number || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Customer number and items are required' });
  }

  // Check if customer exists
  db.get(`
    SELECT c.CustomerNumber, c.RouteNumber, r.driver_id
    FROM customers c
    JOIN routes r ON c.RouteNumber = r.RouteNumber
    WHERE c.CustomerNumber = ?
  `, [customer_number], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (!result) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const { CustomerNumber, RouteNumber, driver_id } = result;

    // Get driver ID for this route
    db.get('SELECT driver_id FROM drivers WHERE route_number = ?', [RouteNumber], (err, driver) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (!driver) {
        return res.status(404).json({ message: 'No driver assigned to this route' });
      }

      // Begin transaction
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Calculate total amount by getting product prices
        const skus = items.map(item => item.sku);
        const skuPlaceholders = skus.map(() => '?').join(',');

        db.all(`
          SELECT sku, base_price
          FROM direct_sales
          WHERE sku IN (${skuPlaceholders})
        `, skus, (err, products) => {
          if (err) {
            console.error('Database error:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Database error' });
          }

          // Create price lookup
          const priceLookup = {};
          products.forEach(product => {
            priceLookup[product.sku] = product.base_price;
          });

          // Calculate total amount
          let totalAmount = 0;
          for (const item of items) {
            if (!priceLookup[item.sku]) {
              db.run('ROLLBACK');
              return res.status(400).json({ message: `Invalid product SKU: ${item.sku}` });
            }
            totalAmount += priceLookup[item.sku] * item.quantity;
          }

          // Create order request
          db.run(`
            INSERT INTO order_requests
            (customer_number, status, submitted_at, driver_id, total_amount, note)
            VALUES (?, ?, datetime('now'), ?, ?, ?)
          `, [
            CustomerNumber, 'Pending', driver.driver_id, totalAmount, note || null
          ], function(err) {
            if (err) {
              console.error('Database error:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ message: 'Database error' });
            }

            const orderId = this.lastID;

            // Create order items
            const insertItem = db.prepare(`
              INSERT INTO order_items (order_id, sku, quantity, price_at_order)
              VALUES (?, ?, ?, ?)
            `);

            let insertError = false;
            items.forEach(item => {
              insertItem.run(
                orderId, item.sku, item.quantity, priceLookup[item.sku],
                (err) => {
                  if (err) {
                    console.error('Error inserting order item:', err);
                    insertError = true;
                  }
                }
              );
            });

            insertItem.finalize(err => {
              if (err || insertError) {
                console.error('Error inserting order items:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Error inserting order items' });
              }

              // Commit transaction
              db.run('COMMIT', err => {
                if (err) {
                  console.error('Error committing transaction:', err);
                  db.run('ROLLBACK');
                  return res.status(500).json({ message: 'Transaction error' });
                }

                // Return success
                res.status(201).json({
                  message: 'Order request submitted successfully',
                  order_id: orderId,
                  status: 'Pending',
                  total_amount: totalAmount
                });
              });
            });
          });
        });
      });
    });
  });
});

/**
 * @route   PUT /api/orders/:id/approve
 * @desc    Approve order request
 * @access  Private
 */
router.put('/:id/approve', (req, res) => {
  const db = req.app.locals.db;
  const orderId = req.params.id;

  // Get order details
  db.get(
    `
    SELECT o.order_id, o.customer_number, o.status, o.driver_id, o.total_amount,
           c.RouteNumber
    FROM order_requests o
    JOIN customers c ON o.customer_number = c.CustomerNumber
    WHERE o.order_id = ?
  `,
    [orderId],
    (err, order) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      if (order.status !== 'Pending') {
        return res.status(400).json({ message: 'Order is not pending' });
      }

      if (req.user.role !== 'SuperAdmin') {
        db.get(
          'SELECT route_number FROM drivers WHERE driver_id = ?',
          [req.user.id],
          (err, driver) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Database error' });
            }
            if (!driver || driver.route_number !== order.RouteNumber) {
              return res.status(403).json({ message: 'Not authorized to approve this order' });
            }
            approveOrder();
          }
        );
      } else {
        approveOrder();
      }

      function approveOrder() {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          db.run(
            `
            UPDATE order_requests
            SET status = 'Approved', approved_at = datetime('now')
            WHERE order_id = ?
          `,
            [orderId],
            function (err) {
              if (err) {
                console.error('Database error:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Database error' });
              }
              if (this.changes === 0) {
                db.run('ROLLBACK');
                return res.status(404).json({ message: 'Order not found' });
              }
              db.run(
                `
                INSERT INTO sales
                (order_id, customer_number, driver_id, sale_date, total_amount, commission_amount)
                VALUES (?, ?, ?, datetime('now'), ?, ?)
              `,
                [
                  orderId,
                  order.customer_number,
                  req.user.id, // current user's ID as the approver/driver
                  order.total_amount,
                  order.total_amount * 0.1 // 10% commission
                ],
                function (err) {
                  if (err) {
                    console.error('Database error:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ message: 'Error creating sales record' });
                  }
                  const saleId = this.lastID;
                  db.run('COMMIT', err => {
                    if (err) {
                      console.error('Error committing transaction:', err);
                      db.run('ROLLBACK');
                      return res.status(500).json({ message: 'Transaction error' });
                    }
                    res.json({
                      message: 'Order approved successfully',
                      order_id: orderId,
                      sale_id: saleId,
                      status: 'Approved'
                    });
                  });
                }
              );
            }
          );
        });
      }
    }
  );
});
module.exports = router;
