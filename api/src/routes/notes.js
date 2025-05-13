// src/routes/notes.js
const express = require('express');
const router = express.Router();
const { 
  getCustomerNotes, 
  getTodayNotes, 
  createNote, 
  updateNote, 
  deleteNote,
  searchNotes
} = require('../controllers/notesController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { rules, validate } = require('../utils/validation');

/**
 * @route   GET /api/notes/today
 * @desc    Get all notes for today's route stops
 * @access  Private (Driver, SuperAdmin)
 */
router.get('/today', authenticate, getTodayNotes);

/**
 * @route   GET /api/notes/customer/:customerId
 * @desc    Get all notes for a specific customer
 * @access  Private (Driver, SuperAdmin)
 */
router.get('/customer/:customerId', authenticate, rules.notes.getByCustomer, validate, getCustomerNotes);

/**
 * @route   GET /api/notes/search
 * @desc    Search notes with various filters
 * @access  Private (Driver, SuperAdmin)
 */
router.get('/search', authenticate, searchNotes);

/**
 * @route   POST /api/notes
 * @desc    Create a new note
 * @access  Private (Driver, SuperAdmin)
 */
router.post('/', authenticate, rules.notes.create, validate, createNote);

/**
 * @route   PUT /api/notes/:noteId
 * @desc    Update a note
 * @access  Private (Driver, SuperAdmin)
 */
router.put('/:noteId', authenticate, rules.notes.update, validate, updateNote);

/**
 * @route   DELETE /api/notes/:noteId
 * @desc    Delete a note
 * @access  Private (SuperAdmin)
 */
router.delete('/:noteId', authenticate, authorize(['SuperAdmin']), deleteNote);

module.exports = router;