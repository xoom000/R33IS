# R33IS Quick Start Guide

## Quick Access

- **API URL**: https://route33.app/api
- **Admin Login**: 
  - Username: `admin`
  - Password: `admin123` (change immediately)

## Getting Started

1. **Login to the System**:
   ```
   curl -X POST -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}' \
     https://route33.app/api/auth/login
   ```

2. **Save the returned JWT token**:
   ```
   TOKEN="your_jwt_token_here"
   ```

3. **Use the token for authenticated requests**:
   ```
   curl -H "Authorization: Bearer $TOKEN" \
     https://route33.app/api/customers
   ```

## Core Features

### 1. Notes System

- **Create a note**:
  ```
  curl -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"customer_id":12345,"text":"Note text","priority":"high"}' \
    https://route33.app/api/notes
  ```

- **Get today's notes**:
  ```
  curl -H "Authorization: Bearer $TOKEN" \
    https://route33.app/api/notes/today
  ```

### 2. Journal System

- **Create journal entry**:
  ```
  curl -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"customer_id":12345,"entry_type":"observation","content":"Entry content"}' \
    https://route33.app/api/journal
  ```

- **Get customer journal entries**:
  ```
  curl -H "Authorization: Bearer $TOKEN" \
    https://route33.app/api/journal/customer/12345
  ```

### 3. Customer Management

- **List all customers**:
  ```
  curl -H "Authorization: Bearer $TOKEN" \
    https://route33.app/api/customers
  ```

- **Get specific customer**:
  ```
  curl -H "Authorization: Bearer $TOKEN" \
    https://route33.app/api/customers/12345
  ```

## Common Commands

### Restart Services

```bash
# Restart API
sudo systemctl restart r33is-api.service

# Restart Nginx
sudo systemctl restart nginx
```

### View Logs

```bash
# API logs
sudo journalctl -u r33is-api.service -f

# Application logs
sudo tail -f /root/R33IS/api/logs/combined.log

# Error logs
sudo tail -f /root/R33IS/api/logs/error.log
```

## Troubleshooting

If the API doesn't respond:

1. Check service status:
   ```
   sudo systemctl status r33is-api.service
   ```

2. Check logs for errors:
   ```
   sudo journalctl -u r33is-api.service -n 50
   ```

3. Verify database connection:
   ```
   cd /root/R33IS/database
   sqlite3 master.db "SELECT count(*) FROM customers;"
   ```

4. Restart the service:
   ```
   sudo systemctl restart r33is-api.service
   ```

## Important Paths

- **API Code**: `/root/R33IS/api/src`
- **Database**: `/root/R33IS/database/master.db`
- **Nginx Config**: `/etc/nginx/sites-available/r33is`
- **Environmental Variables**: `/root/R33IS/api/.env`