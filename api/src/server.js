// server.js - Main Express Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const usersRoutes = require('./routes/users');

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database(
  path.join(__dirname, '../../database/master.db'),
  (err) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
    } else {
      console.log('Connected to the master database');
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON');
    }
  }
);

// Make the database connection available to all routes
app.locals.db = db;

// Import route files
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const directSalesRoutes = require('./routes/directSales');
const ordersRoutes = require('./routes/orders');
const driversRoutes = require('./routes/drivers');
const rentalItemsRoutes = require('./routes/rentalItems');
const parLevelsRoutes = require('./routes/parLevels');
const notesRoutes = require('./routes/notes');
const journalRoutes = require('./routes/journal');

// Auth middleware
const { authenticate } = require('./middleware/authMiddleware');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', authenticate, customerRoutes);
app.use('/api/direct-sales', authenticate, directSalesRoutes);
app.use('/api/orders', authenticate, ordersRoutes);
app.use('/api/drivers', authenticate, driversRoutes);
app.use('/api/rental-items', authenticate, rentalItemsRoutes);
app.use('/api/par-levels', authenticate, parLevelsRoutes);
app.use('/api/users', authenticate, usersRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/journal', journalRoutes);

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date()
  });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error('====== SERVER ERROR ======');
  console.error('REQUEST PATH:', req.originalUrl);
  console.error('REQUEST METHOD:', req.method);
  console.error('REQUEST BODY:', JSON.stringify(req.body, null, 2));
  console.error('ERROR MESSAGE:', err.message);
  console.error('ERROR STACK:', err.stack);
  console.error('=========================');
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Something went wrong',
      status: err.status || 500
    }
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing database connection');
  db.close(() => {
    console.log('Database connection closed');
    process.exit(0);
  });
});

module.exports = app;