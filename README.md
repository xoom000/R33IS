# Route 33 Intelligence System (R33IS) Backend

A comprehensive backend for the Route 33 Intelligence System - a smart, self-learning assistant that helps manage and optimize routes more efficiently by combining journaling, automation, predictive logic, and data analysis.

## Repository Structure

```
/
├── api/                  # Express API code
├── cli/                  # Note + journal CLI tools
├── database/             # SQLite files and migrations
├── migrations/           # Final schema files + README
├── docs/                 # API documentation and manifest
├── .env.example          # Template for API environment variables
├── README.md             # This file
└── package.json          # Project dependencies
```

## System Overview

R33IS is designed to be a modular, field-friendly system that works with or without connectivity. Key components:

- **Customer Management**: Dynamic list of route stops organized by service day
- **Field Journaling**: NFC-triggered notes and structured data collection
- **Workflow-Aware Assistant**: Learns from journaling to anticipate needs
- **Offline-Capable App**: Mobile-first interface with sync capabilities

## Core Features

### Intelligent Note System

Customer notes with:
- Day assignments
- Priority levels
- Source tracking (NFC, voice, manual)
- Completion status
- Read/unread status
- Tagging support
- Route-level notes (not tied to specific customers)

### Journal System

Structured field observations with:
- Customer context
- Categorization (observation, request, issue, etc.)
- Sentiment analysis
- Related item tracking
- Tag support

### Customer Activity Tracking

Comprehensive activity log for all customer interactions:
- Notes
- Journal entries
- Orders
- Visits
- Issues

## Database Schema

The system is built on SQLite with the following key tables:

- `customer_notes`: Quick reminders and observations
- `journal_entries`: Detailed, structured logs
- `customer_activity`: Comprehensive interaction tracking
- `sync_status`: Tracks offline/online sync state

## API Endpoints

See the complete API documentation in `/docs/api-docs.md`.

### Notes API

- `GET /api/notes/today`: Get all notes for today's route stops
- `GET /api/notes/customer/:customerId`: Get all notes for a specific customer
- `GET /api/notes/search`: Search notes with various filters
- `POST /api/notes`: Create a new note (can be customer-specific or route-level)
- `PUT /api/notes/:noteId`: Update a note
- `DELETE /api/notes/:noteId`: Delete a note (SuperAdmin only)

### Journal API

- `GET /api/journal/today`: Get journal entries for today's route
- `GET /api/journal/customer/:customerId`: Get all journal entries for a specific customer
- `GET /api/journal/search`: Search journal entries with various filters
- `POST /api/journal`: Create a new journal entry

## CLI Tool

A command-line interface for interacting with the notes system:

```bash
# Install CLI dependencies
cd cli
npm install

# Make executable
chmod +x note-cli.js

# Run in interactive mode
./note-cli.js

# View today's notes
./note-cli.js today

# View notes for a specific customer
./note-cli.js customer 12345

# Search notes with filters
./note-cli.js search

# Create a new note
./note-cli.js create

# Mark a note as completed
./note-cli.js complete 42

# Mark a note as read
./note-cli.js read 42

# Export today's notes to JSON
./note-cli.js export json

# Export today's notes to TXT
./note-cli.js export txt
```

## Setup Instructions

1. Copy `.env.example` to `.env` and configure your environment:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   npm run migrate
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. For development mode with auto-restart:
   ```bash
   npm run dev
   ```

## Using the CLI Tool

```bash
# Run the CLI tool
npm run cli
```

## Offline Sync Support

The API is designed to support offline usage through the `sync_status` table, which tracks the sync state of notes, journal entries, and other data.

## Authentication & Security

The system uses JWT (JSON Web Token) for authentication with role-based access control:

- `Customer`: Access to own data only
- `Driver`: Access to customers on their route
- `Admin`: Access to most resources
- `SuperAdmin`: Access to all resources, including deletion operations

## Development

Further details about the API structure and implementation can be found in the `/docs` directory.

For more information about development workflows, see the API documentation at `/docs/api-docs.md`.

## License

Proprietary - All Rights Reserved