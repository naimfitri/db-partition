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

# Partition Configuration
PARTITION_RETENTION_DAYS=30
PARTITION_ADVANCE_DAYS=7
```

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

### Partition Management
- `GET /partitions` - List all partition configurations
- `POST /partitions` - Create new partition configuration
- `GET /partitions/:id` - Get specific partition configuration
- `PUT /partitions/:id` - Update partition configuration
- `DELETE /partitions/:id` - Delete partition configuration

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
