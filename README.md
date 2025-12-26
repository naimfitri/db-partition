# Partition Manager

A NestJS microservice for automated management of time-based table partitions in MariaDB databases.

## Overview

Partition Manager provides automated creation, maintenance, and cleanup of time-based table partitions in MariaDB. It includes a REST API for managing partition configurations and scheduled tasks that automatically maintain partitions based on defined rules.

## Features

- **Automated Partition Management**: Automatically create and drop partitions based on configured retention policies
- **RESTful API**: Full CRUD operations for partition configurations
- **Scheduled Tasks**: Built-in scheduler for automated partition maintenance
- **Health Checks**: Monitor service and database connectivity
- **Swagger Documentation**: Interactive API documentation at `/api/docs`
- **Type-Safe**: Built with TypeScript and TypeORM
- **Validation**: Input validation using class-validator

## Tech Stack

- **Framework**: NestJS 11.x
- **Database**: MariaDB/MySQL with TypeORM
- **Language**: TypeScript 5.x
- **API Documentation**: Swagger/OpenAPI
- **Validation**: class-validator, class-transformer
- **Scheduling**: @nestjs/schedule
- **Testing**: Jest

## Prerequisites

- Node.js 18.x or higher
- MariaDB/MySQL database
- npm or yarn

## Installation

```bash
# Install dependencies
npm install
```

## Configuration

Create a `.env` file in the project root with the following variables:

```env
# Application
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database

# Partition Management
PARTITION_ENABLED=true
PARTITION_CRON=0 3 * * *

# Partition Timezone (28800 for GMT+8 / 0 for UTC)
PARTITION_TIMEZONE_OFFSET_MS=28800
```
## Cron Scheduling Format

| Field | Value | Meaning |
|-------|-------|---------|
| Minute | 0 | At the 0th minute |
| Hour | 2 | At 2 AM |
| Day of Month | * | Every day |
| Month | * | Every month |
| Day of Week | * | Every day of the week |

## Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

The application will be available at:
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api/docs

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Partition Configuration Management
- `GET /partition-config/config` - List all partition configurations
- `GET /partition-config/config/:id` - Get specific partition configuration
- `POST /partition-config/config` - Create new partition configuration
- `PUT /partition-config/config/:id` - Update partition configuration
- `DELETE /partition-config/config/:id` - Delete partition configuration

### Partition Operations
- `GET /partitions/:tableName` - List all partitions for a table
- `GET /partitions/:tableName/coverage` - Get partition date range coverage
- `POST /partitions/truncate` - Truncate a specific partition by date
- `POST /partitions/maintenance/trigger` - Manually trigger partition maintenance
- `GET /partitions/analyze/:tableName` - Analyze table for partition migration readiness
- `POST /partitions/migrate` - Migrate existing table to use partitioning

Visit `/api/docs` for complete API documentation with interactive examples.

## Development

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
partition-manager/
├── src/
│   ├── config/              # Configuration modules
│   ├── generator/           # Partition generation logic
│   ├── health/              # Health check endpoints
│   ├── partition/           # Core partition management
│   ├── partition-config/    # Partition configuration entities
│   ├── app.module.ts        # Root application module
│   └── main.ts              # Application entry point
├── test/                    # E2E tests
├── migrations/              # Database migrations
└── dist/                    # Compiled output
```

## License

UNLICENSED

## Author

[Your Name/Organization]
