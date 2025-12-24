-- ================================================
-- Initial Partition Setup for event_logs table
-- ================================================
-- Run this SQL in MariaDB before starting the application

CREATE TABLE IF NOT EXISTS event_logs (
  id BIGINT AUTO_INCREMENT,
  event_date DATE NOT NULL COMMENT 'Partition key - must be set on insert',
  event_type VARCHAR(50) NOT NULL,
  payload JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, event_date),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB
COMMENT='Time-series event logs with daily partitioning'
PARTITION BY RANGE (TO_DAYS(event_date)) (
  PARTITION p_init VALUES LESS THAN (TO_DAYS('2025-01-01'))
);

-- ================================================
-- Initial Partition Setup for metrics table
-- ================================================

CREATE TABLE IF NOT EXISTS metrics (
  id BIGINT AUTO_INCREMENT,
  metric_date DATE NOT NULL COMMENT 'Partition key',
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15,4) NOT NULL,
  tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, metric_date),
  INDEX idx_metric_name (metric_name),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB
COMMENT='Time-series metrics with daily partitioning'
PARTITION BY RANGE (TO_DAYS(metric_date)) (
  PARTITION p_init VALUES LESS THAN (TO_DAYS('2025-01-01'))
);

-- ================================================
-- Verify partition setup
-- ================================================

SELECT 
  table_name,
  partition_name,
  partition_method,
  partition_expression
FROM information_schema.partitions
WHERE table_schema = DATABASE()
  AND partition_name IS NOT NULL
ORDER BY table_name, partition_name;

-- ================================================
-- Check partition sizes
-- ================================================

SELECT 
  table_name,
  partition_name,
  table_rows,
  ROUND(data_length / 1024 / 1024, 2) AS size_mb
FROM information_schema.partitions
WHERE table_schema = DATABASE()
  AND table_name IN ('event_logs', 'metrics')
ORDER BY table_name, partition_name;
