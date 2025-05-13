# R33IS Deployment Documentation

## Deployment Overview

The Route 33 Intelligence System (R33IS) has been successfully deployed with the following components:

- **Backend API**: Node.js Express server (port 5001)
- **Database**: SQLite3
- **Web Server**: Nginx (reverse proxy with SSL)
- **Domain**: route33.app

## System Architecture

```
                  ┌─────────────┐
                  │    Nginx    │
                  │ (HTTPS:443) │
                  └──────┬──────┘
                         │
                         ▼
                  ┌─────────────┐
                  │   Node.js   │
                  │ (Port 5001) │
                  └──────┬──────┘
                         │
                         ▼
                  ┌─────────────┐
                  │   SQLite    │
                  │  Database   │
                  └─────────────┘
```

## Configuration Files

### Nginx Configuration
- Main site configuration: `/etc/nginx/sites-available/r33is`
- SSL certificates: Let's Encrypt (auto-renewal configured)

### API Server Configuration
- Environment variables: `/root/R33IS/api/.env`
- Service configuration: `/etc/systemd/system/r33is-api.service`

## Security Measures

The following security measures have been implemented:

1. **Web Security Headers**:
   - Content Security Policy (CSP)
   - HTTP Strict Transport Security (HSTS)
   - XSS Protection
   - MIME type sniffing protection

2. **API Security**:
   - JWT token authentication
   - Rate limiting
   - Input validation
   - Security headers via Helmet

3. **System Security**:
   - Systemd service hardening
   - Restricted file permissions
   - Proper error handling
   - Secure environment variables

## Logging and Monitoring

- Application logs: `/root/R33IS/api/logs/`
- Nginx access logs: `/var/log/nginx/r33is-access.log`
- Nginx error logs: `/var/log/nginx/r33is-error.log`
- Log rotation: Configured via logrotate

## Backup Information

- Backup location: `/root/backups/`
- Database path: `/root/R33IS/database/master.db`
- Most recent backup: `r33is_deployment_YYYYMMDD.tar.gz`

## Maintenance Tasks

### Restarting Services

```bash
# Restart API service
systemctl restart r33is-api.service

# Restart Nginx
systemctl restart nginx
```

### Viewing Logs

```bash
# API service logs
journalctl -u r33is-api.service

# Application logs
tail -f /root/R33IS/api/logs/combined.log

# Nginx logs
tail -f /var/log/nginx/r33is-access.log
```

### Database Backup

```bash
# Manual database backup
cd /root/R33IS/database
sqlite3 master.db .dump > backup_$(date +%Y%m%d).sql
```

## Access Information

- **API Endpoint**: https://route33.app/api
- **Admin Login**: 
  - Username: admin
  - Password: admin123 (CHANGE THIS IN PRODUCTION)

## API Endpoints

| Endpoint | Description | Authentication |
|----------|-------------|----------------|
| `/api/health` | Health check | None |
| `/api/auth/login` | Login | None |
| `/api/auth/me` | Current user info | Required |
| `/api/notes` | Notes management | Required |
| `/api/journal` | Journal entries | Required |
| `/api/customers` | Customer management | Required |

For detailed API documentation, see `/docs/api-docs.md`.

---

**Deployment Date**: May 12, 2025

**Completed By**: Claude AI Assistant