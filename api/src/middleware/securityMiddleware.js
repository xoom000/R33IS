// src/middleware/securityMiddleware.js
const helmet = require('helmet');

/**
 * Configure security headers including Content Security Policy
 * 
 * @param {Object} app - Express app instance
 */
const configureSecurityHeaders = (app) => {
  // Configure Content Security Policy
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Consider removing unsafe-inline in production
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https://api.mapbox.com"],
        connectSrc: ["'self'", "https://api.mapbox.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        // CSP violation reporting
        reportUri: '/api/security/csp-report',
        // Add other directives as needed
      },
      reportOnly: process.env.NODE_ENV !== 'production', // Use report-only mode in development
    })
  );
  
  // Configure other security headers
  
  // Prevent browsers from performing MIME type sniffing
  app.use(helmet.noSniff());
  
  // Prevent clickjacking attacks
  app.use(helmet.frameguard({ action: 'deny' }));
  
  // HTTP Strict Transport Security
  app.use(helmet.hsts({
    maxAge: 15552000, // 180 days in seconds
    includeSubDomains: true,
    preload: true
  }));
  
  // Set X-Content-Type-Options header
  app.use(helmet.noSniff());
  
  // Configure Referrer-Policy
  app.use(helmet.referrerPolicy({ 
    policy: 'same-origin' 
  }));
  
  // Configure Feature-Policy/Permissions-Policy
  app.use((req, res, next) => {
    res.setHeader(
      'Permissions-Policy', 
      'geolocation=self, microphone=(), camera=(), fullscreen=self'
    );
    next();
  });
  
  // Add X-XSS-Protection header
  app.use(helmet.xssFilter());
  
  // Add X-Download-Options header for IE
  app.use(helmet.ieNoOpen());
  
  // Add X-DNS-Prefetch-Control header
  app.use(helmet.dnsPrefetchControl({ allow: false }));
};

module.exports = { configureSecurityHeaders };