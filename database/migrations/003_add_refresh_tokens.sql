-- Migration: 003_add_refresh_tokens.sql
-- Description: Adds refresh token table for secure token rotation

-- Create the refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL UNIQUE,  -- Hashed token identifier
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked BOOLEAN DEFAULT 0,      -- SQLite uses 0/1 instead of true/false
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_id ON refresh_tokens(token_id);

-- Add view for active tokens only (not revoked, not expired)
CREATE VIEW IF NOT EXISTS active_refresh_tokens AS
SELECT * FROM refresh_tokens 
WHERE revoked = 0 AND expires_at > datetime('now');