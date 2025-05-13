# Route 33 Intelligence System (R33IS) API Documentation

## Authentication

The R33IS API uses JWT (JSON Web Token) for authentication. All protected routes require a valid JWT token in the Authorization header.

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### Register a New User
```
POST /auth/register
```

Request Body:
```json
{
  "username": "username",
  "password": "password",
  "customer_number": 12345
}
```

Response (201 Success):
```json
{
  "success": true,
  "message": "User registered successfully",
  "username": "username",
  "customerNumber": 12345,
  "accountName": "Customer Name",
  "role": "Customer"
}
```

#### Login
```
POST /auth/login
```

Request Body:
```json
{
  "username": "username",
  "password": "password"
}
```

Alternative Request Body (Legacy Support):
```json
{
  "customerNumber": 12345,
  "password": "password"
}
```

Response (200 Success):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "user": {
    "id": 12345,
    "customerNumber": 12345,
    "name": "Customer Name",
    "role": "Customer",
    "username": "username"
  }
}
```

#### Get Current User
```
GET /auth/me
```

Headers:
```
Authorization: Bearer <token>
```

Response (200 Success):
```json
{
  "id": 12345,
  "name": "Customer Name",
  "role": "Customer",
  "customerNumber": 12345,
  "username": "username"
}
```

#### Logout
```
POST /auth/logout
```

Response (200 Success):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Note System API

### Get Today's Notes
```
GET /notes/today
```

Headers:
```
Authorization: Bearer <token>
```

Response (200 Success):
```json
{
  "success": true,
  "date": "2025-05-12T12:34:56.789Z",
  "day": "Monday",
  "route_notes": [
    {
      "note_id": 1,
      "customer_id": null,
      "text": "Route-level note example",
      "created_at": "2025-05-12T08:00:00.000Z",
      "assigned_day": "Monday",
      "source": "manual",
      "is_completed": 0,
      "completed_at": null,
      "priority": "normal",
      "tags": "route,reminder",
      "is_read": 0,
      "customer_name": "Route Note"
    }
  ],
  "customerCount": 2,
  "noteCount": 3,
  "customers": [
    {
      "customer": {
        "CustomerNumber": 12345,
        "AccountName": "Customer A",
        "RouteNumber": "33"
      },
      "notes": [
        {
          "note_id": 2,
          "customer_id": 12345,
          "text": "Customer note example",
          "created_at": "2025-05-12T09:00:00.000Z",
          "assigned_day": "Monday",
          "source": "manual",
          "is_completed": 0,
          "completed_at": null,
          "priority": "high",
          "tags": "inventory,followup",
          "is_read": 0,
          "customer_name": "Customer A"
        }
      ]
    },
    {
      "customer": {
        "CustomerNumber": 67890,
        "AccountName": "Customer B",
        "RouteNumber": "33"
      },
      "notes": [
        {
          "note_id": 3,
          "customer_id": 67890,
          "text": "Another customer note",
          "created_at": "2025-05-12T10:00:00.000Z",
          "assigned_day": "Monday",
          "source": "nfc",
          "is_completed": 0,
          "completed_at": null,
          "priority": "normal",
          "tags": "equipment,issue",
          "is_read": 1,
          "customer_name": "Customer B"
        }
      ]
    }
  ]
}
```

### Get Customer Notes
```
GET /notes/customer/:customerId
```

Headers:
```
Authorization: Bearer <token>
```

Query Parameters (all optional):
- `day`: Filter by day of week (Monday, Tuesday, etc.)
- `completed`: Filter by completion status (true/false)
- `read`: Filter by read status (true/false)
- `priority`: Filter by priority (low, normal, high)
- `tags`: Filter by tags (partial match)

Response (200 Success):
```json
{
  "success": true,
  "customer_id": 12345,
  "count": 2,
  "notes": [
    {
      "note_id": 2,
      "customer_id": 12345,
      "text": "Customer note example",
      "created_at": "2025-05-12T09:00:00.000Z",
      "assigned_day": "Monday",
      "source": "manual",
      "is_completed": 0,
      "completed_at": null,
      "priority": "high",
      "tags": "inventory,followup",
      "is_read": 0
    },
    {
      "note_id": 4,
      "customer_id": 12345,
      "text": "Another note for this customer",
      "created_at": "2025-05-11T14:00:00.000Z",
      "assigned_day": "Tuesday",
      "source": "voice",
      "is_completed": 1,
      "completed_at": "2025-05-12T08:30:00.000Z",
      "priority": "normal",
      "tags": "order,completed",
      "is_read": 1
    }
  ]
}
```

### Search Notes
```
GET /notes/search
```

Headers:
```
Authorization: Bearer <token>
```

Query Parameters (all optional):
- `q`: Text search query
- `customer_id`: Filter by customer ID
- `day`: Filter by day of week
- `completed`: Filter by completion status (true/false)
- `read`: Filter by read status (true/false)
- `priority`: Filter by priority (low, normal, high)
- `tags`: Filter by tags (partial match)
- `source`: Filter by source (manual, nfc, gps, voice, call, ai)
- `from_date`: Filter by created date (start)
- `to_date`: Filter by created date (end)
- `route`: Filter by route number

Response (200 Success):
```json
{
  "success": true,
  "count": 3,
  "notes": [
    {
      "note_id": 2,
      "customer_id": 12345,
      "text": "Customer note example",
      "created_at": "2025-05-12T09:00:00.000Z",
      "assigned_day": "Monday",
      "source": "manual",
      "is_completed": 0,
      "completed_at": null,
      "priority": "high",
      "tags": "inventory,followup",
      "is_read": 0,
      "customer_name": "Customer A",
      "route_number": "33"
    },
    {
      "note_id": 3,
      "customer_id": 67890,
      "text": "Another customer note",
      "created_at": "2025-05-12T10:00:00.000Z",
      "assigned_day": "Monday",
      "source": "nfc",
      "is_completed": 0,
      "completed_at": null,
      "priority": "normal",
      "tags": "equipment,issue",
      "is_read": 1,
      "customer_name": "Customer B",
      "route_number": "33"
    },
    {
      "note_id": 1,
      "customer_id": null,
      "text": "Route-level note example",
      "created_at": "2025-05-12T08:00:00.000Z",
      "assigned_day": "Monday",
      "source": "manual",
      "is_completed": 0,
      "completed_at": null,
      "priority": "normal",
      "tags": "route,reminder",
      "is_read": 0,
      "customer_name": null,
      "route_number": null
    }
  ]
}
```

### Create Note
```
POST /notes
```

Headers:
```
Authorization: Bearer <token>
```

Request Body:
```json
{
  "customer_id": 12345,  // Optional - If omitted, creates a route-level note
  "text": "Note text here",
  "assigned_day": "Monday",  // Optional - Defaults to current day
  "source": "manual",  // Optional - Defaults to "manual"
  "priority": "high",  // Optional - Defaults to "normal"
  "tags": "inventory,followup"  // Optional
}
```

Response (201 Success):
```json
{
  "success": true,
  "note": {
    "note_id": 5,
    "customer_id": 12345,
    "text": "Note text here",
    "created_at": "2025-05-12T12:34:56.789Z",
    "assigned_day": "Monday",
    "source": "manual",
    "is_completed": 0,
    "completed_at": null,
    "priority": "high",
    "tags": "inventory,followup",
    "is_read": 0
  },
  "customer": {
    "id": 12345,
    "name": "Customer A"
  },
  "message": "Note created successfully"
}
```

### Update Note
```
PUT /notes/:noteId
```

Headers:
```
Authorization: Bearer <token>
```

Request Body (all fields optional):
```json
{
  "text": "Updated note text",
  "assigned_day": "Tuesday",
  "priority": "normal",
  "is_completed": true,
  "is_read": true,
  "tags": "updated,tags"
}
```

Response (200 Success):
```json
{
  "success": true,
  "note": {
    "note_id": 5,
    "customer_id": 12345,
    "text": "Updated note text",
    "created_at": "2025-05-12T12:34:56.789Z",
    "assigned_day": "Tuesday",
    "source": "manual",
    "is_completed": 1,
    "completed_at": "2025-05-12T13:45:00.000Z",
    "priority": "normal",
    "tags": "updated,tags",
    "is_read": 1
  },
  "customer": {
    "id": 12345,
    "name": "Customer A"
  },
  "message": "Note updated successfully"
}
```

### Delete Note
```
DELETE /notes/:noteId
```

Headers:
```
Authorization: Bearer <token>
```

Response (200 Success):
```json
{
  "success": true,
  "customer": {
    "id": 12345,
    "name": "Customer A"
  },
  "message": "Note deleted successfully"
}
```

## Journal System API

### Get Today's Journal Entries
```
GET /journal/today
```

Headers:
```
Authorization: Bearer <token>
```

Response (200 Success):
```json
{
  "success": true,
  "date": "2025-05-12T12:34:56.789Z",
  "day": "Monday",
  "customerCount": 2,
  "entryCount": 2,
  "customers": [
    {
      "customer": {
        "CustomerNumber": 12345,
        "AccountName": "Customer A",
        "RouteNumber": "33"
      },
      "entries": [
        {
          "entry_id": 1,
          "customer_id": 12345,
          "entry_type": "observation",
          "content": "Journal entry content here",
          "created_at": "2025-05-12T09:30:00.000Z",
          "location": "Store front",
          "service_day": "Monday",
          "related_items": "[\"Item1\", \"Item2\"]",
          "sentiment": "positive",
          "sentiment_score": 0.7,
          "tags": "equipment,service",
          "source": "manual",
          "customer_name": "Customer A"
        }
      ]
    },
    {
      "customer": {
        "CustomerNumber": 67890,
        "AccountName": "Customer B",
        "RouteNumber": "33"
      },
      "entries": [
        {
          "entry_id": 2,
          "customer_id": 67890,
          "entry_type": "issue",
          "content": "Journal entry for another customer",
          "created_at": "2025-05-12T10:30:00.000Z",
          "location": "Back office",
          "service_day": "Monday",
          "related_items": "[\"Item3\"]",
          "sentiment": "negative",
          "sentiment_score": -0.6,
          "tags": "equipment,issue",
          "source": "nfc",
          "customer_name": "Customer B"
        }
      ]
    }
  ]
}
```

### Get Customer Journal Entries
```
GET /journal/customer/:customerId
```

Headers:
```
Authorization: Bearer <token>
```

Query Parameters (all optional):
- `entry_type`: Filter by entry type (observation, request, issue, followup, other)
- `from_date`: Filter by created date (start)
- `to_date`: Filter by created date (end)
- `sentiment`: Filter by sentiment (positive, neutral, negative)
- `tags`: Filter by tags (partial match)

Response (200 Success):
```json
{
  "success": true,
  "customer_id": 12345,
  "count": 2,
  "entries": [
    {
      "entry_id": 1,
      "customer_id": 12345,
      "entry_type": "observation",
      "content": "Journal entry content here",
      "created_at": "2025-05-12T09:30:00.000Z",
      "location": "Store front",
      "service_day": "Monday",
      "related_items": "[\"Item1\", \"Item2\"]",
      "sentiment": "positive",
      "sentiment_score": 0.7,
      "tags": "equipment,service",
      "source": "manual"
    },
    {
      "entry_id": 3,
      "customer_id": 12345,
      "entry_type": "request",
      "content": "Another journal entry",
      "created_at": "2025-05-11T14:30:00.000Z",
      "location": "Kitchen",
      "service_day": "Sunday",
      "related_items": "[\"Item4\"]",
      "sentiment": "neutral",
      "sentiment_score": 0.0,
      "tags": "new,request",
      "source": "voice"
    }
  ]
}
```

### Search Journal Entries
```
GET /journal/search
```

Headers:
```
Authorization: Bearer <token>
```

Query Parameters (all optional):
- `q`: Text search query
- `customer_id`: Filter by customer ID
- `entry_type`: Filter by entry type (observation, request, issue, followup, other)
- `sentiment`: Filter by sentiment (positive, neutral, negative)
- `tags`: Filter by tags (partial match)
- `source`: Filter by source (manual, nfc, gps, voice, call, ai)
- `service_day`: Filter by service day (Monday, Tuesday, etc.)
- `from_date`: Filter by created date (start)
- `to_date`: Filter by created date (end)
- `route`: Filter by route number

Response (200 Success):
```json
{
  "success": true,
  "count": 2,
  "entries": [
    {
      "entry_id": 1,
      "customer_id": 12345,
      "entry_type": "observation",
      "content": "Journal entry content here",
      "created_at": "2025-05-12T09:30:00.000Z",
      "location": "Store front",
      "service_day": "Monday",
      "related_items": "[\"Item1\", \"Item2\"]",
      "sentiment": "positive",
      "sentiment_score": 0.7,
      "tags": "equipment,service",
      "source": "manual",
      "customer_name": "Customer A",
      "route_number": "33"
    },
    {
      "entry_id": 2,
      "customer_id": 67890,
      "entry_type": "issue",
      "content": "Journal entry for another customer",
      "created_at": "2025-05-12T10:30:00.000Z",
      "location": "Back office",
      "service_day": "Monday",
      "related_items": "[\"Item3\"]",
      "sentiment": "negative",
      "sentiment_score": -0.6,
      "tags": "equipment,issue",
      "source": "nfc",
      "customer_name": "Customer B",
      "route_number": "33"
    }
  ]
}
```

### Create Journal Entry
```
POST /journal
```

Headers:
```
Authorization: Bearer <token>
```

Request Body:
```json
{
  "customer_id": 12345,
  "entry_type": "observation",  // Optional - Defaults to "observation"
  "content": "Journal entry content here",
  "location": "Store front",  // Optional
  "service_day": "Monday",  // Optional - Defaults to current day
  "related_items": ["Item1", "Item2"],  // Optional
  "tags": "equipment,service",  // Optional
  "source": "manual"  // Optional - Defaults to "manual"
}
```

Response (201 Success):
```json
{
  "success": true,
  "entry": {
    "entry_id": 4,
    "customer_id": 12345,
    "entry_type": "observation",
    "content": "Journal entry content here",
    "created_at": "2025-05-12T12:34:56.789Z",
    "location": "Store front",
    "service_day": "Monday",
    "related_items": "[\"Item1\", \"Item2\"]",
    "sentiment": "neutral",
    "sentiment_score": 0.0,
    "tags": "equipment,service",
    "source": "manual"
  },
  "customer": {
    "id": 12345,
    "name": "Customer A"
  },
  "message": "Journal entry created successfully"
}
```

## Customer API

### Get All Customers
```
GET /customers
```

Headers:
```
Authorization: Bearer <token>
```

Query Parameters (all optional):
- `search`: Search text
- `route`: Filter by route number
- `page`: Page number (defaults to 1)
- `limit`: Items per page (defaults to 20)

Response (200 Success):
```json
{
  "customers": [
    {
      "CustomerNumber": 12345,
      "AccountName": "Customer A",
      "Address": "123 Main St",
      "City": "Anytown",
      "State": "CA",
      "ZipCode": "12345",
      "RouteNumber": "33",
      "ServiceFrequency": "Weekly",
      "ServiceDays": "Monday",
      "Email": "customer@example.com",
      "Phone": "555-123-4567",
      "CreatedAt": "2025-01-01T00:00:00.000Z"
    },
    {
      "CustomerNumber": 67890,
      "AccountName": "Customer B",
      "Address": "456 Oak St",
      "City": "Othertown",
      "State": "CA",
      "ZipCode": "67890",
      "RouteNumber": "33",
      "ServiceFrequency": "Weekly",
      "ServiceDays": "Monday,Wednesday",
      "Email": "customerb@example.com",
      "Phone": "555-678-9012",
      "CreatedAt": "2025-02-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "totalPages": 2,
    "currentPage": 1,
    "perPage": 20
  }
}
```

### Get Single Customer
```
GET /customers/:id
```

Headers:
```
Authorization: Bearer <token>
```

Response (200 Success):
```json
{
  "CustomerNumber": 12345,
  "AccountName": "Customer A",
  "Address": "123 Main St",
  "City": "Anytown",
  "State": "CA",
  "ZipCode": "12345",
  "RouteNumber": "33",
  "ServiceFrequency": "Weekly",
  "ServiceDays": "Monday",
  "Email": "customer@example.com",
  "Phone": "555-123-4567",
  "CreatedAt": "2025-01-01T00:00:00.000Z"
}
```

## Error Handling

All API endpoints return consistent error responses with the following format:

```json
{
  "error": "error_type",
  "message": "Human-readable error message"
}
```

Common error types:
- `Server error` (500): Internal server error
- `Invalid request` (400): Invalid request parameters
- `Not found` (404): Resource not found
- `Permission denied` (403): User doesn't have permission
- `Authentication failed` (401): Invalid credentials or token

## Role-Based Access Control

The API implements role-based access control with the following roles:

- `Customer`: Access to own data only
- `Driver`: Access to customers on their route
- `Admin`: Access to most resources
- `SuperAdmin`: Access to all resources, including deletion operations

## Offline Sync Support

The API is designed to support offline usage through the `sync_status` table, which tracks the sync state of notes, journal entries, and other data.

Sync-related fields:
- `entity_type`: Type of entity (note, journal, etc.)
- `entity_id`: ID of the entity
- `is_synced`: Whether the entity is synced with the server
- `local_updated_at`: When the entity was updated locally
- `server_updated_at`: When the entity was last synced with the server
- `retry_count`: Number of sync retry attempts
- `sync_error`: Last sync error message

## Tags Support

Both notes and journal entries support tagging for better organization and searchability.

Tags are stored as comma-separated values in the `tags` field and can be searched using partial matches.

Example:
```
tags: "inventory,followup,important"
```

You can then search for notes with a specific tag:
```
GET /notes/search?tags=important
```