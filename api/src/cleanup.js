// src/cleanup.js
// Script to clean up expired tokens and perform maintenance tasks

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const tokenService = require('./services/tokenService');

// Connect to the database
const db = new sqlite3.Database(
  path.join(__dirname, '../../database/master.db'),
  (err) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      process.exit(1);
    } else {
      console.log('Connected to the database for cleanup');
    }
  }
);

// Cleanup tasks
const performCleanup = async () => {
  try {
    // Clean up expired refresh tokens
    const removedTokens = await tokenService.cleanupExpiredTokens(db);
    console.log(`Cleanup completed: Removed ${removedTokens} expired tokens`);
    
    // Add additional cleanup tasks here if needed
    
    // Close the database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
};

// Run the cleanup
performCleanup();