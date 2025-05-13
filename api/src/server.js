// server.js - Main Express Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const usersRoutes = require('./routes/users');
const securityRoutes = require('./routes/securityRoutes');
const tokenService = require('./services/tokenService');
const { configureSecurityHeaders } = require('./middleware/securityMiddleware');
const { logger, requestLogger } = require('./middleware/loggerMiddleware');

// Initialize express app
const app = express();

// Middleware
// app.use(helmet()); // Basic security headers - replaced with comprehensive configuration
// Configure all security headers including CSP
configureSecurityHeaders(app);
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true // Allow cookies to be sent with requests
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes by default
  max: process.env.RATE_LIMIT_MAX || 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Cookie parser middleware
app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie-secret-value'));

// CSRF protection - apply to all routes except auth/login and auth/refresh
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

// CSRF error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.error('Invalid CSRF token', { path: req.originalUrl, method: req.method });
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'Form has been tampered with'
    });
  }
  next(err);
});

// Get CSRF token endpoint
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Logging middleware
app.use(requestLogger);

// HTTP request logging to file
const accessLogStream = fs.createWriteStream(path.join(__dirname, '../logs/access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));

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
app.use('/api/auth', authRoutes); // Auth routes don't use CSRF yet - will be applied selectively
app.use('/api/customers', authenticate, customerRoutes);
app.use('/api/direct-sales', authenticate, directSalesRoutes);
app.use('/api/orders', authenticate, ordersRoutes);
app.use('/api/drivers', authenticate, driversRoutes);
app.use('/api/rental-items', authenticate, rentalItemsRoutes);
app.use('/api/par-levels', authenticate, parLevelsRoutes);
app.use('/api/users', authenticate, usersRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/security', securityRoutes); // Security-related endpoints like CSP reporting

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
  // Log the error with winston
  logger.error('Server Error', {
    path: req.originalUrl,
    method: req.method,
    error: err.message,
    stack: err.stack,
    body: JSON.stringify(req.body)
  });

  // Send error response - don't expose stack traces in production
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
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
  
  // Start token cleanup schedule
  scheduleTokenCleanup();
});

// Schedule periodic token cleanup
const scheduleTokenCleanup = () => {
  // Run token cleanup every 24 hours
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  setInterval(async () => {
    try {
      logger.info('Running scheduled token cleanup');
      const removedCount = await tokenService.cleanupExpiredTokens(db);
      logger.info(`Token cleanup completed: ${removedCount} expired tokens removed`);
    } catch (error) {
      logger.error('Error during token cleanup:', error);
    }
  }, CLEANUP_INTERVAL);
  
  // Also run once at startup
  setTimeout(async () => {
    try {
      logger.info('Running initial token cleanup');
      const removedCount = await tokenService.cleanupExpiredTokens(db);
      logger.info(`Initial token cleanup completed: ${removedCount} expired tokens removed`);
    } catch (error) {
      logger.error('Error during initial token cleanup:', error);
    }
  }, 10000); // 10 seconds after startup
};

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT signal. Shutting down gracefully...');
  console.log('Closing database connection');
  db.close(() => {
    logger.info('Database connection closed');
    console.log('Database connection closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error(error.name, error.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Promise Rejection', { error: error.message, stack: error.stack });
  console.error('UNHANDLED REJECTION! Shutting down...');
  console.error(error.name, error.message);
  process.exit(1);
});

module.exports = app;