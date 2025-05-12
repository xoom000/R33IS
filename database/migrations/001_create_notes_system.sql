-- 001_create_notes_system.sql
-- Migration to add the R33IS notes and journal system

-- Customer Notes Table
CREATE TABLE IF NOT EXISTS customer_notes (
    note_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_day TEXT CHECK (assigned_day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    source TEXT CHECK (source IN ('manual', 'gps', 'nfc', 'call', 'voice', 'ai')) DEFAULT 'manual',
    is_completed BOOLEAN DEFAULT 0,
    completed_at DATETIME,
    priority TEXT CHECK (priority IN ('low', 'normal', 'high')) DEFAULT 'normal',
    FOREIGN KEY (customer_id) REFERENCES customers(CustomerNumber)
);

-- Journal Entries Table - For more detailed, structured logs
CREATE TABLE IF NOT EXISTS journal_entries (
    entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    entry_type TEXT CHECK (entry_type IN ('observation', 'request', 'issue', 'followup', 'other')) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    location TEXT,
    service_day TEXT CHECK (service_day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    related_items TEXT, -- JSON array of related item IDs
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    sentiment_score REAL, -- For AI-based sentiment analysis
    tags TEXT, -- Comma-separated tags for searchability
    source TEXT CHECK (source IN ('manual', 'gps', 'nfc', 'call', 'voice', 'ai')) DEFAULT 'manual',
    FOREIGN KEY (customer_id) REFERENCES customers(CustomerNumber)
);

-- Customer Activity Log - For tracking all interactions
CREATE TABLE IF NOT EXISTS customer_activity (
    activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    activity_type TEXT CHECK (activity_type IN ('visit', 'call', 'order', 'note', 'journal', 'issue', 'other')) NOT NULL,
    description TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT, -- User/driver ID or system identifier
    reference_id TEXT, -- Related ID (order_id, note_id, etc.)
    reference_type TEXT, -- Type of reference ('note', 'journal', 'order', etc.)
    FOREIGN KEY (customer_id) REFERENCES customers(CustomerNumber)
);

-- Sync Status Table - For offline functionality
CREATE TABLE IF NOT EXISTS sync_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'note', 'journal', 'activity', etc.
    entity_id INTEGER NOT NULL, -- ID of the related entity
    is_synced BOOLEAN DEFAULT 0,
    local_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    server_updated_at DATETIME,
    retry_count INTEGER DEFAULT 0,
    sync_error TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_day ON customer_notes(assigned_day);
CREATE INDEX IF NOT EXISTS idx_journal_entries_customer ON journal_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_day ON journal_entries(service_day);
CREATE INDEX IF NOT EXISTS idx_customer_activity_customer ON customer_activity(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_activity_type ON customer_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_sync_status_entity ON sync_status(entity_type, entity_id);