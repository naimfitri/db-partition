# Generator Module

This module generates test data for the `testing` table with the following schema:
- `id`: Auto-incremented primary key
- `randname`: Random string name
- `randnumb`: Random number (1-1,000,000)
- `updatedDate`: Timestamp (auto-updated)
- `createdDate`: Timestamp (set when record is created)

## Features

### Generate Test Data
- Generates **20,000 records** total
- Distributes data across **20 dates** (1,000 records per date)
- Inserts data in batches of 100 for optimal performance
- Provides progress logging

### API Endpoints

#### 1. Generate Test Data
```
POST /generator/generate
```
Generates 20,000 test records distributed across 20 consecutive dates starting from today.

**Response:**
```json
{
  "success": true,
  "message": "Successfully generated 20000 test records across 20 dates",
  "recordsCreated": 20000
}
```

#### 2. Get Statistics
```
GET /generator/stats
```
Returns statistics about the generated test data.

**Response:**
```json
{
  "totalRecords": 20000,
  "recordsByDate": [
    { "date": "2025-12-24", "count": "1000" },
    { "date": "2025-12-25", "count": "1000" },
    ...
  ]
}
```

#### 3. Clear Test Data
```
DELETE /generator/clear
```
Removes all records from the testing table.

**Response:**
```json
{
  "success": true,
  "message": "Successfully deleted 20000 records",
  "recordsDeleted": 20000
}
```

## Setup

### 1. Create the Database Table

Run the SQL migration script:
```bash
mysql -u root -p partition_db < migrations/create_testing_table.sql
```

Or execute the SQL directly:
```sql
CREATE TABLE IF NOT EXISTS testing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  randname VARCHAR(255) NOT NULL,
  randnumb INT NOT NULL,
  updatedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  createdDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_createdDate (createdDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. Start the Application
```bash
npm run start:dev
```

### 3. Generate Test Data

Using curl:
```bash
curl -X POST http://localhost:3000/generator/generate
```

Using the Swagger UI (if enabled):
- Navigate to http://localhost:3000/api
- Find the "generator" section
- Execute the POST /generator/generate endpoint

## Usage Example

```bash
# Generate test data
curl -X POST http://localhost:3000/generator/generate

# Check statistics
curl http://localhost:3000/generator/stats

# Clear all data
curl -X DELETE http://localhost:3000/generator/clear
```

## Data Distribution

The generator creates data with the following distribution:
- **Total Records**: 20,000
- **Records per Date**: 1,000
- **Number of Dates**: 20 (consecutive days starting from today)
- **Batch Size**: 100 records per insert operation

## Implementation Details

### Random Name Generation
Names are generated using a combination of:
- Prefixes: Test, Demo, Sample, Mock, Data, Record, Entry, Item
- Suffixes: Alpha, Beta, Gamma, Delta, Epsilon, Zeta, Eta, Theta
- Random number: 0-9999

Example: `Test_Alpha_1234`, `Demo_Beta_5678`

### Random Number Generation
- Range: 1 to 1,000,000
- Uniformly distributed

### Performance
- Uses batch inserts (100 records per batch)
- Progress logging every 1,000 records
- Optimized for large dataset generation
