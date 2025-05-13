// src/routes/securityRoutes.js
const express = require('express');
const router = express.Router();
const { logger } = require('../middleware/loggerMiddleware');

/**
 * @route   POST /api/security/csp-report
 * @desc    Content Security Policy violation reporting endpoint
 * @access  Public
 */
router.post('/csp-report', (req, res) => {
  // The CSP report is in the 'csp-report' property of the request body
  const cspReport = req.body['csp-report'] || req.body;
  
  // Log CSP violations
  logger.warn('CSP Violation:', {
    report: cspReport,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  
  // In a production environment, you might want to:
  // 1. Store violations in a database
  // 2. Set up alerts for unusual patterns
  // 3. Track trends over time
  
  // Return 204 No Content - the browser doesn't expect a response
  res.status(204).end();
});

/**
 * @route   GET /api/security/headers
 * @desc    Get current security headers for testing
 * @access  Public
 */
router.get('/headers', (req, res) => {
  // Send a response with no sensitive information
  // This allows the client to check what headers are being set
  res.json({
    message: 'Security headers test endpoint',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;