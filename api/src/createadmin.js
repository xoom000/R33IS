// create-admin.js
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Update this path to match your database location
const dbPath = path.join(__dirname, '../../database/master.db');
const db = new sqlite3.Database(dbPath);

async function createSuperAdmin() {
  try {
    // Create users table if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          user_id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          customer_number INTEGER NOT NULL,
          role TEXT CHECK (role IN ('Customer', 'Driver', 'SuperAdmin')) DEFAULT 'Customer',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_number) REFERENCES customers(CustomerNumber)
        )
      `, err => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Get the first customer number from the database to use for admin
    const customer = await new Promise((resolve, reject) => {
      db.get('SELECT CustomerNumber FROM customers LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!customer) {
      throw new Error('No customers found in database');
    }

    // Admin credentials - CHANGE THESE!
    const adminUsername = 'admin';
    const adminPassword = 'admin123';

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

    // Insert admin user
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, password_hash, customer_number, role) VALUES (?, ?, ?, ?)',
        [adminUsername, hashedPassword, customer.CustomerNumber, 'SuperAdmin'],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              console.log('Admin user already exists');
              resolve();
            } else {
              reject(err);
            }
          } else {
            console.log('SuperAdmin created successfully');
            resolve();
          }
        }
      );
    });

    console.log(`SuperAdmin user created:
    Username: ${adminUsername}
    Password: ${adminPassword}
    Role: SuperAdmin
    Customer Number: ${customer.CustomerNumber}`);

  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    db.close();
  }
}

createSuperAdmin();
