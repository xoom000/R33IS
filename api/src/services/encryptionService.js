// src/services/encryptionService.js
const crypto = require('crypto');
const { logger } = require('../middleware/loggerMiddleware');

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_development_key_must_change_in_production';
const IV_LENGTH = 16; // For AES, this is always 16 bytes
const ALGORITHM = 'aes-256-cbc';

// Ensure the encryption key is properly set in production
if (process.env.NODE_ENV === 'production' && 
    (ENCRYPTION_KEY === 'default_development_key_must_change_in_production' || 
     ENCRYPTION_KEY.length !== 64)) {
  logger.error('Invalid encryption key configuration in production environment');
  throw new Error('Production encryption key not properly configured');
}

// Create a proper key buffer from the hex key
const getKeyBuffer = () => {
  try {
    // Convert hex string to buffer if needed
    return Buffer.from(ENCRYPTION_KEY, 'hex');
  } catch (error) {
    // If we can't convert to hex, use a SHA-256 hash of the key to get the right length
    return crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  }
};

/**
 * Encrypt a string value
 * 
 * @param {string} text - Plain text to encrypt
 * @returns {string|null} - Encrypted text as hex string with IV prepended, or null if input is null/undefined
 */
const encrypt = (text) => {
  // Return null for null/undefined values
  if (text == null) return null;
  
  try {
    // Convert text to string if it's not already
    const textToEncrypt = String(text);
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher with key and iv
    const cipher = crypto.createCipheriv(
      ALGORITHM, 
      getKeyBuffer(), 
      iv
    );
    
    // Encrypt the data
    let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data as a single string (IV is needed for decryption)
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt an encrypted string value
 * 
 * @param {string} text - Encrypted text (IV:encryptedData format)
 * @returns {string|null} - Decrypted plain text, or null if input is null/undefined
 */
const decrypt = (text) => {
  // Return null for null/undefined values
  if (text == null) return null;
  
  try {
    // Split the IV and encrypted text
    const parts = text.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    
    // Create decipher with key and iv
    const decipher = crypto.createDecipheriv(
      ALGORITHM, 
      getKeyBuffer(), 
      iv
    );
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Check if a value is already encrypted
 * 
 * @param {string} text - Text to check
 * @returns {boolean} - True if the text appears to be in encrypted format
 */
const isEncrypted = (text) => {
  if (text == null) return false;
  
  // Check the format: hexadecimal IV (32 chars) + ':' + encrypted data (hex)
  const encryptedPattern = /^[0-9a-f]{32}:[0-9a-f]+$/i;
  return encryptedPattern.test(text);
};

/**
 * Safely encrypt a value (if not already encrypted)
 * 
 * @param {string} text - Text to encrypt
 * @returns {string|null} - Encrypted text or null
 */
const safeEncrypt = (text) => {
  if (text == null) return null;
  if (isEncrypted(text)) return text;
  return encrypt(text);
};

/**
 * Safely decrypt a value (if it is encrypted)
 * 
 * @param {string} text - Text to decrypt
 * @returns {string|null} - Decrypted text or original if not encrypted
 */
const safeDecrypt = (text) => {
  if (text == null) return null;
  if (!isEncrypted(text)) return text;
  return decrypt(text);
};

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  safeEncrypt,
  safeDecrypt
};