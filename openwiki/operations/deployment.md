# Deployment and Operations

This section covers deployment procedures, environment configuration, monitoring, and operational considerations for running Armory in production.

## Environment Configuration

### Required Environment Variables

#### Server Configuration
```bash
# Server bind address
PORT=3002
HOST=127.0.0.1

# Environment
NODE_ENV=production

# Public URL (required for Clerk redirects)
APP_PUBLIC_BASE_URL=https://armory.example.com

# Database paths (absolute paths recommended for production)
ARMORY_DB_PATH=/var/lib/armory/data/armory.db
USER_DB_PATH=/var/lib/armory/data/builds.db
SESSION_DB_PATH=/var/lib/armory/data/session.db

# Session security
SESSION_SECRET=your-super-secure-session-secret
SESSION_COOKIE_NAME=armory.session
```

#### Authentication (Clerk)
```bash
# Production Clerk keys (required)
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...

# Or use VITE_ prefix for client-side
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

#### Security
```bash
# Behind reverse proxy
TRUST_PROXY=1
SECURE_COOKIES=1

# Cross-subdomain cookies (if needed)
COOKIE_DOMAIN=.example.com

# Wiki scraping user agent (required)
WIKI_USER_AGENT=ArmoryBot/1.0 (https://armory.example.com; admin@example.com)
```

### Optional Configuration
```bash
# Legal page URL (defaults to internal page)
LEGAL_PAGE_URL=https://example.com/legal

# Shutdown timeout (milliseconds)
SHUTDOWN_TIMEOUT_MS=30000

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX=100           # requests per window
```

### Environment File Management

#### dotenvx Encryption
```bash
# Encrypt environment file for safe storage
pnpm dlx dotenvx encrypt --key DOTENV_PRIVATE_KEY_PRODUCTION .env

# Results in:
# - .env.production (encrypted)
# - .env.keys (private key - NEVER COMMIT)

# Decrypt for runtime
NODE_ENV=production pnpm dotenvx run -f .env.production -- node dist/server/index.js
```

#### Plain .env Alternative
```bash
# Create from template
cp .env.example .env
# Edit .env with production values

# Run with plain .env
node --env-file=.env dist/server/index.js
```

## Build Process

### Production Build
```bash
# Install dependencies
pnpm install

# Build TypeScript server and Vite client
pnpm run build

# Output structure:
# dist/
# ├── server/     # Compiled TypeScript
# ├── client/     # Vite-built assets
# └── public/     # Static files
```

### Development Build
```bash
# Type checking only
pnpm run typecheck

# Development server (client only)
# Runs on http://localhost:5173
# Uses Vite dev server, connects to API server on port 3002
```

## Deployment Procedures

### Server Deployment

#### 1. Prepare Server
```bash
# Create application directory
sudo mkdir -p /var/lib/armory
sudo chown -R $(whoami):$(whoami) /var/lib/armory

# Clone repository
cd /var/lib/armory
git clone https://github.com/your-org/armory.git .
```

#### 2. Configure Environment
```bash
# Create data directory
mkdir -p data

# Set up environment
cp .env.example .env.production
# Edit .env.production with production values

# Encrypt environment (optional but recommended)
pnpm dlx dotenvx encrypt --key $DOTENV_PRIVATE_KEY_PRODUCTION .env.production
```

#### 3. Build and Start
```bash
# Install dependencies
pnpm install

# Build application
pnpm run build

# Start production server
NODE_ENV=production pnpm dotenvx run -f .env.production -- node dist/server/index.js
```

### Process Management

#### systemd Service
```ini
# /etc/systemd/system/armory.service
[Unit]
Description=Armory Warframe Mod Builder
After=network.target

[Service]
Type=simple
User=armory
WorkingDirectory=/var/lib/armory
Environment=NODE_ENV=production
Environment=DOTENV_PRIVATE_KEY_PRODUCTION=your-private-key-here
ExecStart=/usr/bin/pnpm dotenvx run -f .env.production -- node dist/server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### PM2 Process Manager
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
NODE_ENV=production DOTENV_PRIVATE_KEY_PRODUCTION=your-key \
  pm2 start dist/server/index.js --name armory

# Save process list
pm2 save
pm2 startup
```

## Reverse Proxy Configuration

### Nginx Configuration
```nginx
# /etc/nginx/sites-available/armory
server {
    listen 80;
    server_name armory.example.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name armory.example.com;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/armory.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/armory.example.com/privkey.pem;
    
    # Security headers (complements Helmet.js)
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Proxy to Armory
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /healthz {
        proxy_pass http://127.0.0.1:3002/healthz;
        access_log off;
    }
    
    # Ready check endpoint
    location /readyz {
        proxy_pass http://127.0.0.1:3002/readyz;
        access_log off;
    }
}
```

## Health Monitoring

### Health Endpoints
- **`GET /healthz`**: Basic application health (always returns 200 when server is running)
- **`GET /readyz`**: Readiness check (returns 200 only when databases are accessible)

### Monitoring Integration

#### Prometheus Metrics
```typescript
// Custom metrics can be added via prom-client
import promClient from 'prom-client';

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});
```

#### Logging Structure (`/server/logger.ts`)
```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  requestId?: string;
  userId?: string;
  duration?: number;
  error?: ErrorDetails;
}

// Structured JSON logging for log aggregators
console.log(JSON.stringify(logEntry));
```

## Database Management

### Backup Procedures

#### Automated Backups
```bash
#!/bin/bash
# /usr/local/bin/backup-armory.sh

BACKUP_DIR="/var/backups/armory"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup catalog database
sqlite3 /var/lib/armory/data/armory.db ".backup $BACKUP_DIR/armory_$DATE.db"

# Backup user database
sqlite3 /var/lib/armory/data/builds.db ".backup $BACKUP_DIR/builds_$DATE.db"

# Compress backups
gzip "$BACKUP_DIR/armory_$DATE.db"
gzip "$BACKUP_DIR/builds_$DATE.db"

# Rotate old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.db.gz" -mtime +30 -delete
```

#### Cron Configuration
```cron
# /etc/cron.d/armory-backup
0 2 * * * armory /usr/local/bin/backup-armory.sh
```

### Database Maintenance

#### Regular Maintenance Tasks
```bash
# Optimize database (run weekly)
sqlite3 /var/lib/armory/data/armory.db "VACUUM;"
sqlite3 /var/lib/armory/data/builds.db "VACUUM;"

# Update query planner statistics (run after significant data changes)
sqlite3 /var/lib/armory/data/armory.db "ANALYZE;"
sqlite3 /var/lib/armory/data/builds.db "ANALYZE;"
```

#### Migration Procedures
```bash
# Check current schema version
sqlite3 /var/lib/armory/data/armory.db "PRAGMA user_version;"

# Run migrations (handled automatically on startup)
# Manual intervention may be needed for major schema changes
```

## Scaling Considerations

### Vertical Scaling
- **Memory**: 512MB minimum, 1GB+ recommended for production
- **CPU**: 1+ cores, more beneficial for concurrent imports
- **Storage**: 100MB+ for databases, plus space for cached images

### Horizontal Scaling Limitations
- **SQLite**: Not designed for concurrent write access from multiple processes
- **Session Storage**: SQLite session store not shared across instances
- **Recommendation**: Single instance deployment recommended

### Load Testing
- **Concurrent Users**: Test with 50+ concurrent mod builder sessions
- **API Endpoints**: Focus on `/api/builds` and `/api/catalog` endpoints
- **Import Process**: Test full import pipeline memory usage

## Security Considerations

### Application Security
- **CSP Headers**: Configured via Helmet.js middleware
- **CSRF Protection**: Enabled on all state-changing endpoints
- **Rate Limiting**: Applied to authentication and API endpoints
- **Input Validation**: Zod schema validation for all user inputs

### Infrastructure Security
- **Firewall Rules**: Restrict access to necessary ports only
- **Database Permissions**: Read-only access for catalog database
- **File Permissions**: Restrict access to environment files
- **Regular Updates**: Keep Node.js and dependencies updated

### Authentication Security
- **Clerk Configuration**: Use production keys, enable MFA
- **Session Management**: Secure cookies, appropriate timeouts
- **Admin Access**: Role-based access control for import triggers
- **Audit Logging**: Log authentication events and admin actions

## Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check error logs
journalctl -u armory.service -n 50

# Verify environment variables
echo $NODE_ENV
echo $DOTENV_PRIVATE_KEY_PRODUCTION

# Test database connectivity
sqlite3 /var/lib/armory/data/armory.db "SELECT 1;"
```

#### Import Pipeline Failing
```bash
# Check import logs
grep "import" /var/log/armory.log

# Verify wiki user agent
echo $WIKI_USER_AGENT

# Test network connectivity to DE export server
curl -I https://content.warframe.com
```

#### Client Loading Issues
```bash
# Check static file serving
curl -I https://armory.example.com/

# Verify build output exists
ls -la /var/lib/armory/dist/client/

# Check browser console for errors
```

### Log Analysis

#### Key Log Patterns
```
# Successful startup
INFO: Server started on port 3002

# Database connection
INFO: Connected to catalog database

# Import process
INFO: Starting data import pipeline
INFO: Import completed successfully

# Authentication
INFO: User authenticated: user_123
WARN: Failed authentication attempt from IP
```

#### Error Patterns
```
# Database errors
ERROR: SQLITE_ERROR: no such table

# Network errors
ERROR: Failed to fetch export manifest

# Authentication errors
ERROR: Clerk middleware error: Invalid secret key

# Memory issues
ERROR: JavaScript heap out of memory
```

## Disaster Recovery

### Recovery Procedures

#### Database Corruption
1. Stop Armory service
2. Restore from latest backup
3. Verify database integrity
4. Restart service

#### Data Import Failure
1. Check import lease status
2. Clear stale lease if needed
3. Trigger manual import
4. Monitor import progress

#### Application Failure
1. Check application logs
2. Verify dependencies
3. Clear `node_modules` and reinstall if needed
4. Rebuild application

### Backup Verification
```bash
# Regular backup testing procedure
BACKUP_FILE="/var/backups/armory/armory_latest.db.gz"

# Extract and verify
gunzip -c "$BACKUP_FILE" > test.db
sqlite3 test.db "PRAGMA integrity_check;"
sqlite3 test.db "SELECT COUNT(*) FROM mods;"
rm test.db
```

## Performance Tuning

### Database Tuning
```bash
# SQLite pragma settings for production
sqlite3 armory.db "PRAGMA journal_mode = WAL;"
sqlite3 armory.db "PRAGMA synchronous = NORMAL;"
sqlite3 armory.db "PRAGMA cache_size = -2000;"  # 2MB cache
```

### Node.js Tuning
```bash
# Increase memory limit for large imports
NODE_OPTIONS="--max-old-space-size=2048" node dist/server/index.js

# Enable worker threads for CPU-intensive tasks
NODE_OPTIONS="--experimental-worker" node dist/server/index.js
```

### Monitoring Setup
```bash
# Install monitoring tools
# prometheus-node-exporter for system metrics
# prometheus-sqlite-exporter for database metrics
# grafana for visualization
```

## Source References

### Configuration Files
- **Environment Template**: `/.env.example`
- **Server Config**: `/server/config.js`
- **Build Config**: `/vite.config.ts`

### Deployment Scripts
- **Quality Checks**: `/run-quality-checks.mjs`
- **Preflight Check**: `/scripts/runtime-preflight.mjs`

### Monitoring
- **Logger**: `/server/logger.ts`
- **Health Endpoints**: `/server/routes/api.ts`