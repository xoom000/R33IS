// src/db/encryptionHooks.js
const { safeEncrypt, safeDecrypt } = require('../services/encryptionService');
const { logger } = require('../middleware/loggerMiddleware');

// Define fields that should be encrypted for each table
const ENCRYPTED_FIELDS = {
  customers: ['Email', 'Phone'],
  notes: ['note_text'],
  journal: ['entry_text'],
  users: ['email']
  // Add more tables and fields as needed
};

/**
 * Automatically encrypt sensitive fields before saving to database
 * 
 * @param {string} tableName - Name of the database table
 * @param {Object} data - Data object to encrypt fields in
 * @returns {Object} - Data with sensitive fields encrypted
 */
const encryptFields = (tableName, data) => {
  // Skip if no encryption is defined for this table or data is undefined
  if (!ENCRYPTED_FIELDS[tableName] || !data) return data;
  
  try {
    // Create a copy of the data to avoid modifying the original
    const encryptedData = { ...data };
    
    // Encrypt each field that should be encrypted
    ENCRYPTED_FIELDS[tableName].forEach(field => {
      if (encryptedData[field] != null) {
        encryptedData[field] = safeEncrypt(encryptedData[field]);
      }
    });
    
    return encryptedData;
  } catch (error) {
    logger.error(`Error encrypting fields for ${tableName}:`, error);
    return data; // Return original data on error
  }
};

/**
 * Automatically decrypt sensitive fields when retrieved from database
 * 
 * @param {string} tableName - Name of the database table
 * @param {Object|Array} data - Data object or array of objects to decrypt fields in
 * @returns {Object|Array} - Data with sensitive fields decrypted
 */
const decryptFields = (tableName, data) => {
  // Skip if no encryption is defined for this table or data is undefined
  if (!ENCRYPTED_FIELDS[tableName] || !data) return data;
  
  try {
    // Handle arrays of objects
    if (Array.isArray(data)) {
      return data.map(item => decryptFields(tableName, item));
    }
    
    // Create a copy of the data to avoid modifying the original
    const decryptedData = { ...data };
    
    // Decrypt each field that should be decrypted
    ENCRYPTED_FIELDS[tableName].forEach(field => {
      if (decryptedData[field] != null) {
        decryptedData[field] = safeDecrypt(decryptedData[field]);
      }
    });
    
    return decryptedData;
  } catch (error) {
    logger.error(`Error decrypting fields for ${tableName}:`, error);
    return data; // Return original data on error
  }
};

/**
 * Create database repository with encryption support
 * 
 * @param {string} tableName - Name of the database table
 * @param {Object} db - SQLite database connection
 * @returns {Object} - Repository with CRUD operations
 */
const createEncryptedRepository = (tableName, db) => {
  return {
    /**
     * Get all records with decryption
     */
    getAll: () => {
      return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
          if (err) reject(err);
          else resolve(decryptFields(tableName, rows));
        });
      });
    },
    
    /**
     * Get a single record by ID with decryption
     */
    getById: (id, idField = 'id') => {
      return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM ${tableName} WHERE ${idField} = ?`, [id], (err, row) => {
          if (err) reject(err);
          else resolve(row ? decryptFields(tableName, row) : null);
        });
      });
    },
    
    /**
     * Create a new record with encryption
     */
    create: (data) => {
      const encryptedData = encryptFields(tableName, data);
      const fields = Object.keys(encryptedData).join(', ');
      const placeholders = Object.keys(encryptedData).map(() => '?').join(', ');
      const values = Object.values(encryptedData);
      
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO ${tableName} (${fields}) VALUES (${placeholders})`,
          values,
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, ...data });
          }
        );
      });
    },
    
    /**
     * Update a record with encryption
     */
    update: (id, data, idField = 'id') => {
      const encryptedData = encryptFields(tableName, data);
      const fields = Object.keys(encryptedData)
        .map(field => `${field} = ?`)
        .join(', ');
      const values = [...Object.values(encryptedData), id];
      
      return new Promise((resolve, reject) => {
        db.run(
          `UPDATE ${tableName} SET ${fields} WHERE ${idField} = ?`,
          values,
          function(err) {
            if (err) reject(err);
            else resolve({ id, ...data });
          }
        );
      });
    },
    
    /**
     * Delete a record
     */
    delete: (id, idField = 'id') => {
      return new Promise((resolve, reject) => {
        db.run(
          `DELETE FROM ${tableName} WHERE ${idField} = ?`,
          [id],
          function(err) {
            if (err) reject(err);
            else resolve({ deleted: this.changes > 0 });
          }
        );
      });
    },
    
    /**
     * Custom query with decryption
     */
    query: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(decryptFields(tableName, rows));
        });
      });
    }
  };
};

module.exports = {
  encryptFields,
  decryptFields,
  createEncryptedRepository,
  ENCRYPTED_FIELDS
};