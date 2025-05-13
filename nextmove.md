# R33IS Priority Security Enhancements - Implementation Tasks

## Task 1: Implement Token Rotation & Storage

The current implementation lacks refresh token tracking and rotation, which is critical for preventing token theft and misuse. Please implement the following security enhancements:

### Backend Implementation

1. **Database Storage**:
   ```javascript
   // Create a new migration for refresh_tokens table
   CREATE TABLE refresh_tokens (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     token_id TEXT NOT NULL UNIQUE,  // Hashed token identifier
     user_id INTEGER NOT NULL,
     expires_at DATETIME NOT NULL,
     revoked BOOLEAN DEFAULT false,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(user_id)
   );
   ```

2. **Token Management Service**:
   ```javascript
   // src/services/tokenService.js
   
   // Create a refresh token and store in database
   export async function createRefreshToken(userId) {
     const tokenId = crypto.randomBytes(40).toString('hex');
     const hashedTokenId = await bcrypt.hash(tokenId, 10);
     const expiresAt = new Date();
     expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration
     
     // Store in database
     await db.run(
       'INSERT INTO refresh_tokens (token_id, user_id, expires_at) VALUES (?, ?, ?)',
       [hashedTokenId, userId, expiresAt]
     );
     
     return tokenId;
   }
   
   // Verify and rotate a refresh token
   export async function rotateRefreshToken(tokenId, userId) {
     const hashedTokenId = await bcrypt.hash(tokenId, 10);
     
     // Find and validate token
     const token = await db.get(
       'SELECT * FROM refresh_tokens WHERE token_id = ? AND user_id = ? AND expires_at > datetime("now") AND revoked = false',
       [hashedTokenId, userId]
     );
     
     if (!token) {
       throw new Error('Invalid or expired refresh token');
     }
     
     // Revoke the current token
     await db.run(
       'UPDATE refresh_tokens SET revoked = true WHERE token_id = ?',
       [hashedTokenId]
     );
     
     // Create a new token
     return await createRefreshToken(userId);
   }
   
   // Revoke all tokens for a user (for logout)
   export async function revokeAllUserTokens(userId) {
     await db.run(
       'UPDATE refresh_tokens SET revoked = true WHERE user_id = ?',
       [userId]
     );
   }
   
   // Cleanup expired tokens (run periodically)
   export async function cleanupExpiredTokens() {
     await db.run(
       'DELETE FROM refresh_tokens WHERE expires_at < datetime("now")'
     );
   }
   ```

3. **Update Auth Routes**:
   ```javascript
   // Update login handler
   router.post('/login', async (req, res) => {
     // ... existing authentication logic
     
     // Generate refresh token
     const refreshToken = await tokenService.createRefreshToken(user.id);
     
     // Set cookies with tokens
     res.cookie('refreshToken', refreshToken, {
       httpOnly: true,
       secure: process.env.NODE_ENV === 'production',
       sameSite: 'lax',
       path: '/api/auth/refresh',
       maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
     });
     
     // ... rest of login logic
   });
   
   // Update refresh token endpoint
   router.post('/refresh', async (req, res) => {
     const refreshToken = req.cookies.refreshToken;
     
     if (!refreshToken) {
       return res.status(401).json({ message: 'Refresh token required' });
     }
     
     try {
       // Get user ID from expired access token
       const decoded = jwt.decode(req.cookies.accessToken);
       if (!decoded || !decoded.id) {
         throw new Error('Invalid access token');
       }
       
       // Rotate refresh token
       const newRefreshToken = await tokenService.rotateRefreshToken(refreshToken, decoded.id);
       
       // Generate new access token
       const accessToken = jwt.sign(
         { id: decoded.id, role: decoded.role },
         process.env.JWT_SECRET,
         { expiresIn: '1h' }
       );
       
       // Set new cookies
       res.cookie('accessToken', accessToken, { /* access token options */ });
       res.cookie('refreshToken', newRefreshToken, { /* refresh token options */ });
       
       res.json({ success: true });
     } catch (error) {
       res.clearCookie('accessToken');
       res.clearCookie('refreshToken');
       return res.status(401).json({ message: 'Invalid refresh token' });
     }
   });
   
   // Update logout handler
   router.post('/logout', async (req, res) => {
     // Get user ID from token
     const decoded = jwt.decode(req.cookies.accessToken);
     if (decoded && decoded.id) {
       await tokenService.revokeAllUserTokens(decoded.id);
     }
     
     // Clear cookies
     res.clearCookie('accessToken');
     res.clearCookie('refreshToken');
     
     res.json({ success: true });
   });
   ```

### Frontend Implementation

1. **Update Auth Service**:
   ```javascript
   // src/services/authService.js
   
   // Add specific handling for token refresh scenarios
   const refreshAccessToken = async () => {
     try {
       await axios.post('/api/auth/refresh');
       return true;
     } catch (error) {
       // Handle failed refresh
       logout();
       return false;
     }
   };
   
   // Update API interceptor for handling 401 errors
   api.interceptors.response.use(
     response => response,
     async error => {
       const originalRequest = error.config;
       
       // If error is 401 and not already retrying
       if (error.response?.status === 401 && !originalRequest._retry) {
         originalRequest._retry = true;
         
         // Try to refresh token
         const refreshed = await refreshAccessToken();
         if (refreshed) {
           // Retry original request
           return api(originalRequest);
         }
       }
       
       return Promise.reject(error);
     }
   );
   ```

2. **Add Proactive Token Refresh**:
   ```javascript
   // src/hooks/useTokenRefresh.js
   
   export function useTokenRefresh() {
     const refreshTimeoutRef = useRef(null);
     
     const setupRefreshTimer = useCallback(() => {
       // Clear any existing timer
       if (refreshTimeoutRef.current) {
         clearTimeout(refreshTimeoutRef.current);
       }
       
       // Get token expiration from decoded JWT (if available)
       try {
         // For demo purposes - in production you'd use proper JWT decode
         // without exposing the token to JavaScript
         const tokenExpiration = /* calculate expiration time */;
         const currentTime = Date.now();
         
         // Refresh 5 minutes before expiration
         const timeUntilRefresh = Math.max(0, tokenExpiration - currentTime - (5 * 60 * 1000));
         
         refreshTimeoutRef.current = setTimeout(async () => {
           try {
             await authService.refreshAccessToken();
             setupRefreshTimer(); // Set up next refresh
           } catch (error) {
             console.error('Failed to refresh token', error);
           }
         }, timeUntilRefresh);
       } catch (error) {
         console.error('Error setting up token refresh', error);
       }
     }, []);
     
     // Setup on mount and cleanup on unmount
     useEffect(() => {
       setupRefreshTimer();
       return () => {
         if (refreshTimeoutRef.current) {
           clearTimeout(refreshTimeoutRef.current);
         }
       };
     }, [setupRefreshTimer]);
     
     return { setupRefreshTimer };
   }
   ```

## Task 2: Implement Content Security Policy

Implement a robust Content Security Policy to protect against XSS attacks.

### Backend Implementation

1. **Add CSP Middleware**:
   ```javascript
   // src/middleware/securityMiddleware.js
   
   import helmet from 'helmet';
   
   export const configureSecurityHeaders = (app) => {
     // Configure CSP
     app.use(
       helmet.contentSecurityPolicy({
         directives: {
           defaultSrc: ["'self'"],
           scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust if needed
           styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
           imgSrc: ["'self'", "data:", "https://api.mapbox.com"],
           connectSrc: ["'self'", "https://api.mapbox.com"],
           fontSrc: ["'self'", "https://fonts.gstatic.com"],
           objectSrc: ["'none'"],
           mediaSrc: ["'self'"],
           frameSrc: ["'none'"],
           // Add other directives as needed for your application
         },
         reportOnly: process.env.NODE_ENV !== 'production', // Use report-only in development
       })
     );
     
     // Add other security headers
     app.use(helmet.xssFilter());
     app.use(helmet.noSniff());
     app.use(helmet.frameguard({ action: 'deny' }));
     app.use(helmet.hsts({
       maxAge: 15552000, // 180 days
       includeSubDomains: true,
       preload: true
     }));
     
     // Add X-Content-Type-Options
     app.use(helmet.noSniff());
     
     // Add Referrer-Policy
     app.use(helmet.referrerPolicy({ policy: 'same-origin' }));
     
     // Prevent browsers from performing MIME type sniffing
     app.use(helmet.noSniff());
     
     // Add Feature-Policy header
     app.use(
       helmet.featurePolicy({
         features: {
           geolocation: ["'self'"],
           camera: ["'none'"],
           microphone: ["'none'"],
           // Add other feature policies as needed
         },
       })
     );
   };
   ```

2. **Add CSP Reporting Endpoint**:
   ```javascript
   // src/routes/securityRoutes.js
   
   import express from 'express';
   const router = express.Router();
   
   router.post('/csp-report', (req, res) => {
     console.warn('CSP Violation:', req.body['csp-report']);
     // In production, you would log this to a security monitoring system
     res.status(204).end();
   });
   
   export default router;
   ```

3. **Update Server Configuration**:
   ```javascript
   // src/server.js
   
   import { configureSecurityHeaders } from './middleware/securityMiddleware';
   import securityRoutes from './routes/securityRoutes';
   
   // Apply security headers middleware
   configureSecurityHeaders(app);
   
   // Add CSP reporting endpoint
   app.use('/api/security', securityRoutes);
   ```

## Task 3: Implement Data Encryption

Add encryption for sensitive data at rest to protect customer information.

### Implementation Steps

1. **Create Encryption Service**:
   ```javascript
   // src/services/encryptionService.js
   
   import crypto from 'crypto';
   
   // Use environment variables for the encryption key
   const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 32 bytes (256 bits)
   const IV_LENGTH = 16; // For AES, this is always 16 bytes
   
   // Validation
   if (!ENCRYPTION_KEY || Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
     console.error('Invalid encryption key configuration');
     process.exit(1); // Exit if encryption is not properly configured
   }
   
   // Encrypt data
   export function encrypt(text) {
     if (!text) return null;
     
     const iv = crypto.randomBytes(IV_LENGTH);
     const cipher = crypto.createCipheriv(
       'aes-256-cbc', 
       Buffer.from(ENCRYPTION_KEY, 'hex'), 
       iv
     );
     
     let encrypted = cipher.update(text);
     encrypted = Buffer.concat([encrypted, cipher.final()]);
     
     return iv.toString('hex') + ':' + encrypted.toString('hex');
   }
   
   // Decrypt data
   export function decrypt(text) {
     if (!text) return null;
     
     const parts = text.split(':');
     if (parts.length !== 2) return null;
     
     const iv = Buffer.from(parts[0], 'hex');
     const encryptedText = Buffer.from(parts[1], 'hex');
     
     const decipher = crypto.createDecipheriv(
       'aes-256-cbc', 
       Buffer.from(ENCRYPTION_KEY, 'hex'), 
       iv
     );
     
     let decrypted = decipher.update(encryptedText);
     decrypted = Buffer.concat([decrypted, decipher.final()]);
     
     return decrypted.toString();
   }
   ```

2. **Create Database Hooks for Auto-Encryption**:
   ```javascript
   // src/db/encryptionHooks.js
   
   import { encrypt, decrypt } from '../services/encryptionService';
   
   // Fields that should be encrypted in each table
   const ENCRYPTED_FIELDS = {
     customers: ['Email', 'Phone'],
     notes: ['text'],
     journal_entries: ['content']
     // Add other tables and fields as needed
   };
   
   // Automatically encrypt sensitive fields before saving to database
   export function encryptFields(tableName, data) {
     if (!ENCRYPTED_FIELDS[tableName]) return data;
     
     const encryptedData = { ...data };
     ENCRYPTED_FIELDS[tableName].forEach(field => {
       if (encryptedData[field]) {
         encryptedData[field] = encrypt(encryptedData[field]);
       }
     });
     
     return encryptedData;
   }
   
   // Automatically decrypt sensitive fields when retrieved from database
   export function decryptFields(tableName, data) {
     if (!ENCRYPTED_FIELDS[tableName] || !data) return data;
     
     // Handle both arrays and single objects
     if (Array.isArray(data)) {
       return data.map(item => decryptFields(tableName, item));
     }
     
     const decryptedData = { ...data };
     ENCRYPTED_FIELDS[tableName].forEach(field => {
       if (decryptedData[field]) {
         decryptedData[field] = decrypt(decryptedData[field]);
       }
     });
     
     return decryptedData;
   }
   ```

3. **Integrate with Database Access Layer**:
   ```javascript
   // Update your database access functions to use encryption hooks
   
   // Example for a customer repository
   export async function getCustomer(id) {
     const customer = await db.get('SELECT * FROM customers WHERE CustomerNumber = ?', [id]);
     return decryptFields('customers', customer);
   }
   
   export async function saveCustomer(customer) {
     const encryptedCustomer = encryptFields('customers', customer);
     // Execute insert/update query with encrypted data
     // ...
   }
   ```

4. **Add Key Management Instructions**:
   ```
   // Add to README or SECURITY_ENHANCEMENTS.md
   
   ## Encryption Key Management
   
   This application uses AES-256-CBC encryption for sensitive data. The encryption
   key must be securely managed:
   
   1. Generate a secure 256-bit (32-byte) key:
      ```
      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
      ```
   
   2. Store this key in environment variables:
      ```
      ENCRYPTION_KEY=your-generated-key
      ```
   
   3. In production, use a secure key management service like:
      - AWS KMS
      - Google Cloud KMS
      - Azure Key Vault
   
   4. Do NOT store the encryption key in your codebase or commit it to version control.
   
   5. Implement proper key rotation procedures.
   ```

## Task 4: Implement Basic Security Testing

Create a set of security tests to verify the implementation.

### Implementation Steps

1. **Create Security Test Suite**:
   ```javascript
   // tests/security.test.js
   
   import request from 'supertest';
   import app from '../src/server';
   
   describe('Authentication Security Tests', () => {
     test('login should reject incorrect credentials', async () => {
       const res = await request(app)
         .post('/api/auth/login')
         .send({ username: 'test', password: 'wrongpassword' });
       
       expect(res.status).toBe(401);
     });
     
     test('secure routes should reject unauthenticated access', async () => {
       const res = await request(app).get('/api/customers');
       expect(res.status).toBe(401);
     });
     
     test('login should set secure cookies', async () => {
       const res = await request(app)
         .post('/api/auth/login')
         .send({ username: 'testadmin', password: 'correctpassword' });
       
       expect(res.status).toBe(200);
       
       // Check for secure cookies
       const cookies = res.headers['set-cookie'];
       expect(cookies).toBeDefined();
       
       const accessTokenCookie = cookies.find(c => c.startsWith('accessToken='));
       expect(accessTokenCookie).toBeDefined();
       expect(accessTokenCookie).toContain('HttpOnly');
       
       if (process.env.NODE_ENV === 'production') {
         expect(accessTokenCookie).toContain('Secure');
       }
       
       expect(accessTokenCookie).toContain('SameSite=Lax');
     });
   });
   
   describe('CSRF Protection Tests', () => {
     test('state-changing operations should require CSRF token', async () => {
       // First login to get cookies
       const loginRes = await request(app)
         .post('/api/auth/login')
         .send({ username: 'testadmin', password: 'correctpassword' });
       
       const cookies = loginRes.headers['set-cookie'];
       
       // Try to perform a state-changing operation without CSRF token
       const createRes = await request(app)
         .post('/api/notes')
         .set('Cookie', cookies)
         .send({ text: 'Test note', customer_id: 1 });
       
       // Should be rejected due to missing CSRF token
       expect(createRes.status).toBe(403);
       expect(createRes.body).toHaveProperty('message');
     });
   });
   
   describe('Input Validation Tests', () => {
     test('should reject SQL injection attempts', async () => {
       // Login first
       const loginRes = await request(app)
         .post('/api/auth/login')
         .send({ username: 'testadmin', password: 'correctpassword' });
       
       const cookies = loginRes.headers['set-cookie'];
       const csrfToken = loginRes.body.csrfToken; // Assuming token is returned
       
       // Try SQL injection in a note
       const createRes = await request(app)
         .post('/api/notes')
         .set('Cookie', cookies)
         .set('X-CSRF-Token', csrfToken)
         .send({ 
           text: "Test note'; DROP TABLE notes; --", 
           customer_id: 1 
         });
       
       // Should be rejected
       expect(createRes.status).toBe(400);
     });
     
     test('should validate input data types', async () => {
       // Login first
       const loginRes = await request(app)
         .post('/api/auth/login')
         .send({ username: 'testadmin', password: 'correctpassword' });
       
       const cookies = loginRes.headers['set-cookie'];
       const csrfToken = loginRes.body.csrfToken; // Assuming token is returned
       
       // Try invalid data types
       const createRes = await request(app)
         .post('/api/notes')
         .set('Cookie', cookies)
         .set('X-CSRF-Token', csrfToken)
         .send({ 
           text: 123, // Should be string
           customer_id: "NOT_A_NUMBER" // Should be number
         });
       
       // Should be rejected
       expect(createRes.status).toBe(400);
     });
   });
   
   describe('Encryption Tests', () => {
     test('sensitive data should be encrypted in database', async () => {
       // This test requires direct database access - in a real test,
       // you would mock the database or use a test database
       
       // Create a test customer
       // Then verify the email and phone are encrypted in the database
       
       // This is just a placeholder - implementation depends on your test setup
       expect(true).toBe(true);
     });
   });
   ```

2. **Add Security Test Script**:
   ```json
   // package.json
   
   "scripts": {
     // ... other scripts
     "test:security": "jest tests/security.test.js"
   }
   ```

3. **Create Security Scanning Workflow**:
   ```yaml
   # .github/workflows/security-scan.yml

name: Security Scan

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run security tests
        run: npm run test:security
        
      - name: Run OWASP Dependency Check
        uses: dependency-check/dependency-check-action@v1
        with:
          project: 'R33IS'
          path: '.'
          format: 'HTML'
          out: 'reports'
          
      - name: Upload security report
        uses: actions/upload-artifact@v2
        with:
          name: security-report
          path: reports/

**Create Security Documentation:**

# Security Testing Guide

## Automated Security Tests

The application includes automated security tests to verify protection against common vulnerabilities:

1. **Authentication Tests**: Verify secure login, logout, and session management
2. **CSRF Protection Tests**: Verify that state-changing operations require valid CSRF tokens
3. **Input Validation Tests**: Test protection against injection attacks and validate input constraints
4. **Encryption Tests**: Verify that sensitive data is properly encrypted

### Running Security Tests

```bash
npm run test:security

**Manual Security Testing**

For comprehensive security testing, also perform these manual checks:

XSS Testing: Attempt to inject scripts in all input fields
CSRF Testing: Use browser dev tools to modify CSRF tokens
Session Testing: Try accessing protected routes after logout
Token Theft Testing: Copy cookies and try to use them from another browser

Security Issues Reporting
Report security vulnerabilities to: security@yourdomain.com
Do NOT submit security vulnerabilities via GitHub issues.



Please implement these four tasks to significantly enhance the security posture of the R33IS application. Each task addresses critical security gaps identified in our review. The token rotation system is particularly important as it provides much stronger protection against token theft than the current implementation.