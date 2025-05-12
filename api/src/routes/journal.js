// src/routes/journal.js
const express = require('express');
const router = express.Router();
const { 
  getCustomerJournal, 
  getTodayJournal, 
  createJournalEntry,
  searchJournal
} = require('../controllers/journalController');
const { authenticate } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/journal/today
 * @desc    Get journal entries for today's route
 * @access  Private (Driver, SuperAdmin)
 */
router.get('/today', authenticate, getTodayJournal);

/**
 * @route   GET /api/journal/customer/:customerId
 * @desc    Get all journal entries for a specific customer
 * @access  Private (Driver, SuperAdmin)
 */
router.get('/customer/:customerId', authenticate, getCustomerJournal);

/**
 * @route   GET /api/journal/search
 * @desc    Search journal entries with various filters
 * @access  Private (Driver, SuperAdmin)
 */
router.get('/search', authenticate, searchJournal);

/**
 * @route   POST /api/journal
 * @desc    Create a new journal entry
 * @access  Private (Driver, SuperAdmin)
 */
router.post('/', authenticate, createJournalEntry);

module.exports = router;