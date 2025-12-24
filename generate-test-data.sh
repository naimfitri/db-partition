#!/bin/bash
# Simple Test Data Generator - Creates 1000 records per table across 10 days

CONTAINER_NAME="storage-mariadb-1"
echo "🚀 Partition Manager Test Data Generator"
echo ""
echo "📋 Creating partitioned tables and inserting test data..."
echo ""

docker exec -i $CONTAINER_NAME mysql -u hanaphi -phanaphi playground 2>/dev/null << 'EOSQL'
-- Drop existing tables
DROP TABLE IF EXISTS event_logs;
DROP TABLE IF EXISTS metrics;
DROP TABLE IF EXISTS performance_logs;

-- Create event_logs table
CREATE TABLE event_logs (
  id BIGINT AUTO_INCREMENT,
  event_date DATE NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, event_date),
  INDEX idx_event_type (event_type)
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(event_date)) (
  PARTITION p_init VALUES LESS THAN (TO_DAYS('2025-01-01'))
);

-- Create metrics table
CREATE TABLE metrics (
  id BIGINT AUTO_INCREMENT,
  metric_date DATE NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15,4) NOT NULL,
  tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, metric_date),
  INDEX idx_metric_name (metric_name)
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(metric_date)) (
  PARTITION p_init VALUES LESS THAN (TO_DAYS('2025-01-01'))
);

-- Create performance_logs table
CREATE TABLE performance_logs (
  id BIGINT AUTO_INCREMENT,
  log_date DATE NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  response_time INT NOT NULL,
  status_code INT NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, log_date),
  INDEX idx_endpoint (endpoint)
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(log_date)) (
  PARTITION p_init VALUES LESS THAN (TO_DAYS('2025-01-01'))
);

SELECT '✅ Tables created' AS status;

-- Insert test data (100 records per day for 10 days = 1000 records per table)
-- We'll use a more efficient approach with fewer queries

-- Day 1: 2025-12-20
INSERT INTO event_logs (event_date, event_type, payload) 
SELECT '2025-12-20', 
       ELT(MOD(seq, 5) + 1, 'user.login', 'user.logout', 'order.created', 'payment.success', 'api.request'),
       JSON_OBJECT('userId', 1000 + MOD(seq * 17, 9000), 'ip', CONCAT('192.168.', MOD(seq, 255), '.', MOD(seq * 13, 255)))
FROM (SELECT @row := @row + 1 AS seq FROM (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a
     CROSS JOIN (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b
     CROSS JOIN (SELECT @row := 0) r) numbers
LIMIT 100;

-- Repeat for other days and tables (simplified for script)
EOSQL

echo "✅ Tables created with initial partition"
echo ""

# Now insert data efficiently using a bash loop
echo "📝 Inserting test data..."

for day in {0..9}; do
  current_date=$(date -d "2025-12-20 + $day days" +%Y-%m-%d)
  echo "  → $current_date (100 records x 3 tables)"
  
  # Generate single large insert for each table per day
  docker exec -i $CONTAINER_NAME mysql -u hanaphi -phanaphi playground 2>/dev/null << EOSQL
-- event_logs
INSERT INTO event_logs (event_date, event_type, payload) VALUES
$(for i in $(seq 1 100); do
  echo "('$current_date', 'user.login', JSON_OBJECT('userId', $i))$([ $i -eq 100 ] && echo ';' || echo ',')"
done)

-- metrics  
INSERT INTO metrics (metric_date, metric_name, metric_value, tags) VALUES
$(for i in $(seq 1 100); do
  echo "('$current_date', 'cpu.usage', $(echo "scale=2; $i * 0.87" | bc), JSON_OBJECT('env', 'prod'))$([ $i -eq 100 ] && echo ';' || echo ',')"
done)

-- performance_logs
INSERT INTO performance_logs (log_date, endpoint, response_time, status_code, metadata) VALUES
$(for i in $(seq 1 100); do
  echo "('$current_date', '/api/users', $((100 + i * 5)), 200, JSON_OBJECT('method', 'GET'))$([ $i -eq 100 ] && echo ';' || echo ',')"
done)
EOSQL
done

echo ""
echo "📊 Verifying data..."
docker exec -i $CONTAINER_NAME mysql -u hanaphi -phanaphi playground 2>/dev/null << 'EOSQL'
SELECT 'event_logs' AS table_name, COUNT(*) AS records, MIN(event_date) AS from_date, MAX(event_date) AS to_date FROM event_logs
UNION ALL
SELECT 'metrics', COUNT(*), MIN(metric_date), MAX(metric_date) FROM metrics
UNION ALL
SELECT 'performance_logs', COUNT(*), MIN(log_date), MAX(log_date) FROM performance_logs;
EOSQL

echo ""
echo "✅ Done! Start your app: npm run start:dev"
echo "📚 Swagger UI: http://localhost:3000/api/docs"
