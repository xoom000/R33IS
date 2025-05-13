# R33IS Database Migrations

This directory contains the database migrations for the Route 33 Intelligence System (R33IS).

## Migration Files

- `001_create_notes_system.sql`: Initial schema for the notes system
  - Creates tables: customer_notes, journal_entries, customer_activity, sync_status
  - Sets up indexes and constraints

- `002_enhance_notes_system.sql`: Enhancements to the notes system
  - Adds tags field to customer_notes
  - Adds is_read flag to customer_notes
  - Makes customer_id optional to support route-level notes
  - Updates indexes

## Running Migrations

The migrations can be run using the migration runner script:

```bash
cd /home/xoom000/mission_api/database
node migrate.js
```

This will execute all pending migrations in order.

## Migration Runner

The migration runner (`migrate.js`) does the following:
1. Connects to the SQLite database
2. Creates a migrations table if it doesn't exist
3. Checks which migrations have already been applied
4. Runs any pending migrations in order
5. Records each migration in the migrations table

## Database Schema

The main tables added by these migrations are:

### customer_notes
- `note_id`: Primary key
- `customer_id`: Foreign key to customers table (optional)
- `text`: Note content
- `created_at`: Creation timestamp
- `assigned_day`: Day of the week this note is relevant for
- `source`: How the note was created (manual, nfc, gps, voice, call, ai)
- `is_completed`: Whether the note has been completed
- `completed_at`: When the note was completed
- `priority`: Priority level (low, normal, high)
- `tags`: Comma-separated tags
- `is_read`: Whether the note has been read

### journal_entries
- `entry_id`: Primary key
- `customer_id`: Foreign key to customers table
- `entry_type`: Type of entry (observation, request, issue, followup, other)
- `content`: Journal entry content
- `created_at`: Creation timestamp
- `location`: Physical location where the entry was created
- `service_day`: Day of the week this entry is relevant for
- `related_items`: JSON array of related item IDs
- `sentiment`: Detected sentiment (positive, neutral, negative)
- `sentiment_score`: Numerical sentiment score
- `tags`: Comma-separated tags
- `source`: How the entry was created (manual, nfc, gps, voice, call, ai)

### customer_activity
- `activity_id`: Primary key
- `customer_id`: Foreign key to customers table
- `activity_type`: Type of activity (note, journal, etc.)
- `description`: Description of the activity
- `created_at`: Creation timestamp
- `created_by`: Who created the activity
- `reference_id`: ID of the related entity
- `reference_type`: Type of the related entity

### sync_status
- `id`: Primary key
- `entity_type`: Type of entity (note, journal, etc.)
- `entity_id`: ID of the entity
- `is_synced`: Whether the entity is synced with the server
- `local_updated_at`: When the entity was updated locally
- `server_updated_at`: When the entity was last synced with the server
- `retry_count`: Number of sync retry attempts
- `sync_error`: Last sync error message