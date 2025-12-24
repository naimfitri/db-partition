#!/usr/bin/env python3
"""
Test Data Generator for Partition Manager
Inserts 1000 records per table across multiple dates (100 records per day)
"""

import mysql.connector
from datetime import datetime, timedelta
import json
import random
from typing import List

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'hanaphi',
    'password': 'hanaphi',
    'database': 'playground'
}

# Test data configuration
RECORDS_PER_TABLE = 1000
RECORDS_PER_DATE = 100
START_DATE = datetime(2025, 12, 20)  # Start from Dec 20, 2025

# Sample event types
EVENT_TYPES = [
    'user.login', 'user.logout', 'user.signup', 'user.profile_update',
    'order.created', 'order.completed', 'order.cancelled',
    'payment.success', 'payment.failed', 'payment.refund',
    'api.request', 'api.error', 'system.startup', 'system.shutdown'
]

# Sample metric names
METRIC_NAMES = [
    'cpu.usage', 'memory.usage', 'disk.usage', 'network.bandwidth',
    'api.response_time', 'api.requests_per_second', 'database.connections',
    'cache.hit_rate', 'queue.length', 'error.rate'
]


def get_connection():
    """Create database connection"""
    return mysql.connector.connect(**DB_CONFIG)


def create_tables_if_not_exist(cursor):
    """Create partitioned tables if they don't exist"""
    
    # Create event_logs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS event_logs (
          id BIGINT AUTO_INCREMENT,
          event_date DATE NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          payload JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id, event_date),
          INDEX idx_event_type (event_type),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB
        PARTITION BY RANGE (TO_DAYS(event_date)) (
          PARTITION p_init VALUES LESS THAN (TO_DAYS('2025-01-01'))
        )
    """)
    print("✅ Table 'event_logs' ready")
    
    # Create metrics table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS metrics (
          id BIGINT AUTO_INCREMENT,
          metric_date DATE NOT NULL,
          metric_name VARCHAR(100) NOT NULL,
          metric_value DECIMAL(15,4) NOT NULL,
          tags JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id, metric_date),
          INDEX idx_metric_name (metric_name),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB
        PARTITION BY RANGE (TO_DAYS(metric_date)) (
          PARTITION p_init VALUES LESS THAN (TO_DAYS('2025-01-01'))
        )
    """)
    print("✅ Table 'metrics' ready")
    
    # Create performance_logs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS performance_logs (
          id BIGINT AUTO_INCREMENT,
          log_date DATE NOT NULL,
          endpoint VARCHAR(255) NOT NULL,
          response_time INT NOT NULL,
          status_code INT NOT NULL,
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id, log_date),
          INDEX idx_endpoint (endpoint),
          INDEX idx_status_code (status_code),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB
        PARTITION BY RANGE (TO_DAYS(log_date)) (
          PARTITION p_init VALUES LESS THAN (TO_DAYS('2025-01-01'))
        )
    """)
    print("✅ Table 'performance_logs' ready")


def insert_event_logs(cursor, start_date: datetime, total_records: int, records_per_date: int):
    """Insert test data into event_logs table"""
    print(f"\n📝 Inserting {total_records} records into 'event_logs'...")
    
    query = """
        INSERT INTO event_logs (event_date, event_type, payload)
        VALUES (%s, %s, %s)
    """
    
    records = []
    current_date = start_date
    
    for i in range(total_records):
        # Change date every RECORDS_PER_DATE records
        if i > 0 and i % records_per_date == 0:
            current_date += timedelta(days=1)
        
        event_type = random.choice(EVENT_TYPES)
        payload = {
            'userId': random.randint(1000, 9999),
            'ip': f"192.168.{random.randint(1, 255)}.{random.randint(1, 255)}",
            'userAgent': 'TestClient/1.0',
            'requestId': f"req_{i}_{random.randint(10000, 99999)}"
        }
        
        records.append((
            current_date.strftime('%Y-%m-%d'),
            event_type,
            json.dumps(payload)
        ))
    
    cursor.executemany(query, records)
    print(f"✅ Inserted {len(records)} records into 'event_logs'")


def insert_metrics(cursor, start_date: datetime, total_records: int, records_per_date: int):
    """Insert test data into metrics table"""
    print(f"\n📊 Inserting {total_records} records into 'metrics'...")
    
    query = """
        INSERT INTO metrics (metric_date, metric_name, metric_value, tags)
        VALUES (%s, %s, %s, %s)
    """
    
    records = []
    current_date = start_date
    
    for i in range(total_records):
        # Change date every RECORDS_PER_DATE records
        if i > 0 and i % records_per_date == 0:
            current_date += timedelta(days=1)
        
        metric_name = random.choice(METRIC_NAMES)
        metric_value = round(random.uniform(0, 100), 4)
        tags = {
            'environment': random.choice(['production', 'staging', 'development']),
            'region': random.choice(['us-east-1', 'us-west-2', 'eu-west-1']),
            'host': f"server-{random.randint(1, 20)}"
        }
        
        records.append((
            current_date.strftime('%Y-%m-%d'),
            metric_name,
            metric_value,
            json.dumps(tags)
        ))
    
    cursor.executemany(query, records)
    print(f"✅ Inserted {len(records)} records into 'metrics'")


def insert_performance_logs(cursor, start_date: datetime, total_records: int, records_per_date: int):
    """Insert test data into performance_logs table"""
    print(f"\n⚡ Inserting {total_records} records into 'performance_logs'...")
    
    query = """
        INSERT INTO performance_logs (log_date, endpoint, response_time, status_code, metadata)
        VALUES (%s, %s, %s, %s, %s)
    """
    
    endpoints = [
        '/api/users', '/api/orders', '/api/products', '/api/auth/login',
        '/api/auth/logout', '/api/payments', '/api/search', '/api/analytics'
    ]
    
    status_codes = [200, 200, 200, 201, 204, 400, 401, 403, 404, 500]
    
    records = []
    current_date = start_date
    
    for i in range(total_records):
        # Change date every RECORDS_PER_DATE records
        if i > 0 and i % records_per_date == 0:
            current_date += timedelta(days=1)
        
        endpoint = random.choice(endpoints)
        response_time = random.randint(10, 2000)  # milliseconds
        status_code = random.choice(status_codes)
        metadata = {
            'method': random.choice(['GET', 'POST', 'PUT', 'DELETE']),
            'clientId': f"client_{random.randint(100, 999)}",
            'version': 'v1'
        }
        
        records.append((
            current_date.strftime('%Y-%m-%d'),
            endpoint,
            response_time,
            status_code,
            json.dumps(metadata)
        ))
    
    cursor.executemany(query, records)
    print(f"✅ Inserted {len(records)} records into 'performance_logs'")


def show_statistics(cursor):
    """Show statistics of inserted data"""
    print("\n" + "="*60)
    print("📈 DATA STATISTICS")
    print("="*60)
    
    tables = ['event_logs', 'metrics', 'performance_logs']
    
    for table in tables:
        # Get total count
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        total = cursor.fetchone()[0]
        
        # Get date range
        date_column = 'event_date' if table == 'event_logs' else ('metric_date' if table == 'metrics' else 'log_date')
        cursor.execute(f"SELECT MIN({date_column}), MAX({date_column}) FROM {table}")
        min_date, max_date = cursor.fetchone()
        
        # Get partition count
        cursor.execute(f"""
            SELECT COUNT(DISTINCT partition_name)
            FROM information_schema.partitions
            WHERE table_schema = DATABASE()
            AND table_name = '{table}'
            AND partition_name IS NOT NULL
            AND partition_name != 'p_init'
        """)
        partition_count = cursor.fetchone()[0]
        
        print(f"\n📊 {table.upper()}")
        print(f"   Total Records: {total:,}")
        print(f"   Date Range: {min_date} → {max_date}")
        print(f"   Partitions: {partition_count}")


def show_partition_info(cursor):
    """Show partition information"""
    print("\n" + "="*60)
    print("🗂️  PARTITION INFORMATION")
    print("="*60)
    
    cursor.execute("""
        SELECT 
            table_name,
            partition_name,
            table_rows,
            ROUND(data_length / 1024 / 1024, 2) AS size_mb
        FROM information_schema.partitions
        WHERE table_schema = DATABASE()
        AND table_name IN ('event_logs', 'metrics', 'performance_logs')
        AND partition_name IS NOT NULL
        ORDER BY table_name, partition_name
    """)
    
    current_table = None
    for table_name, partition_name, rows, size_mb in cursor.fetchall():
        if table_name != current_table:
            print(f"\n📁 {table_name}")
            current_table = table_name
        print(f"   └─ {partition_name}: {rows:,} rows, {size_mb} MB")


def main():
    """Main function"""
    print("🚀 Partition Manager Test Data Generator")
    print("="*60)
    
    try:
        # Connect to database
        print("\n🔌 Connecting to database...")
        conn = get_connection()
        cursor = conn.cursor()
        print(f"✅ Connected to '{DB_CONFIG['database']}' database")
        
        # Create tables
        print("\n🔧 Setting up tables...")
        create_tables_if_not_exist(cursor)
        conn.commit()
        
        # Insert test data
        print(f"\n📦 Generating {RECORDS_PER_TABLE * 3:,} total records...")
        print(f"   ({RECORDS_PER_DATE} records per day)")
        
        insert_event_logs(cursor, START_DATE, RECORDS_PER_TABLE, RECORDS_PER_DATE)
        conn.commit()
        
        insert_metrics(cursor, START_DATE, RECORDS_PER_TABLE, RECORDS_PER_DATE)
        conn.commit()
        
        insert_performance_logs(cursor, START_DATE, RECORDS_PER_TABLE, RECORDS_PER_DATE)
        conn.commit()
        
        # Show statistics
        show_statistics(cursor)
        show_partition_info(cursor)
        
        print("\n" + "="*60)
        print("✅ TEST DATA GENERATION COMPLETE!")
        print("="*60)
        print("\n💡 Next Steps:")
        print("   1. Start your NestJS app: npm run start:dev")
        print("   2. Visit Swagger UI: http://localhost:3000/api/docs")
        print("   3. Test partition endpoints:")
        print("      - GET /partitions/event_logs")
        print("      - GET /partitions/event_logs/coverage")
        print("      - GET /events?startDate=2025-12-20&endDate=2025-12-29")
        print()
        
    except mysql.connector.Error as err:
        print(f"\n❌ Database Error: {err}")
        print("\n💡 Make sure:")
        print("   - MariaDB is running")
        print("   - Database 'playground' exists")
        print("   - Credentials are correct in the script")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
            print("🔌 Database connection closed")


if __name__ == '__main__':
    main()
