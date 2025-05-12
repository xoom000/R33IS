// src/routes/users.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authenticate);

/**
 * @route   GET /api/users
 * @desc    Get all users (SuperAdmin only)
 * @access  Private
 */
router.get('/', authorize(['SuperAdmin']), (req, res) => {
  const db = req.app.locals.db;
  
  db.all(`
    SELECT u.user_id as id, u.username, u.customer_number as customerNumber, 
           u.role, c.AccountName as name, u.created_at as createdAt,
           d.route_number as routeNumber
    FROM users u
    JOIN customers c ON u.customer_number = c.CustomerNumber
    LEFT JOIN drivers d ON u.user_id = d.driver_id
    ORDER BY u.created_at DESC
  `, [], (err, users) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Error fetching users' });
    }
    
    res.json({ users });
  });
});

/**
 * @route   PUT /api/users/:id/role
 * @desc    Update user role (SuperAdmin only)
 * @access  Private
 */
router.put('/:id/role', authorize(['SuperAdmin']), (req, res) => {
  const userId = req.params.id;
  const { role } = req.body;
  
  // Validate role
  const validRoles = ['Customer', 'Driver', 'Admin', 'SuperAdmin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  
  const db = req.app.locals.db;
  
  db.run('UPDATE users SET role = ? WHERE user_id = ?', [role, userId], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Error updating user role' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // If role is Driver or Admin, ensure they have a drivers table entry
    if (role === 'Driver' || role === 'Admin') {
      db.get('SELECT * FROM drivers WHERE user_id = ?', [userId], (err, driver) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Error checking driver record' });
        }
        
        if (!driver) {
          // Create driver record if it doesn't exist
          db.run(
            'INSERT INTO drivers (user_id, name, route_number, role) VALUES (?, ?, NULL, ?)',
            [userId, req.body.name || 'New Driver', role],
            (err) => {
              if (err) {
                console.error('Error creating driver record:', err);
              }
            }
          );
        }
      });
    }
    
    res.json({ message: 'User role updated successfully' });
  });
});

/**
 * @route   PUT /api/users/:id/route
 * @desc    Assign route to user (SuperAdmin only)
 * @access  Private
 */
router.put('/:id/route', authorize(['SuperAdmin']), (req, res) => {
  const userId = req.params.id;
  const { route_number } = req.body;
  
  const db = req.app.locals.db;
  
  // First, check if route exists
  db.get('SELECT RouteNumber FROM routes WHERE RouteNumber = ?', [route_number], (err, route) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Error checking route' });
    }
    
    if (!route) {
      return res.status(400).json({ message: 'Invalid route number' });
    }
    
    // Check if user is a driver or admin
    db.get('SELECT role FROM users WHERE user_id = ?', [userId], (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Error checking user' });
      }
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (user.role !== 'Driver' && user.role !== 'Admin') {
        return res.status(400).json({ message: 'User must be a Driver or Admin to assign route' });
      }
      
      // Update/create driver record
      db.get('SELECT * FROM drivers WHERE user_id = ?', [userId], (err, driver) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Error checking driver record' });
        }
        
        if (driver) {
          // Update existing driver
          db.run('UPDATE drivers SET route_number = ? WHERE user_id = ?', 
            [route_number, userId], 
            function(err) {
              if (err) {
                console.error('Error updating driver route:', err);
                return res.status(500).json({ message: 'Error updating driver route' });
              }
              
              res.json({ message: 'Route assigned successfully' });
            }
          );
        } else {
          // Create new driver record
          db.run(
            'INSERT INTO drivers (user_id, route_number, role) VALUES (?, ?, ?)',
            [userId, route_number, user.role],
            function(err) {
              if (err) {
                console.error('Error creating driver record:', err);
                return res.status(500).json({ message: 'Error creating driver record' });
              }
              
              res.json({ message: 'Driver created and route assigned successfully' });
            }
          );
        }
      });
    });
  });
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user (SuperAdmin only)
 * @access  Private
 */
router.delete('/:id', authorize(['SuperAdmin']), (req, res) => {
  const userId = req.params.id;
  const db = req.app.locals.db;
  
  // Begin transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // First remove any driver record if exists
    db.run('DELETE FROM drivers WHERE user_id = ?', [userId], (err) => {
      if (err) {
        console.error('Error deleting driver record:', err);
        db.run('ROLLBACK');
        return res.status(500).json({ message: 'Error deleting user' });
      }
      
      // Then delete the user
      db.run('DELETE FROM users WHERE user_id = ?', [userId], function(err) {
        if (err) {
          console.error('Error deleting user:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ message: 'Error deleting user' });
        }
        
        if (this.changes === 0) {
          db.run('ROLLBACK');
          return res.status(404).json({ message: 'User not found' });
        }
        
        db.run('COMMIT');
        res.json({ message: 'User deleted successfully' });
      });
    });
  });
});

module.exports = router;
