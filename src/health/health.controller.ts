import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private configService: ConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns application health status and configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2025-12-24T12:00:00.000Z',
        uptime: 3600,
        environment: 'development',
        partition: {
          enabled: true,
          tablesConfigured: 3,
        },
      },
    },
  })
  check() {
    const partitionConfig = this.configService.get('partition');
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      partition: {
        enabled: partitionConfig?.enabled || false,
        tablesConfigured: partitionConfig?.tables?.length || 0,
      },
    };
  }
}
