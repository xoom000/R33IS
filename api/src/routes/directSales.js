// src/routes/directSales.js
const express = require('express');
const router = express.Router();

// Apply auth middleware to all routes
const { authenticate, authorize } = require('../middleware/authMiddleware');
router.use(authenticate);

/**
 * @route   GET /api/direct-sales
 * @desc    Get all direct sales products (with filtering & pagination)
 * @access  Private
 */
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const category = req.query.category;

  let query = `
    SELECT ds.sku, ds.name, ds.description, ds.base_price, 
           ds.category_id, c.name as category_name, 
           ds.vendor, ds.is_active, ds.stock_quantity, ds.image_url
    FROM direct_sales ds
    LEFT JOIN categories c ON ds.category_id = c.id
    WHERE ds.is_active = 1
  `;

  const params = [];

  // Add search filter if provided
  if (search) {
    query += ` AND (ds.name LIKE ? OR ds.description LIKE ? OR ds.sku LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Add category filter if provided
  if (category && category !== 'all') {
    query += ` AND ds.category_id = ?`;
    params.push(category);
  }

  // Count total products for pagination
  db.get(`SELECT COUNT(*) as total FROM direct_sales ds 
    WHERE ds.is_active = 1
    ${search ? ' AND (ds.name LIKE ? OR ds.description LIKE ? OR ds.sku LIKE ?)' : ''}
    ${category && category !== 'all' ? ' AND ds.category_id = ?' : ''}`,
    search ? [
      `%${search}%`, `%${search}%`, `%${search}%`, 
      ...(category && category !== 'all' ? [category] : [])
    ] : (category && category !== 'all' ? [category] : []), 
    (err, count) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      // Add pagination
      query += ` ORDER BY ds.name LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      // Get paginated products
      db.all(query, params, (err, products) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Database error' });
        }

        res.json({
          products,
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
 * @route   GET /api/direct-sales/customer/:id
 * @desc    Get products with customer par levels
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

          // Get customer products with par levels
          fetchProductsWithParLevels();
        });
      } else {
        // SuperAdmin can see any customer's products
        fetchProductsWithParLevels();
      }

      function fetchProductsWithParLevels() {
        db.all(`
          SELECT 
            ds.sku, ds.name, ds.description, ds.base_price, 
            ds.category_id, c.name as category_name, ds.vendor,
            COALESCE(cpl.par_level, 0) as par_level,
            cpl.is_featured, cpl.date_added
          FROM direct_sales ds
          LEFT JOIN categories c ON ds.category_id = c.id
          LEFT JOIN customer_par_levels cpl ON ds.sku = cpl.sku AND cpl.customer_number = ?
          WHERE ds.is_active = 1
          ORDER BY ds.name
        `, [customerId], (err, products) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }

          res.json({ products });
        });
      }
    }
  );
});

/**
 * @route   GET /api/direct-sales/:sku
 * @desc    Get single product by SKU
 * @access  Private
 */
router.get('/:sku', (req, res) => {
  const db = req.app.locals.db;
  const sku = req.params.sku;

  db.get(`
    SELECT ds.*, c.name as category_name
    FROM direct_sales ds
    LEFT JOIN categories c ON ds.category_id = c.id
    WHERE ds.sku = ?
  `, [sku], (err, product) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  });
});

/**
 * @route   POST /api/direct-sales
 * @desc    Create new product
 * @access  Private (SuperAdmin only)
 */
router.post('/', (req, res) => {
  // Only SuperAdmin can add products
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ message: 'Not authorized to add products' });
  }

  const db = req.app.locals.db;
  const {
    name, description, base_price, category_id,
    vendor, stock_quantity, image_url
  } = req.body;

  // Validate required fields
  if (!name || !base_price) {
    return res.status(400).json({ message: 'Name and price are required' });
  }

  // Generate SKU (using timestamp)
  const sku = `DS${Date.now().toString().substring(7)}`;

  // Insert new product
  db.run(`
    INSERT INTO direct_sales
    (sku, name, description, base_price, category_id, vendor, is_active, stock_quantity, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    sku, name, description || '', base_price, category_id || null,
    vendor || '', 1, stock_quantity || 0, image_url || null
  ], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    // Return the newly created product
    res.status(201).json({
      message: 'Product created successfully',
      sku,
      name,
      base_price
    });
  });
});

/**
 * @route   PUT /api/direct-sales/:sku
 * @desc    Update product
 * @access  Private (SuperAdmin only)
 */
router.put('/:sku', (req, res) => {
  // Only SuperAdmin can update products
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ message: 'Not authorized to update products' });
  }

  const db = req.app.locals.db;
  const sku = req.params.sku;
  const {
    name, description, base_price, category_id,
    vendor, is_active, stock_quantity, image_url
  } = req.body;

  // Validate required fields
  if (!name || !base_price) {
    return res.status(400).json({ message: 'Name and price are required' });
  }

  // Update product
  db.run(`
    UPDATE direct_sales
    SET name = ?, description = ?, base_price = ?, category_id = ?,
        vendor = ?, is_active = ?, stock_quantity = ?, image_url = ?
    WHERE sku = ?
  `, [
    name, description || '', base_price, category_id || null,
    vendor || '', is_active ? 1 : 0, stock_quantity || 0, image_url || null,
    sku
  ], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      message: 'Product updated successfully',
      sku
    });
  });
});

/**
 * @route   PUT /api/direct-sales/:sku/stock
 * @desc    Update product stock
 * @access  Private (Driver, SuperAdmin)
 */
router.put('/:sku/stock', (req, res) => {
  const db = req.app.locals.db;
  const sku = req.params.sku;
  const { stock_quantity } = req.body;

  // Validate input
  if (stock_quantity === undefined || stock_quantity < 0) {
    return res.status(400).json({ message: 'Valid stock quantity is required' });
  }

  // Update product stock
  db.run(`
    UPDATE direct_sales
    SET stock_quantity = ?
    WHERE sku = ?
  `, [stock_quantity, sku], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      message: 'Stock updated successfully',
      sku,
      stock_quantity
    });
  });
});

/**
 * @route   DELETE /api/direct-sales/:sku
 * @desc    Delete product (soft delete by setting is_active to 0)
 * @access  Private (SuperAdmin only)
 */
router.delete('/:sku', (req, res) => {
  // Only SuperAdmin can delete products
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ message: 'Not authorized to delete products' });
  }

  const db = req.app.locals.db;
  const sku = req.params.sku;

  // Soft delete by setting is_active to 0
  db.run(`
    UPDATE direct_sales
    SET is_active = 0
    WHERE sku = ?
  `, [sku], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      message: 'Product deleted successfully',
      sku
    });
  });
});

module.exports = router;
