# Route 33 Intelligence System (R33IS) Backend

A comprehensive backend for the Route 33 Intelligence System - a smart, self-learning assistant that helps manage and optimize routes more efficiently by combining journaling, automation, predictive logic, and data analysis.

## ⚠️ SECURITY NOTICE

This repository contains **NO SENSITIVE DATA**. All customer data, transactions, and other confidential information have been removed from the repository. 

For development purposes:
- Sample data must be generated separately
- Database files should never be committed to this repository
- Environment variables should be kept in `.env` files (not committed)

## Repository Structure

```
/
├── api/                  # Express API code
├── cli/                  # Note + journal CLI tools
├── database/             # SQLite schema (NO DATA)
├── migrations/           # Schema migration files
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

## License

Proprietary - All Rights Reserved
