# 🚀 Partition Manager Setup Guide

## 📋 Quick Start Checklist

### ✅ **What You Have**
- ✅ NestJS project structure
- ✅ Swagger API documentation setup
- ✅ Partition management service
- ✅ Partition scheduler with cron jobs
- ✅ Events and Metrics modules
- ✅ Health check endpoint
- ✅ Environment validation
- ✅ TypeORM integration

### ⚠️ **What's Missing (You Need to Do)**

#### 1️⃣ **Create .env file**
```bash
cp .env.example .env
```

Then edit `.env` with your database credentials:
```bash
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=partition_db
```

#### 2️⃣ **Setup MariaDB Database**
```bash
# Login to MariaDB
mysql -u root -p

# Create database
CREATE DATABASE partition_db;

# Run the initialization script
mysql -u root -p partition_db < database-init.sql
```

#### 3️⃣ **Install MariaDB (if not installed)**

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install mariadb-server
sudo systemctl start mariadb
sudo mysql_secure_installation
```

**macOS:**
```bash
brew install mariadb
brew services start mariadb
```

**Docker (recommended for development):**
```bash
docker run -d \
  --name partition-mariadb \
  -e MYSQL_ROOT_PASSWORD=secret \
  -e MYSQL_DATABASE=partition_db \
  -p 3306:3306 \
  mariadb:latest
```

#### 4️⃣ **Verify Installation**
```bash
# Start the application
npm run start:dev

# Check health endpoint
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "ok",
#   "partition": {
#     "enabled": true,
#     "tablesConfigured": 2
#   }
# }
```

---

## 📚 **API Documentation**

### Swagger UI
Once the application is running, visit:
```
http://localhost:3000/api/docs
```

### Available Endpoints

#### **Health Check**
```bash
GET /health
```

#### **Partition Management**
```bash
# List all partitions for a table
GET /partitions/:tableName

# Get partition coverage
GET /partitions/:tableName/coverage

# Truncate a partition
POST /partitions/truncate
{
  "tableName": "event_logs",
  "partitionDate": "2025-12-24"
}

# Manually trigger maintenance
POST /partitions/maintenance/trigger
```

#### **Events**
```bash
# Create event
POST /events
{
  "eventDate": "2025-12-24",
  "eventType": "user.login",
  "payload": {
    "userId": 123,
    "ip": "192.168.1.1"
  }
}

# Query events
GET /events?startDate=2025-12-01&endDate=2025-12-24&eventType=user.login
```

---

## ⚙️ **Configuration Guide**

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_HOST` | ✅ Yes | localhost | MariaDB host |
| `DATABASE_PORT` | No | 3306 | MariaDB port |
| `DATABASE_USER` | ✅ Yes | - | Database user |
| `DATABASE_PASSWORD` | No | - | Database password |
| `DATABASE_NAME` | ✅ Yes | - | Database name |
| `PARTITION_ENABLED` | No | false | Enable partition management |
| `PARTITION_CRON` | No | 0 2 * * * | Cron schedule (2 AM daily) |
| `PARTITION_CONFIG` | No | [] | JSON array of table configs |
| `PORT` | No | 3000 | Application port |
| `NODE_ENV` | No | development | Environment |

### Partition Configuration Format

```json
PARTITION_CONFIG=[
  {
    "tableName": "event_logs",
    "retentionDays": 30,
    "preCreateDays": 7,
    "cleanupAction": "DROP"
  },
  {
    "tableName": "metrics",
    "retentionDays": 90,
    "preCreateDays": 14,
    "cleanupAction": "TRUNCATE"
  }
]
```

**Parameters:**
- `tableName`: Name of the partitioned table
- `retentionDays`: Days to keep data (older partitions will be cleaned up)
- `preCreateDays`: Create partitions N days in advance
- `cleanupAction`: `DROP` (permanent delete) or `TRUNCATE` (keep structure)

---

## 🔍 **Testing the System**

### 1. Test Partition Creation
```bash
# Check if partitions are created on startup
curl http://localhost:3000/partitions/event_logs

# Expected: Multiple partitions (today + 7 days ahead)
```

### 2. Test Event Creation
```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventDate": "2025-12-24",
    "eventType": "test.event",
    "payload": {"test": true}
  }'
```

### 3. Query Events
```bash
curl "http://localhost:3000/events?startDate=2025-12-24&endDate=2025-12-24"
```

### 4. Check Partition Coverage
```bash
curl http://localhost:3000/partitions/event_logs/coverage
```

### 5. Manually Trigger Maintenance
```bash
curl -X POST http://localhost:3000/partitions/maintenance/trigger
```

---

## 🛠️ **Development Commands**

```bash
# Start in development mode with hot reload
npm run start:dev

# Start in production mode
npm run build
npm run start:prod

# Run tests
npm run test

# Run linter
npm run lint

# Format code
npm run format
```

---

## 📊 **Monitoring Queries**

### Check Partition Sizes
```sql
SELECT 
  table_name,
  partition_name,
  table_rows,
  ROUND(data_length / 1024 / 1024, 2) AS size_mb
FROM information_schema.partitions
WHERE table_schema = DATABASE()
  AND table_name IN ('event_logs', 'metrics')
ORDER BY table_name, partition_name;
```

### List All Partitions
```sql
SELECT 
  table_name,
  partition_name,
  partition_description,
  table_rows
FROM information_schema.partitions
WHERE table_schema = 'partition_db'
  AND partition_name IS NOT NULL
ORDER BY table_name, partition_name;
```

---

## ⚠️ **Important Notes**

### Partition Key Requirements
- **CRITICAL**: Primary key MUST include the partition column
- Always set `eventDate` or `metricDate` when inserting data
- Inserts will fail if partition doesn't exist (pre-create is your safety net)

### Timezone Considerations
- Use UTC everywhere to avoid timezone issues
- Partition boundaries are based on dates, not timestamps

### Performance Tips
- Queries should include the partition column for optimal performance
- Example: `WHERE event_date = '2025-12-24'` (scans 1 partition)
- Avoid: `WHERE created_at > '2025-12-24'` (full table scan)

### Production Checklist
- [ ] Set `PARTITION_ENABLED=true`
- [ ] Configure retention policies per table
- [ ] Set `preCreateDays` >= 7 for safety buffer
- [ ] Monitor disk space regularly
- [ ] Set up alerts for partition creation failures
- [ ] Test partition cleanup in staging first
- [ ] Never set `synchronize: true` in TypeORM config

---

## 🐛 **Troubleshooting**

### Issue: "ERROR 1526: Table has no partition for value"
**Solution:** Partition doesn't exist for the date you're inserting
```bash
# Manually trigger partition creation
curl -X POST http://localhost:3000/partitions/maintenance/trigger
```

### Issue: "Can't connect to MariaDB"
**Solution:** Check database connection settings in `.env`
```bash
# Test connection
mysql -h localhost -u root -p partition_db -e "SELECT 1"
```

### Issue: Partitions not being created on startup
**Solution:** Check if `PARTITION_ENABLED=true` in `.env`
```bash
# Check health endpoint
curl http://localhost:3000/health
```

### Issue: TypeORM synchronize errors
**Solution:** Make sure `synchronize: false` in database config. Partitions must be managed via raw SQL.

---

## 📖 **Next Steps**

1. ✅ Setup complete - Application is ready!
2. 📊 Visit Swagger: http://localhost:3000/api/docs
3. 🧪 Test the APIs using Swagger UI
4. 📈 Monitor partition growth in production
5. 🔧 Adjust retention policies based on usage patterns

---

## 🆘 **Need Help?**

- Check logs: Application logs show partition operations
- Verify database: Query `information_schema.partitions`
- Health check: `GET /health` shows partition status
- Swagger docs: Interactive API testing at `/api/docs`
