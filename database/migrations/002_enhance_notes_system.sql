-- 002_enhance_notes_system.sql
-- Migration to enhance the R33IS notes and journal system based on review

-- Add tags field to customer_notes table
ALTER TABLE customer_notes ADD COLUMN tags TEXT;

-- Add is_read flag to customer_notes table
ALTER TABLE customer_notes ADD COLUMN is_read BOOLEAN DEFAULT 0;

-- Update customer_notes to make customer_id optional (for route-level notes)
-- First, need to drop and recreate the foreign key constraint
-- Start by creating a temporary table with the new structure
CREATE TABLE customer_notes_temp (
    note_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_day TEXT CHECK (assigned_day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    source TEXT CHECK (source IN ('manual', 'gps', 'nfc', 'call', 'voice', 'ai')) DEFAULT 'manual',
    is_completed BOOLEAN DEFAULT 0,
    completed_at DATETIME,
    priority TEXT CHECK (priority IN ('low', 'normal', 'high')) DEFAULT 'normal',
    tags TEXT,
    is_read BOOLEAN DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(CustomerNumber)
);

-- Copy data from the old table to the new one
INSERT INTO customer_notes_temp
    (note_id, customer_id, text, created_at, assigned_day, source, 
     is_completed, completed_at, priority, tags, is_read)
SELECT 
    note_id, customer_id, text, created_at, assigned_day, source, 
    is_completed, completed_at, priority, tags, is_read
FROM customer_notes;

-- Drop the old table
DROP TABLE customer_notes;

-- Rename the new table to the original name
ALTER TABLE customer_notes_temp RENAME TO customer_notes;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_day ON customer_notes(assigned_day);
CREATE INDEX IF NOT EXISTS idx_customer_notes_tags ON customer_notes(tags);
CREATE INDEX IF NOT EXISTS idx_customer_notes_completed ON customer_notes(is_completed);
CREATE INDEX IF NOT EXISTS idx_customer_notes_read ON customer_notes(is_read);