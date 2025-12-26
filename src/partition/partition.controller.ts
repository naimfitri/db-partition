import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PartitionService } from './partition.service';
import { PartitionScheduler } from './partition.scheduler';
import { TruncatePartitionDto } from './dto/truncate-partition.dto';
// import { CreatePartitionConfigDto, UpdatePartitionConfigDto, PartitionConfigResponseDto } from './dto/create-partition-config.dto';
import { MigrateTableDto } from './dto/migrate-tabe.dto';
import { DropPartitionDto } from './dto/drop-partition.dto';

@ApiTags('partitions')
@Controller('partitions')
export class PartitionController {
    constructor(
        private partitionService: PartitionService,
        private partitionScheduler: PartitionScheduler,
    ) { }

    @Get(':tableName')
    @ApiOperation({
        summary: 'List all partitions',
        description: 'Retrieves all partitions for a specified table with metadata including row counts and sizes'
    })
    @ApiParam({
        name: 'tableName',
        description: 'Name of the partitioned table',
        example: 'event_logs'
    })
    @ApiResponse({
        status: 200,
        description: 'Partition list retrieved successfully',
        schema: {
            example: {
                tableName: 'event_logs',
                total: 3,
                partitions: [
                    {
                        name: 'p_20251222',
                        description: '739241',
                        rows: 15000,
                        sizeBytes: 2048000,
                        createdAt: '2025-12-22T10:30:00Z'
                    }
                ]
            }
        }
    })
    async listPartitions(@Param('tableName') tableName: string) {
        const partitions = await this.partitionService.listPartitions(tableName);

        return {
            tableName,
            total: partitions.length,
            partitions: partitions.map(p => ({
                name: p.partition_name,
                description: p.partition_description,
                rows: p.table_rows,
                sizeBytes: p.data_length,
                createdAt: p.create_time,
            })),
        };
    }

    /**
     * GET /partitions/:tableName/coverage
     * Show partition date range
     */
    @Get(':tableName/coverage')
    @ApiOperation({
        summary: 'Get partition coverage',
        description: 'Returns the earliest and latest partition dates for a table'
    })
    @ApiParam({
        name: 'tableName',
        description: 'Name of the partitioned table',
        example: 'event_logs'
    })
    @ApiResponse({
        status: 200,
        description: 'Partition coverage retrieved successfully',
        schema: {
            example: {
                tableName: 'event_logs',
                earliestPartition: 'p_20251201',
                latestPartition: 'p_20251231',
                uniquePartition: 'p_future',
                totalPartitions: 30
            }
        }
    })
    async getPartitionCoverage(@Param('tableName') tableName: string) {
        return await this.partitionService.getPartitionCoverage(tableName);
    }

    /**
     * POST /partitions/truncate
     * Truncate a specific partition by date
     */
    @Post('truncate')
    @ApiOperation({
        summary: 'Truncate partition',
        description: 'Removes all data from a specific partition while keeping the partition structure intact'
    })
    @ApiResponse({
        status: 200,
        description: 'Partition truncated successfully',
        schema: {
            example: {
                success: true,
                message: 'Partition p_20251224 truncated'
            }
        }
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data'
    })
    @ApiResponse({
        status: 404,
        description: 'Partition not found'
    })
    async truncatePartition(@Body() dto: TruncatePartitionDto) {
        const date = new Date(dto.partitionDate);
        const partitionName = `p_${dto.partitionDate.replace(/-/g, '')}`;

        await this.partitionService.truncatePartition(dto.tableName, partitionName);

        return {
            success: true,
            message: `Partition ${partitionName} truncated`,
        };
    }

    /**
     * POST /partitions/truncate
     * Truncate a specific partition by date
     */
    @Post('drop')
    @ApiOperation({
        summary: 'Drop partition',
        description: 'Removes specific partition'
    })
    @ApiResponse({
        status: 200,
        description: 'Partition drop successfully',
        schema: {
            example: {
                success: true,
                message: 'Partition p_20251224 drop'
            }
        }
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data'
    })
    @ApiResponse({
        status: 404,
        description: 'Partition not found'
    })
    async dropPartition(@Body() dto: DropPartitionDto) {
        const date = new Date(dto.partitionDate);
        const partitionName = `p_${dto.partitionDate.replace(/-/g, '')}`;

        await this.partitionService.dropPartition(dto.tableName, partitionName);

        return {
            success: true,
            message: `Partition ${partitionName} drop`,
        };
    }

    /**
     * POST /partitions/maintenance/trigger
     * Manually trigger partition maintenance
     */
    @Post('maintenance/trigger')
    @ApiOperation({
        summary: 'Trigger maintenance',
        description: 'Manually initiates partition maintenance (creates future partitions and cleans up old ones)'
    })
    @ApiResponse({
        status: 200,
        description: 'Maintenance triggered successfully',
        schema: {
            example: {
                success: true,
                message: 'Partition maintenance triggered'
            }
        }
    })
    async triggerMaintenance() {
        await this.partitionScheduler.triggerManualMaintenance();

        return {
            success: true,
            message: 'Partition maintenance triggered',
        };
    }

    /**
     * GET /partitions/analyze/:tableName
     * Analyze table for partition migration readiness
     */
    @Get('analyze/:tableName')
    @ApiOperation({
        summary: 'Analyze table for partitioning',
        description: 'Checks if a table is ready to be migrated to partitioning. Analyzes updatedDate column and data distribution.'
    })
    @ApiParam({
        name: 'tableName',
        description: 'Name of the table to analyze',
        example: 'users'
    })
    @ApiResponse({
        status: 200,
        description: 'Analysis completed successfully',
        schema: {
            example: {
                tableName: 'users',
                isPartitioned: false,
                columnInfo: {
                    name: 'updatedDate',
                    type: 'timestamp',
                    fullType: 'timestamp(3)'
                },
                tableStats: {
                    estimatedRows: 150000,
                    actualRows: 150000,
                    dataSizeMB: 45.5,
                    indexSizeMB: 12.3
                },
                dateRange: {
                    earliestDate: '2024-01-15',
                    latestDate: '2025-12-24',
                    uniqueDates: 344,
                    spanDays: 344
                },
                estimatedMigrationTime: '15 seconds'
            }
        }
    })
    async analyzeTable(@Param('tableName') tableName: string) {
        return await this.partitionService.analyzeTableForMigration(tableName);
    }

    /**
     * POST /partitions/migrate
     * Migrate existing table to partitioned table
     */
    @Post('migrate')
    @ApiOperation({
        summary: 'Migrate table to partitioning',
        description: 'Converts an existing table with updatedDate column to use daily RANGE partitioning. ⚠️ This operation may take time and requires table lock.'
    })
    @ApiResponse({
        status: 200,
        description: 'Migration completed successfully',
        schema: {
            example: {
                success: true,
                tableName: 'users',
                partitionsCreated: 352,
                dateRange: {
                    start: '2024-01-15',
                    end: '2025-12-24'
                },
                config: {
                    retentionDays: 30,
                    preCreateDays: 7,
                    cleanupAction: 'DROP'
                }
            }
        }
    })
    @ApiResponse({
        status: 409,
        description: 'Table is already partitioned'
    })
    @ApiResponse({
        status: 404,
        description: 'Table or updatedDate column not found'
    })
    async migrateTable(@Body() dto: MigrateTableDto) {
        return await this.partitionService.migrateTableToPartitions(
            dto.tableName,
            dto.retentionDays,
            dto.preCreateDays,
            dto.cleanupAction
        );
    }
}