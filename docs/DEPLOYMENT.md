# NIVA Production Deployment Guide

This guide details the procedures for deploying NIVA in production environments using Docker Compose or managed cloud infrastructure.

---

## 1. Production Topology Overview

NIVA is containerized using multi-stage Dockerfiles designed for minimal image sizes, non-root security, and high performance:

| Service Container | Image Base | Size | Port (Internal) | User |
| :--- | :--- | :--- | :--- | :--- |
| `niva-prod-web` | `node:20-alpine` (Next.js Standalone) | ~76 MB | `3000` | `nextjs:nodejs` (UID 1001) |
| `niva-prod-api` | `node:20-alpine` (NestJS Production) | ~68 MB | `4000` | `node:node` (UID 1001) |
| `niva-prod-ai` | `python:3.12-slim` (FastAPI Uvicorn) | ~79 MB | `8000` | `appuser` (UID 1001) |
| `niva-prod-postgres` | `pgvector/pgvector:pg16` | Official | `5432` | `postgres` |
| `niva-prod-redis` | `redis:7.2-alpine` | Official | `6379` | `redis` |

---

## 2. Docker Compose Production Deployment

The quickest path to a fully isolated production deployment is via `docker-compose.prod.yml`.

### Step 1: Clone Repository on Server
```bash
git clone https://github.com/swarnikas06/niva.git
cd niva
```

### Step 2: Prepare Production Environment File
Copy the production environment template:
```bash
cp .env.production.example .env.production
```

Generate secure secrets for each key:
```bash
# Generate 64-char hex keys
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 32  # For COOKIE_SECRET
openssl rand -hex 32  # For INTERNAL_SERVICE_SECRET
```

Populate `.env.production` with your real database credentials, Redis URL, Gemini API Key, and VAPID keys.

### Step 3: Build and Launch Containers
```bash
# Build optimized production images and start in detached mode
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### Step 4: Verify Container Health
```bash
docker ps
```
All containers should report `(healthy)`.

---

## 3. Reverse Proxy & SSL Configuration (Nginx / Caddy)

For internet-facing deployments, place Nginx or Caddy in front of the web and API containers.

### Example Nginx Configuration (`/etc/nginx/sites-available/niva`)
```nginx
server {
    listen 80;
    server_name niva.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name niva.example.com;

    ssl_certificate /etc/letsencrypt/live/niva.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/niva.example.com/privkey.pem;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Next.js Web Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # NestJS API Gateway
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 120s;
    }
}
```

---

## 4. Database Disaster Recovery & Automated Backups

### Automated Backup Script (`backup.sh`)
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/niva"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

# Snapshot PostgreSQL database with pgvector embeddings
docker exec niva-prod-postgres pg_dump -U niva_user -d niva_db -F c -b -v -f "/tmp/niva_backup_${TIMESTAMP}.dump"
docker cp niva-prod-postgres:/tmp/niva_backup_${TIMESTAMP}.dump "$BACKUP_DIR/"
docker exec niva-prod-postgres rm "/tmp/niva_backup_${TIMESTAMP}.dump"

# Retain last 7 days of backups
find "$BACKUP_DIR" -name "niva_backup_*.dump" -mtime +7 -delete
echo "Backup completed: ${BACKUP_DIR}/niva_backup_${TIMESTAMP}.dump"
```

### Database Restore Procedure
```bash
# Copy dump into postgres container and restore
docker cp /path/to/backup.dump niva-prod-postgres:/tmp/restore.dump
docker exec -it niva-prod-postgres pg_restore -U niva_user -d niva_db -v --clean "/tmp/restore.dump"
```

---

## 5. Production Health Monitoring Endpoints

* **API Health Check**: `GET http://localhost:4000/api/v1/health`  
  Returns database connection status, memory consumption, and uptime.
* **AI Service Health Check**: `GET http://localhost:8000/health`  
  Returns Gemini API provider availability and embedding engine status.
* **Next.js Web Health Check**: `GET http://localhost:3000/api/health`
