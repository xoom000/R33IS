// drivers.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// 1) Import the named middleware function from auth.js
const { authenticate, authorize } = require('../middleware/authMiddleware');

// 2) Apply that function to all routes in this router
router.use(authenticate);

/**
 * @route   GET /api/drivers
 * @desc    Get all drivers (SuperAdmin only)
 * @access  Private
 */
router.get('/', (req, res) => {
  // Only SuperAdmin can view all drivers
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ message: 'Not authorized to view all drivers' });
  }

  const db = req.app.locals.db;
  db.all(
    `SELECT driver_id, name, email, route_number, role, created_at
     FROM drivers
     ORDER BY name`,
    [],
    (err, drivers) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ drivers });
    }
  );
});

/**
 * @route   GET /api/drivers/:id
 * @desc    Get driver by ID
 * @access  Private
 */
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const driverId = req.params.id;

  // Users can view their own profile or SuperAdmin can view any profile
  if (req.user.id !== parseInt(driverId) && req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ message: 'Not authorized to view this driver' });
  }

  db.get(
    `SELECT driver_id, name, email, route_number, role, created_at
     FROM drivers
     WHERE driver_id = ?`,
    [driverId],
    (err, driver) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }
      res.json({ driver });
    }
  );
});

/**
 * @route   POST /api/drivers
 * @desc    Create a new driver (SuperAdmin only)
 * @access  Private
 */
router.post('/', async (req, res) => {
  // Only SuperAdmin can create drivers
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ message: 'Not authorized to create drivers' });
  }

  const db = req.app.locals.db;
  const { name, email, password, route_number, role = 'Driver' } = req.body;

  // Validate required fields
  if (!name || !email || !password || !route_number) {
    return res
      .status(400)
      .json({ message: 'Name, email, password, and route number are required' });
  }

  // Check if email already exists
  db.get('SELECT email FROM drivers WHERE email = ?', [email], async (err, existingDriver) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (existingDriver) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Check if route exists
    db.get('SELECT RouteNumber FROM routes WHERE RouteNumber = ?', [route_number], async (err, route) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (!route) {
        return res.status(400).json({ message: 'Invalid route number' });
      }

      try {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create new driver
        db.run(
          `
          INSERT INTO drivers
          (name, email, password_hash, route_number, role, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `,
          [name, email, password_hash, route_number, role],
          function (err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Error creating driver' });
            }
            // Return new driver info
            res.status(201).json({
              message: 'Driver created successfully',
              driver_id: this.lastID,
              name,
              email,
              route_number,
              role,
            });
          }
        );
      } catch (error) {
        console.error('Password hashing error:', error);
        return res.status(500).json({ message: 'Error creating driver' });
      }
    });
  });
});

/**
 * @route   PUT /api/drivers/:id
 * @desc    Update driver
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  const db = req.app.locals.db;
  const driverId = req.params.id;
  const { name, email, password, route_number, role } = req.body;

  // Users can update their own basic info or SuperAdmin can update any driver
  const isSelf = req.user.id === parseInt(driverId);
  const isSuperAdmin = req.user.role === 'SuperAdmin';

  if (!isSelf && !isSuperAdmin) {
    return res.status(403).json({ message: 'Not authorized to update this driver' });
  }

  // Only SuperAdmin can change role or route
  if (!isSuperAdmin && (role || route_number)) {
    return res.status(403).json({ message: 'Not authorized to change role or route' });
  }

  // Check if driver exists
  db.get('SELECT driver_id, email FROM drivers WHERE driver_id = ?', [driverId], async (err, driver) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // If email is changing, check if new email is already in use
    if (email && email !== driver.email) {
      db.get(
        'SELECT email FROM drivers WHERE email = ? AND driver_id != ?',
        [email, driverId],
        (err, existingEmail) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }
          if (existingEmail) {
            return res.status(400).json({ message: 'Email already in use' });
          }
          updateDriver();
        }
      );
    } else {
      updateDriver();
    }

    async function updateDriver() {
      let query = 'UPDATE drivers SET';
      const params = [];

      if (name) {
        query += ' name = ?,';
        params.push(name);
      }
      if (email) {
        query += ' email = ?,';
        params.push(email);
      }
      if (password) {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        query += ' password_hash = ?,';
        params.push(password_hash);
      }

      if (isSuperAdmin && route_number) {
        // Verify route exists
        db.get('SELECT RouteNumber FROM routes WHERE RouteNumber = ?', [route_number], (err, route) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error' });
          }
          if (!route) {
            return res.status(400).json({ message: 'Invalid route number' });
          }
          query += ' route_number = ?,';
          params.push(route_number);
          continueUpdate();
        });
      } else {
        continueUpdate();
      }

      function continueUpdate() {
        if (isSuperAdmin && role) {
          // Validate role
          if (role !== 'Driver' && role !== 'SuperAdmin') {
            return res.status(400).json({ message: 'Invalid role' });
          }
          query += ' role = ?,';
          params.push(role);
        }
        // Remove trailing comma
        query = query.slice(0, -1) + ' WHERE driver_id = ?';
        params.push(driverId);

        db.run(query, params, function (err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Error updating driver' });
          }
          if (this.changes === 0) {
            return res.status(404).json({ message: 'Driver not found' });
          }
          // Fetch updated driver info
          db.get(
            `SELECT driver_id, name, email, route_number, role, created_at
             FROM drivers
             WHERE driver_id = ?`,
            [driverId],
            (err, updatedDriver) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Database error' });
              }
              res.json({
                message: 'Driver updated successfully',
                driver: updatedDriver,
              });
            }
          );
        });
      }
    }
  });
});

// 3) Export the router after defining all routes
module.exports = router;
