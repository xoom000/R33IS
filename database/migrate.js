// migrate.js - Database migration runner
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Configure database path - use the same as the main app
const DB_PATH = path.join(__dirname, 'master.db');

// Initialize database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the database');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON', (err) => {
  if (err) {
    console.error('Error enabling foreign keys:', err);
    process.exit(1);
  }
});

// Create migrations table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error('Error creating migrations table:', err);
    process.exit(1);
  }
  
  // Get list of applied migrations
  db.all('SELECT name FROM migrations', [], (err, appliedMigrations) => {
    if (err) {
      console.error('Error getting applied migrations:', err);
      process.exit(1);
    }
    
    const appliedMigrationNames = appliedMigrations.map(m => m.name);
    console.log('Already applied migrations:', appliedMigrationNames);
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    fs.readdir(migrationsDir, (err, files) => {
      if (err) {
        console.error('Error reading migrations directory:', err);
        process.exit(1);
      }
      
      // Filter for .sql files and sort them
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      console.log('Found migration files:', migrationFiles);
      
      // Apply migrations in sequence
      runMigrations(migrationFiles, appliedMigrationNames, migrationsDir);
    });
  });
});

// Function to run migrations sequentially
function runMigrations(files, appliedMigrations, migrationsDir, index = 0) {
  if (index >= files.length) {
    console.log('All migrations applied successfully');
    db.close();
    return;
  }
  
  const file = files[index];
  
  // Skip if already applied
  if (appliedMigrations.includes(file)) {
    console.log(`Migration ${file} already applied, skipping`);
    runMigrations(files, appliedMigrations, migrationsDir, index + 1);
    return;
  }
  
  console.log(`Applying migration: ${file}`);
  
  // Read migration file
  fs.readFile(path.join(migrationsDir, file), 'utf8', (err, sql) => {
    if (err) {
      console.error(`Error reading migration file ${file}:`, err);
      process.exit(1);
    }
    
    // Begin transaction
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('Error beginning transaction:', err);
        process.exit(1);
      }
      
      // Execute migration SQL
      db.exec(sql, (err) => {
        if (err) {
          console.error(`Error executing migration ${file}:`, err);
          db.run('ROLLBACK', () => {
            process.exit(1);
          });
          return;
        }
        
        // Record migration as applied
        db.run('INSERT INTO migrations (name) VALUES (?)', [file], (err) => {
          if (err) {
            console.error(`Error recording migration ${file}:`, err);
            db.run('ROLLBACK', () => {
              process.exit(1);
            });
            return;
          }
          
          // Commit transaction
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Error committing transaction:', err);
              process.exit(1);
            }
            
            console.log(`Migration ${file} applied successfully`);
            
            // Continue with next migration
            runMigrations(files, appliedMigrations, migrationsDir, index + 1);
          });
        });
      });
    });
  });
}