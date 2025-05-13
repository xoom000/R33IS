# R33IS Security Implementation

## Overview

This document describes the security enhancements implemented for the R33IS application. These improvements address critical security vulnerabilities and follow industry best practices for web application security.

## 1. Token-Based Authentication with HttpOnly Cookies

### Implementation Details

We've replaced localStorage token storage with secure httpOnly cookies, significantly improving the application's resistance to XSS attacks.

#### Key Components:

- **Cookie-Based JWT Storage**: Access and refresh tokens are stored in httpOnly, secure cookies
- **Token Rotation**: Implemented refresh token rotation to prevent token reuse attacks
- **Server-Side Token Tracking**: Refresh tokens are stored and tracked in the database
- **Automatic Token Refresh**: Access tokens are refreshed before they expire

#### Cookie Security Configuration:

```javascript
// Cookie security configuration
{
  httpOnly: true,                              // Prevents JavaScript access
  secure: process.env.NODE_ENV === 'production', // Only sent over HTTPS
  sameSite: 'lax',                             // CSRF protection
  path: '/',                                   // Cookie scope
  maxAge: 1 * 60 * 60 * 1000                   // Expiration (1 hour)
}
```

#### Database Schema for Token Storage:

```sql
CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL UNIQUE,    -- Hashed token identifier
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

### Benefits

- **XSS Protection**: Tokens cannot be accessed via JavaScript due to httpOnly flag
- **CSRF Protection**: Implemented CSRF protection using sameSite cookie attribute and CSRF tokens
- **Token Theft Protection**: Refresh tokens are rotated on use, limiting the damage of token theft
- **Improved UX**: Automatic token refresh prevents session timeouts
- **Revocation Support**: Server can revoke all tokens for a user during logout or security incidents

## 2. Content Security Policy Implementation

### Implementation Details

We've implemented a comprehensive Content Security Policy (CSP) to provide an additional layer of defense against XSS attacks and other code injection vulnerabilities.

#### CSP Configuration:

```javascript
// CSP Directives
{
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  imgSrc: ["'self'", "data:", "https://api.mapbox.com"],
  connectSrc: ["'self'", "https://api.mapbox.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
  reportUri: '/api/security/csp-report'
}
```

#### CSP Violation Reporting:

The application includes a CSP violation reporting endpoint that logs any policy violations, allowing for continuous refinement of the policy and detection of potential attacks.

```javascript
// CSP Violation Reporting Endpoint
router.post('/csp-report', (req, res) => {
  const cspReport = req.body['csp-report'] || req.body;
  logger.warn('CSP Violation:', {
    report: cspReport,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  res.status(204).end();
});
```

### Benefits

- **XSS Mitigation**: Restricts what resources can be loaded, preventing many XSS attacks
- **Click-jacking Protection**: Prevents the application from being embedded in frames
- **Violation Monitoring**: CSP violations are logged for security monitoring
- **Defense in Depth**: Provides an additional layer of security beyond input validation

## 3. Sensitive Data Encryption

### Implementation Details

We've implemented field-level encryption for sensitive data stored in the database, ensuring that even if the database is compromised, sensitive information remains protected.

#### Encryption Service:

```javascript
// Encryption Service
const encrypt = (text) => {
  if (text == null) return null;
  
  // Generate a random initialization vector
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher with key and iv
  const cipher = crypto.createCipheriv(ALGORITHM, getKeyBuffer(), iv);
  
  // Encrypt the data
  let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return IV + encrypted data
  return `${iv.toString('hex')}:${encrypted}`;
};
```

#### Encrypted Fields by Table:

```javascript
// Fields to encrypt by table
const ENCRYPTED_FIELDS = {
  customers: ['Email', 'Phone'],
  notes: ['note_text'],
  journal: ['entry_text'],
  users: ['email']
};
```

#### Database Integration:

We've created database hooks that automatically encrypt/decrypt sensitive fields during database operations, making the encryption layer transparent to the application code.

```javascript
// Example encrypted repository usage
const customersRepo = createEncryptedRepository('customers', db);
const customer = await customersRepo.getById(1); // Data automatically decrypted
await customersRepo.update(1, { Email: 'new@example.com' }); // Data automatically encrypted
```

### Benefits

- **Data Protection at Rest**: Sensitive data is encrypted in the database
- **Transparent Encryption Layer**: Application code doesn't need to handle encryption/decryption
- **Performance Optimized**: Only selected sensitive fields are encrypted
- **Defense in Depth**: Even if the database is compromised, sensitive data remains protected

## 4. Comprehensive Security Headers

### Implementation Details

We've implemented a robust set of security headers to protect against various attacks and inform browsers about security policies.

#### Implemented Headers:

```javascript
// Security Headers
app.use(helmet.noSniff()); // X-Content-Type-Options: nosniff
app.use(helmet.frameguard({ action: 'deny' })); // X-Frame-Options: DENY
app.use(helmet.hsts({ // Strict-Transport-Security
  maxAge: 15552000,
  includeSubDomains: true,
  preload: true
}));
app.use(helmet.referrerPolicy({ policy: 'same-origin' })); // Referrer-Policy
app.use(helmet.xssFilter()); // X-XSS-Protection
app.use(helmet.ieNoOpen()); // X-Download-Options: noopen
app.use(helmet.dnsPrefetchControl({ allow: false })); // X-DNS-Prefetch-Control
```

#### Permissions Policy:

```javascript
// Permissions Policy (formerly Feature Policy)
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy', 
    'geolocation=self, microphone=(), camera=(), fullscreen=self'
  );
  next();
});
```

### Benefits

- **Click-jacking Protection**: Prevents embedding the site in frames
- **MIME Sniffing Protection**: Prevents MIME type confusion attacks
- **Transport Security Enforcement**: Requires HTTPS connections
- **Referrer Policy Control**: Controls what information is sent in the Referer header
- **Feature Control**: Restricts access to browser features

## 5. Security Testing

### Implementation Details

We've implemented a security testing suite to verify the security enhancements and catch regressions.

#### Test Coverage:

```javascript
// Security test suite
describe('Authentication Security Tests', () => {
  test('login should set secure cookies');
  test('secure routes should reject unauthenticated access');
  test('login should reject incorrect credentials');
  test('logout should clear auth cookies');
});

describe('CSRF Protection Tests', () => {
  test('state-changing operations should require CSRF token');
});

describe('Content Security Policy Tests', () => {
  test('security headers should be present');
});

describe('Encryption Tests', () => {
  test('encryption service should encrypt and decrypt values');
  test('encryption hooks should encrypt and decrypt fields');
});
```

### Benefits

- **Regression Detection**: Catches security regressions early
- **Verification**: Ensures security features are working as expected
- **Documentation**: Tests serve as executable documentation
- **Continuous Improvement**: Provides a foundation for expanding security coverage

## Security Best Practices

In addition to the specific implementations above, we've followed these general security best practices:

1. **Defense in Depth**: Multiple layers of security are implemented
2. **Principle of Least Privilege**: Components only have access to what they need
3. **Secure Defaults**: Security features are enabled by default
4. **Fail Securely**: Errors default to secure states
5. **Input Validation**: Both client and server-side validation is implemented
6. **Output Encoding**: Data is properly encoded when displayed
7. **Security by Design**: Security considerations were part of the design process

## Deployment Considerations

### Environment Variables

The following environment variables should be set in production:

- `JWT_SECRET`: Secret key for JWT signing
- `REFRESH_TOKEN_SECRET`: Secret key for refresh token signing
- `ENCRYPTION_KEY`: Key for encrypting sensitive data
- `NODE_ENV`: Should be set to "production"
- `COOKIE_SECRET`: Secret for cookie signing

### Secure Key Generation

Generate secure keys using:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### HTTPS Configuration

The application must be deployed behind HTTPS in production to ensure the security of cookies and transmitted data.

## Security Monitoring and Incident Response

### Monitoring

- CSP violations are logged to detect potential attacks
- Authentication failures are logged for monitoring
- Token usage and revocation are tracked

### Incident Response

In case of a security incident:

1. Use the token revocation functionality to invalidate all tokens for affected users
2. Review CSP violation logs for signs of attack
3. Check encryption service logs for unusual activity
4. Rotate encryption and JWT keys if necessary

## Conclusion

These security enhancements significantly improve the security posture of the R33IS application by addressing common web application vulnerabilities and following industry best practices. The implementation provides defense-in-depth protection against a wide range of attacks while maintaining a good user experience.