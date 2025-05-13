// src/services/tokenService.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * Token Management Service
 * 
 * Provides functionality for managing refresh tokens, including:
 * - Creating new refresh tokens
 * - Rotating refresh tokens
 * - Revoking tokens
 * - Cleaning up expired tokens
 */

// Create a new refresh token and store it in the database
const createRefreshToken = async (db, userId) => {
  try {
    // Generate a secure random token ID (this is what we'll store in the cookie)
    const tokenId = crypto.randomBytes(40).toString('hex');
    
    // Hash the token ID for database storage
    const hashedTokenId = await bcrypt.hash(tokenId, 10);
    
    // Set expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Store the token in the database
    const insertToken = () => {
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO refresh_tokens (token_id, user_id, expires_at) VALUES (?, ?, ?)',
          [hashedTokenId, userId, expiresAt.toISOString()],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
    };
    
    await insertToken();
    
    // Return the unhashed token ID to be stored in the cookie
    return tokenId;
  } catch (error) {
    console.error('Error creating refresh token:', error);
    throw new Error('Failed to create refresh token');
  }
};

// Find a refresh token by its ID
const findRefreshToken = async (db, tokenId, userId) => {
  try {
    // We need to find the token by comparing hashed values
    // Get all active tokens for the user
    const getTokens = () => {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM refresh_tokens 
           WHERE user_id = ? 
             AND revoked = 0 
             AND expires_at > datetime('now')`,
          [userId],
          (err, tokens) => {
            if (err) reject(err);
            else resolve(tokens);
          }
        );
      });
    };
    
    const tokens = await getTokens();
    
    // Find a matching token by comparing hashes
    for (const token of tokens) {
      // Compare the provided token ID with each stored hash
      const isMatch = await bcrypt.compare(tokenId, token.token_id);
      if (isMatch) {
        return token;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding refresh token:', error);
    throw new Error('Failed to find refresh token');
  }
};

// Revoke a specific refresh token
const revokeRefreshToken = async (db, tokenId, userId) => {
  try {
    const token = await findRefreshToken(db, tokenId, userId);
    
    if (!token) {
      throw new Error('Invalid or expired refresh token');
    }
    
    // Revoke the token
    const updateToken = () => {
      return new Promise((resolve, reject) => {
        db.run(
          'UPDATE refresh_tokens SET revoked = 1 WHERE id = ?',
          [token.id],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });
    };
    
    await updateToken();
    return true;
  } catch (error) {
    console.error('Error revoking refresh token:', error);
    throw new Error('Failed to revoke refresh token');
  }
};

// Rotate a refresh token - revoke the old one and create a new one
const rotateRefreshToken = async (db, tokenId, userId) => {
  try {
    // Find and validate the token
    const token = await findRefreshToken(db, tokenId, userId);
    
    if (!token) {
      throw new Error('Invalid or expired refresh token');
    }
    
    // Start a transaction to revoke the old token and create a new one
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Revoke the old token
        db.run(
          'UPDATE refresh_tokens SET revoked = 1 WHERE id = ?',
          [token.id],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }
            
            // Create a new token
            const newTokenId = crypto.randomBytes(40).toString('hex');
            const generateHash = async () => {
              return await bcrypt.hash(newTokenId, 10);
            };
            
            generateHash()
              .then(hashedTokenId => {
                // Set expiration date (7 days from now)
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);
                
                // Store the new token
                db.run(
                  'INSERT INTO refresh_tokens (token_id, user_id, expires_at) VALUES (?, ?, ?)',
                  [hashedTokenId, userId, expiresAt.toISOString()],
                  function(err) {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(err);
                    }
                    
                    db.run('COMMIT');
                    resolve(newTokenId);
                  }
                );
              })
              .catch(err => {
                db.run('ROLLBACK');
                reject(err);
              });
          }
        );
      });
    });
  } catch (error) {
    console.error('Error rotating refresh token:', error);
    throw new Error('Failed to rotate refresh token');
  }
};

// Revoke all refresh tokens for a specific user
const revokeAllUserTokens = async (db, userId) => {
  try {
    const updateTokens = () => {
      return new Promise((resolve, reject) => {
        db.run(
          'UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?',
          [userId],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });
    };
    
    const count = await updateTokens();
    return count;
  } catch (error) {
    console.error('Error revoking user tokens:', error);
    throw new Error('Failed to revoke user tokens');
  }
};

// Clean up expired tokens
const cleanupExpiredTokens = async (db) => {
  try {
    const deleteTokens = () => {
      return new Promise((resolve, reject) => {
        db.run(
          "DELETE FROM refresh_tokens WHERE expires_at < datetime('now')",
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });
    };
    
    const count = await deleteTokens();
    console.log(`Removed ${count} expired refresh tokens`);
    return count;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    throw new Error('Failed to clean up expired tokens');
  }
};

// Generate an access token
const generateAccessToken = (payload, expiresIn = '1h') => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'yoursecretkey',
    { expiresIn }
  );
};

module.exports = {
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  generateAccessToken
};