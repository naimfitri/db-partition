# 🚀 Quick Start Guide

## ⚡ 1-Minute Setup

```bash
# 1. Install database (Docker - easiest)
docker run -d --name partition-mariadb \
  -e MYSQL_ROOT_PASSWORD=secret \
  -e MYSQL_DATABASE=partition_db \
  -p 3306:3306 mariadb:latest

# 2. Initialize database
docker exec -i partition-mariadb mysql -uroot -psecret partition_db < database-init.sql

# 3. Create .env file
cat > .env << EOF
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=secret
DATABASE_NAME=partition_db
PARTITION_ENABLED=true
PARTITION_CONFIG=[{"tableName":"event_logs","retentionDays":30,"preCreateDays":7,"cleanupAction":"DROP"},{"tableName":"metrics","retentionDays":90,"preCreateDays":14,"cleanupAction":"TRUNCATE"}]
EOF

# 4. Start the app
npm run start:dev
```

## 📖 Access Points

- **Swagger UI**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/health
- **Base URL**: http://localhost:3000

## 🧪 Test It Out

```bash
# Create an event
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventDate": "2025-12-24",
    "eventType": "test.event",
    "payload": {"test": true}
  }'

# List partitions
curl http://localhost:3000/partitions/event_logs

# Check coverage
curl http://localhost:3000/partitions/event_logs/coverage
```

## 📚 Key Files

- `SETUP.md` - Detailed setup instructions
- `IMPLEMENTATION_STATUS.md` - What's implemented and what's missing
- `.env.example` - Environment variables template
- `database-init.sql` - Database initialization script

## 🎯 What's Included

✅ Swagger API docs at `/api/docs`
✅ Automatic partition creation (7 days ahead)
✅ Automatic cleanup (based on retention)
✅ Health monitoring
✅ Event logging with partitioned storage
✅ Full REST API

## ⚠️ Important

- Set `PARTITION_ENABLED=true` to enable auto-management
- Partitions are created daily at 2 AM (configurable)
- Always include partition date when inserting data
- Use Swagger UI for interactive API testing

---

**Need help?** Check [SETUP.md](SETUP.md) for detailed instructions.
