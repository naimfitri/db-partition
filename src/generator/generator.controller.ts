import { Controller, Post, Get, Delete, Put, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { GeneratorService } from './generator.service';

@ApiTags('generator')
@Controller('generator')
export class GeneratorController {
  constructor(private readonly generatorService: GeneratorService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate 20k test data records (1k per date for 20 dates)' })
  @ApiResponse({ status: 200, description: 'Test data generated successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async generateTestData() {
    return this.generatorService.generateTestData();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get statistics about the generated test data' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats() {
    return this.generatorService.getTestDataStats();
  }

  @Put('update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update random test records with new data and current date' })
  @ApiQuery({ name: 'count', required: false, type: Number, description: 'Number of records to update (default: 100)' })
  @ApiResponse({ status: 200, description: 'Test data updated successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateTestData(@Query('count') count?: number) {
    const updateCount = count ? parseInt(count.toString(), 10) : 100;
    return this.generatorService.updateTestData(updateCount);
  }

  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all test data from the testing table' })
  @ApiResponse({ status: 200, description: 'Test data cleared successfully' })
  async clearTestData() {
    return this.generatorService.clearTestData();
  }
}
