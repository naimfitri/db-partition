#!/bin/bash
# Bulk insert 1000 records per table (100 per day for 10 days)

CONTAINER="storage-mariadb-1"

echo "🚀 Inserting 3000 test records (1000 per table)..."
echo ""

# Generate and insert in batches
for day in {0..9}; do
  date=$(date -d "2025-12-24 + $day days" +%Y-%m-%d 2>/dev/null || date -v +${day}d -j -f "%Y-%m-%d" "2025-12-24" +%Y-%m-%d)
  echo "📅 $date - Inserting 100 records per table..."
  
  # Build INSERT statements
  event_values=""
  metric_values=""
  perf_values=""
  
  for i in {1..100}; do
    user_id=$((1000 + RANDOM % 9000))
    ip_3=$((RANDOM % 255))
    ip_4=$((RANDOM % 255))
    
    # Event logs
    event_types=("user.login" "user.logout" "order.created" "payment.success" "api.request")
    event_type=${event_types[$((RANDOM % 5))]}
    if [ $i -eq 1 ]; then
      event_values="('$date','$event_type','{\"userId\":$user_id,\"ip\":\"192.168.$ip_3.$ip_4\"}')"
    else
      event_values="$event_values,('$date','$event_type','{\"userId\":$user_id,\"ip\":\"192.168.$ip_3.$ip_4\"}')"
    fi
    
    # Metrics
    metric_names=("cpu.usage" "memory.usage" "api.response_time" "cache.hit_rate" "error.rate")
    metric_name=${metric_names[$((RANDOM % 5))]}
    metric_value=$(awk -v seed=$RANDOM 'BEGIN{srand(seed); printf "%.4f", rand()*100}')
    envs=("production" "staging" "development")
    env=${envs[$((RANDOM % 3))]}
    if [ $i -eq 1 ]; then
      metric_values="('$date','$metric_name',$metric_value,'{\"environment\":\"$env\",\"region\":\"us-east-1\"}')"
    else
      metric_values="$metric_values,('$date','$metric_name',$metric_value,'{\"environment\":\"$env\",\"region\":\"us-east-1\"}')"
    fi
    
    # Performance logs
    endpoints=("/api/users" "/api/orders" "/api/products" "/api/auth")
    endpoint=${endpoints[$((RANDOM % 4))]}
    response_time=$((10 + RANDOM % 1990))
    statuses=(200 200 200 201 400 500)
    status=${statuses[$((RANDOM % 6))]}
    methods=("GET" "POST" "PUT" "DELETE")
    method=${methods[$((RANDOM % 4))]}
    if [ $i -eq 1 ]; then
      perf_values="('$date','$endpoint',$response_time,$status,'{\"method\":\"$method\",\"version\":\"v1\"}')"
    else
      perf_values="$perf_values,('$date','$endpoint',$response_time,$status,'{\"method\":\"$method\",\"version\":\"v1\"}')"
    fi
  done
  
  # Execute inserts
  docker exec -i $CONTAINER mysql -u hanaphi -phanaphi playground 2>/dev/null << EOSQL
INSERT INTO event_logs (event_date, event_type, payload) VALUES $event_values;
INSERT INTO metrics (metric_date, metric_name, metric_value, tags) VALUES $metric_values;
INSERT INTO performance_logs (log_date, endpoint, response_time, status_code, metadata) VALUES $perf_values;
EOSQL
  
done

echo ""
echo "✅ Data insertion complete!"
echo ""
echo "📊 Verifying..."

docker exec -i $CONTAINER mysql -u hanaphi -phanaphi playground 2>/dev/null << 'EOF'
SELECT 
  'event_logs' AS table_name,
  COUNT(*) AS total_records,
  MIN(event_date) AS from_date,
  MAX(event_date) AS to_date,
  COUNT(DISTINCT event_date) AS unique_dates
FROM event_logs
UNION ALL
SELECT 
  'metrics',
  COUNT(*),
  MIN(metric_date),
  MAX(metric_date),
  COUNT(DISTINCT metric_date)
FROM metrics
UNION ALL
SELECT 
  'performance_logs',
  COUNT(*),
  MIN(log_date),
  MAX(log_date),
  COUNT(DISTINCT log_date)
FROM performance_logs;
EOF

echo ""
echo "🎉 Test complete! Visit http://localhost:3000/api/docs to explore the data"
