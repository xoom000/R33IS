// tests/security.test.js
// Security test suite for verifying security enhancements

const request = require('supertest');
const app = require('../src/server');
const { encryptFields, decryptFields } = require('../src/db/encryptionHooks');
const encryptionService = require('../src/services/encryptionService');

describe('Authentication Security Tests', () => {
  // Test credentials - don't use real passwords in tests
  const testCredentials = {
    username: 'securitytestuser',
    password: 'TestPassword123!',
    customerNumber: '12345'
  };
  
  let authCookies = [];
  
  // Helper to extract cookies from response
  const extractCookies = (res) => {
    const cookies = {};
    if (res.headers['set-cookie']) {
      res.headers['set-cookie'].forEach(cookie => {
        const [name, ...rest] = cookie.split('=');
        const value = rest.join('=').split(';')[0];
        cookies[name] = value;
      });
    }
    return cookies;
  };
  
  test('login should reject incorrect credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: testCredentials.username,
        password: 'wrongpassword'
      });
    
    expect(res.status).toBe(401);
  });
  
  test('secure routes should reject unauthenticated access', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
  });
  
  test('login should set secure cookies', async () => {
    // Skip this test in CI environments where we don't have a test database
    if (process.env.CI) {
      return;
    }
    
    const res = await request(app)
      .post('/api/auth/login')
      .send(testCredentials);
    
    expect(res.status).toBe(200);
    
    // Check for secure cookies
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    
    // Store cookies for subsequent tests
    authCookies = cookies;
    
    // Test cookie properties
    const accessTokenCookie = cookies.find(c => c.includes('accessToken='));
    expect(accessTokenCookie).toBeDefined();
    expect(accessTokenCookie).toContain('HttpOnly');
    
    if (process.env.NODE_ENV === 'production') {
      expect(accessTokenCookie).toContain('Secure');
    }
    
    expect(accessTokenCookie).toContain('SameSite=Lax');
    
    // Test refresh token cookie
    const refreshTokenCookie = cookies.find(c => c.includes('refreshToken='));
    expect(refreshTokenCookie).toBeDefined();
    expect(refreshTokenCookie).toContain('HttpOnly');
  });
  
  test('logout should clear auth cookies', async () => {
    // Skip this test if we don't have auth cookies from previous test
    if (!authCookies.length) {
      return;
    }
    
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', authCookies);
    
    expect(res.status).toBe(200);
    
    // Check that cookies are cleared
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    
    const accessTokenCookie = cookies.find(c => c.includes('accessToken='));
    const refreshTokenCookie = cookies.find(c => c.includes('refreshToken='));
    
    expect(accessTokenCookie).toBeDefined();
    expect(refreshTokenCookie).toBeDefined();
    
    // Cookies should be cleared (empty or expires in past)
    expect(accessTokenCookie).toMatch(/=(;|$)/);
    expect(refreshTokenCookie).toMatch(/=(;|$)/);
  });
});

describe('CSRF Protection Tests', () => {
  test('state-changing operations should require CSRF token', async () => {
    // This test is simplified - in a real test suite would need to get valid auth cookies first
    
    // Try to perform a state-changing operation without CSRF token
    const res = await request(app)
      .post('/api/notes')
      .send({ text: 'Test note', customer_id: 1 });
    
    // Should be rejected (either 401 for no auth or 403 for CSRF)
    expect([401, 403]).toContain(res.status);
  });
});

describe('Content Security Policy Tests', () => {
  test('security headers should be present', async () => {
    const res = await request(app).get('/api/security/headers');
    
    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty('content-security-policy');
    expect(res.headers).toHaveProperty('x-content-type-options');
    expect(res.headers).toHaveProperty('x-frame-options');
  });
});

describe('Encryption Tests', () => {
  test('encryption service should encrypt and decrypt values', () => {
    const testValue = 'test@example.com';
    const encrypted = encryptionService.encrypt(testValue);
    
    // Encrypted value should be different from original
    expect(encrypted).not.toBe(testValue);
    
    // Should be in the expected format (hex IV + ':' + hex encrypted data)
    expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+$/i);
    
    // Should decrypt back to original
    const decrypted = encryptionService.decrypt(encrypted);
    expect(decrypted).toBe(testValue);
  });
  
  test('encryption hooks should encrypt and decrypt fields', () => {
    const testData = {
      Email: 'test@example.com',
      Phone: '555-123-4567',
      Name: 'Test User' // Should not be encrypted
    };
    
    // Encrypt the data
    const encrypted = encryptFields('customers', testData);
    
    // Email and Phone should be encrypted
    expect(encrypted.Email).not.toBe(testData.Email);
    expect(encrypted.Phone).not.toBe(testData.Phone);
    
    // Name should not be encrypted
    expect(encrypted.Name).toBe(testData.Name);
    
    // Encrypted values should be detected by isEncrypted
    expect(encryptionService.isEncrypted(encrypted.Email)).toBe(true);
    expect(encryptionService.isEncrypted(encrypted.Phone)).toBe(true);
    
    // Should decrypt back to original
    const decrypted = decryptFields('customers', encrypted);
    expect(decrypted.Email).toBe(testData.Email);
    expect(decrypted.Phone).toBe(testData.Phone);
    expect(decrypted.Name).toBe(testData.Name);
  });
});

// Additional test suites as needed...