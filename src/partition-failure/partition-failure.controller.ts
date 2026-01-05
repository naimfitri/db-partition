import { Controller, Get, Post, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PartitionFailureService } from './partition-failure.service';
import { PartitionFailureStatus } from '../partition/enums/failbucket.enums';

@ApiTags('partition-failures')
@Controller('partition-failures')
export class PartitionFailureController {
  constructor(private readonly failureService: PartitionFailureService) {}

  /**
   * GET /partition-failures
   * List all partition failures with optional status filter
   */
  @Get()
  @ApiOperation({
    summary: 'List partition failures',
    description: 'Retrieves all partition failure records, optionally filtered by status'
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PartitionFailureStatus,
    description: 'Filter by failure status'
  })
  @ApiResponse({
    status: 200,
    description: 'List of partition failures retrieved successfully',
    schema: {
      example: {
        total: 15,
        failures: [
          {
            _id: '507f1f77bcf86cd799439011',
            tableName: 'event_logs',
            partitionName: 'p_20251217',
            partitionDate: '2025-12-17T00:00:00.000Z',
            action: 'CREATE_PARTITION',
            status: 'PENDING',
            retryCount: 2,
            maxRetry: 5,
            error: {
              message: 'Connection timeout',
              code: 'ETIMEDOUT'
            },
            lastRetryAt: '2026-01-05T10:00:00.000Z',
            createdAt: '2026-01-05T08:00:00.000Z',
            updatedAt: '2026-01-05T10:00:00.000Z'
          }
        ]
      }
    }
  })
  async listFailures(@Query('status') status?: PartitionFailureStatus) {
    const failures = await this.failureService.getFailures(status);
    return {
      total: failures.length,
      failures,
    };
  }

  /**
   * GET /partition-failures/stats
   * Get failure statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get failure statistics',
    description: 'Returns count of failures by status and overall statistics'
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      example: {
        total: 50,
        pending: 10,
        retrying: 5,
        resolved: 30,
        dead: 5
      }
    }
  })
  async getStats() {
    return await this.failureService.getStats();
  }

  /**
   * GET /partition-failures/pending
   * Get all pending failures (convenience endpoint)
   */
  @Get('pending')
  @ApiOperation({
    summary: 'List pending failures',
    description: 'Retrieves all partition failures with PENDING status'
  })
  @ApiResponse({
    status: 200,
    description: 'Pending failures retrieved successfully'
  })
  async getPendingFailures() {
    const failures = await this.failureService.getFailures(PartitionFailureStatus.PENDING);
    return {
      total: failures.length,
      failures,
    };
  }

  /**
   * GET /partition-failures/dead
   * Get all dead failures (convenience endpoint)
   */
  @Get('dead')
  @ApiOperation({
    summary: 'List dead failures',
    description: 'Retrieves all partition failures that have exhausted retry attempts'
  })
  @ApiResponse({
    status: 200,
    description: 'Dead failures retrieved successfully'
  })
  async getDeadFailures() {
    const failures = await this.failureService.getFailures(PartitionFailureStatus.DEAD);
    return {
      total: failures.length,
      failures,
    };
  }

  /**
   * POST /partition-failures/retry/trigger
   * Manually trigger retry job for all eligible failures
   */
  @Post('retry/trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger retry job',
    description: 'Manually initiates retry process for all pending/retrying failures'
  })
  @ApiResponse({
    status: 200,
    description: 'Retry job triggered successfully',
    schema: {
      example: {
        success: true,
        message: 'Retry job triggered successfully'
      }
    }
  })
  async triggerRetryJob() {
    await this.failureService.retryFailedPartitions();
    return {
      success: true,
      message: 'Retry job triggered successfully',
    };
  }

  /**
   * POST /partition-failures/:id/retry
   * Retry a specific failure by ID
   */
  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry specific failure',
    description: 'Manually retry partition creation for a specific failure record'
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the failure record',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({
    status: 200,
    description: 'Retry completed',
    schema: {
      example: {
        success: true,
        message: 'Retry completed',
        failure: {
          _id: '507f1f77bcf86cd799439011',
          tableName: 'event_logs',
          partitionName: 'p_20251217',
          status: 'RESOLVED',
          retryCount: 3
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Failure record not found'
  })
  async retryFailure(@Param('id') id: string) {
    const failure = await this.failureService.retryById(id);
    return {
      success: true,
      message: 'Retry completed',
      failure,
    };
  }

  /**
   * GET /partition-failures/table/:tableName
   * Get failures for a specific table
   */
  @Get('table/:tableName')
  @ApiOperation({
    summary: 'Get failures by table',
    description: 'Retrieves all partition failures for a specific table'
  })
  @ApiParam({
    name: 'tableName',
    description: 'Name of the table',
    example: 'event_logs'
  })
  @ApiResponse({
    status: 200,
    description: 'Table failures retrieved successfully'
  })
  async getFailuresByTable(@Param('tableName') tableName: string) {
    const failures = await this.failureService.getFailuresByTable(tableName);
    return {
      tableName,
      total: failures.length,
      failures,
    };
  }
}
