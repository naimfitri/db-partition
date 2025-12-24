import { Injectable, Logger, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PartitionTableConfig } from './interfaces/partition-config.interface';
import { Repository } from 'typeorm';
import { PartitionConfigEntity } from './entity/partittion-config.entity';
import { CreatePartitionConfigDto, UpdatePartitionConfigDto } from './dto/create-partition-config.dto';



@Injectable()
export class PartitionService {
    private readonly logger = new Logger(PartitionService.name);
    private readonly tables: PartitionTableConfig[];

    constructor(
        @InjectDataSource() private dataSource: DataSource,
        @InjectRepository(PartitionConfigEntity)
        private configRepository: Repository<PartitionConfigEntity>,
        private configService: ConfigService,
    ) {
        this.tables = this.configService.get('partition.tables') || [];
    }

    /**
 * Get all active partition configurations from database
 */
    async getActiveConfigs(): Promise<PartitionConfigEntity[]> {
        return await this.configRepository.find({
            where: { enabled: true },
            order: { tableName: 'ASC' }
        });
    }

    /**
     * Get all partition configurations (including disabled)
     */
    async getAllConfigs(): Promise<PartitionConfigEntity[]> {
        return await this.configRepository.find({
            order: { tableName: 'ASC' }
        });
    }

    /**
     * Get partition config by ID
     */
    async getConfigById(id: number): Promise<PartitionConfigEntity> {
        const config = await this.configRepository.findOne({ where: { id } });
        if (!config) {
            throw new NotFoundException(`Partition config with ID ${id} not found`);
        }
        return config;
    }

    /**
     * Get partition config by table name
     */
    async getConfigByTableName(tableName: string): Promise<PartitionConfigEntity> {
        const config = await this.configRepository.findOne({ where: { tableName } });
        if (!config) {
            throw new NotFoundException(`Partition config for table ${tableName} not found`);
        }
        return config;
    }

    /**
 * Create new partition configuration
 */
    async createConfig(dto: CreatePartitionConfigDto): Promise<PartitionConfigEntity> {
        // Check if table config already exists
        const existing = await this.configRepository.findOne({
            where: { tableName: dto.tableName }
        });

        if (existing) {
            throw new ConflictException(`Partition config for table ${dto.tableName} already exists`);
        }

        // Verify table exists in database
        const tableExists = await this.checkTableExists(dto.tableName);
        if (!tableExists) {
            throw new NotFoundException(`Table ${dto.tableName} does not exist in database`);
        }

        const config = this.configRepository.create({
            ...dto,
            enabled: dto.enabled ?? true
        });

        return await this.configRepository.save(config);
    }

    /**
     * Update partition configuration
     */
    async updateConfig(id: number, dto: UpdatePartitionConfigDto): Promise<PartitionConfigEntity> {
        const config = await this.getConfigById(id);

        // If changing table name, check for conflicts
        if (dto.tableName && dto.tableName !== config.tableName) {
            const existing = await this.configRepository.findOne({
                where: { tableName: dto.tableName }
            });
            if (existing) {
                throw new ConflictException(`Partition config for table ${dto.tableName} already exists`);
            }
        }

        Object.assign(config, dto);
        return await this.configRepository.save(config);
    }

    /**
     * Delete partition configuration
     */
    async deleteConfig(id: number): Promise<void> {
        const config = await this.getConfigById(id);
        await this.configRepository.remove(config);
    }

    /**
     * Check if table exists in database
     */
    private async checkTableExists(tableName: string): Promise<boolean> {
        const result = await this.dataSource.query(
            `SELECT COUNT(*) as count 
         FROM information_schema.tables 
         WHERE table_schema = DATABASE() 
         AND table_name = ?`,
            [tableName]
        );
        return result[0].count > 0;
    }

    /**
     * Create partiton for specific date
     */
    async createPartition(tableName: string, date: Date): Promise<void> {
        const partitionName = this.getPartitionName(date);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = this.formatDate(nextDay);

        try {
            await this.dataSource.query(
                `ALTER TABLE ${tableName} ADD PARTITION (
                    PARTITION ${partitionName} VALUES LESS THAN (TO_DAYS('${nextDayStr}'))
                )`
            )

            this.logger.log(`Created partiton ${partitionName} for ${tableName}`);
        } catch (error) {
            if (!error.message.includes('duplicate partition')) {
                throw error;
            }
        }
    }

    /**
     * Create partitions N days ahead
     */
    async ensureFuturePartitions(): Promise<void> {

        const configs = await this.getActiveConfigs();

        for (const tableConfig of configs) {
            const today = new Date();

            for (let i = 0; i <= tableConfig.preCreateDays; i++) {
                const targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + i);

                const exist = await this.partitionExists(tableConfig.tableName, targetDate);

                if (!exist) {
                    await this.createPartition(tableConfig.tableName, targetDate);
                }
            }
        }
    }

    async partitionExists(tableName: string, date: Date): Promise<boolean> {
        const partitionName = this.getPartitionName(date);

        const result = await this.dataSource.query(
            `SELECT COUNT(*) as count
             FROM information_schema.partitions
             WHERE table_schema = DATABASE()
             AND table_name = ?
             AND partition_name = ?`,
            [tableName, partitionName]
        );

        return result[0].count > 0;
    }

    /**
     * Cleanup old partitions based on retention
     */
    async cleanupOldPartitions(): Promise<void> {

        const configs = await this.getActiveConfigs();

        for (const tableConfig of configs) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - tableConfig.retentionDays);

            const oldPartitions = await this.getPartitionsOlderThan(
                tableConfig.tableName,
                cutoffDate
            );

            for (const partition of oldPartitions) {
                if (tableConfig.cleanupAction === 'DROP') {
                    await this.dropPartition(tableConfig.tableName, partition.partitionName);
                } else {
                    await this.truncatePartition(tableConfig.tableName, partition.partitionName);
                }
            }
        }
    }

    /**
   * Get partitions older than date
   */
    private async getPartitionsOlderThan(tableName: string, date: Date) {
        const dateStr = this.formatDate(date);

        return await this.dataSource.query(
            `SELECT partition_name, partition_description
       FROM information_schema.partitions
       WHERE table_schema = DATABASE()
       AND table_name = ?
       AND partition_name IS NOT NULL
       AND partition_name < ?`,
            [tableName, `p_${dateStr.replace(/-/g, '')}`]
        );
    }

    /**
   * Drop partition
   */
    async dropPartition(tableName: string, partitionName: string): Promise<void> {
        await this.dataSource.query(
            `ALTER TABLE ${tableName} DROP PARTITION ${partitionName}`
        );
        this.logger.warn(`🗑️  Dropped partition ${partitionName} from ${tableName}`);
    }

    /**
   * Truncate partition (keeps structure, removes data)
   */
    async truncatePartition(tableName: string, partitionName: string): Promise<void> {
        await this.dataSource.query(
            `ALTER TABLE ${tableName} TRUNCATE PARTITION ${partitionName}`
        );
        this.logger.log(`🧹 Truncated partition ${partitionName} in ${tableName}`);
    }

    /**
   * List all partitions for a table
   */
    async listPartitions(tableName: string) {
        return await this.dataSource.query(
            `SELECT 
        partition_name,
        partition_description,
        table_rows,
        data_length,
        create_time
       FROM information_schema.partitions
       WHERE table_schema = DATABASE()
       AND table_name = ?
       AND partition_name IS NOT NULL
       ORDER BY partition_name`,
            [tableName]
        );
    }

    /**
   * Get partition coverage (earliest to latest)
   */
    async getPartitionCoverage(tableName: string) {
        const partitions = await this.listPartitions(tableName);

        return {
            tableName,
            earliestPartition: partitions[0]?.partition_name || null,
            latestPartition: partitions[partitions.length - 1]?.partition_name || null,
            totalPartitions: partitions.length,
        };
    }

    /**
   * Helper: Generate partition name (p_YYYYMMDD)
   */
    private getPartitionName(date: Date): string {
        return `p_${this.formatDate(date).replace(/-/g, '')}`;
    }

    /**
     * Helper: Format date as YYYY-MM-DD
     */
    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    //////////////////////////////////////////
    //              MIGRATION               //
    //////////////////////////////////////////

    /**
     * Analyze existing table for partition migration
     */
    async analyzeTableForMigration(tableName: string) {
        // Check if table exists
        const tableExists = await this.checkTableExists(tableName);
        if (!tableExists) {
            throw new NotFoundException(`Table ${tableName} does not exist`);
        }

        // Get table info
        const [tableInfo] = await this.dataSource.query(
            `SELECT 
      table_rows as estimated_rows,
      data_length as data_size_bytes,
      index_length as index_size_bytes
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
     AND table_name = ?`,
            [tableName]
        );

        // Check if updatedDate column exists
        const [columnInfo] = await this.dataSource.query(
            `SELECT 
      column_name,
      data_type,
      column_type
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
     AND table_name = ?
     AND column_name = 'updatedDate'`,
            [tableName]
        );

        if (!columnInfo) {
            throw new NotFoundException(`Column 'updatedDate' not found in table ${tableName}`);
        }

        // Get date range from updatedDate
        const [dateRange] = await this.dataSource.query(
            `SELECT 
      MIN(DATE(updatedDate)) as earliest_date,
      MAX(DATE(updatedDate)) as latest_date,
      COUNT(*) as actual_rows,
      COUNT(DISTINCT DATE(updatedDate)) as unique_dates
     FROM ${tableName}`
        );

        // Check if already partitioned
        const [partitionInfo] = await this.dataSource.query(
            `SELECT 
      partition_name,
      partition_method
     FROM information_schema.partitions
     WHERE table_schema = DATABASE()
     AND table_name = ?
     LIMIT 1`,
            [tableName]
        );

        return {
            tableName,
            isPartitioned: !!partitionInfo?.partition_name,
            columnInfo: {
                name: 'updatedDate',
                type: columnInfo.data_type,
                fullType: columnInfo.column_type
            },
            tableStats: {
                estimatedRows: tableInfo.estimated_rows,
                actualRows: dateRange.actual_rows,
                dataSizeMB: Math.round(tableInfo.data_size_bytes / 1024 / 1024 * 100) / 100,
                indexSizeMB: Math.round(tableInfo.index_size_bytes / 1024 / 1024 * 100) / 100
            },
            dateRange: {
                earliestDate: dateRange.earliest_date,
                latestDate: dateRange.latest_date,
                uniqueDates: dateRange.unique_dates,
                spanDays: dateRange.unique_dates
            },
            estimatedMigrationTime: this.estimateMigrationTime(dateRange.actual_rows)
        };
    }

    /**
     * Estimate migration time based on row count
     */
    private estimateMigrationTime(rows: number): string {
        // Rough estimate: 10k rows/second
        const seconds = Math.ceil(rows / 10000);

        if (seconds < 60) return `${seconds} seconds`;
        if (seconds < 3600) return `${Math.ceil(seconds / 60)} minutes`;
        return `${Math.ceil(seconds / 3600)} hours`;
    }

    /**
     * Migrate existing table to partitioned table
     */
    async migrateTableToPartitions(
        tableName: string,
        retentionDays: number = 30,
        preCreateDays: number = 7,
        cleanupAction: 'DROP' | 'TRUNCATE' = 'DROP'
    ) {
        this.logger.log(`Starting migration for table: ${tableName}`);

        // Step 1: Analyze table
        const analysis = await this.analyzeTableForMigration(tableName);

        if (analysis.isPartitioned) {
            throw new ConflictException(`Table ${tableName} is already partitioned`);
        }

        // Step 2: Add partition_date column
        this.logger.log(`Adding partition_date column to ${tableName}`);

        await this.dataSource.query(
            `ALTER TABLE ${tableName} 
     ADD COLUMN partition_date DATE 
     GENERATED ALWAYS AS (DATE(updatedDate)) STORED 
     COMMENT 'Auto-generated from updatedDate for partitioning'`
        );

        // Step 3: Get current primary key
        const [pkInfo] = await this.dataSource.query(
            `SELECT column_name 
     FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE()
     AND table_name = ?
     AND constraint_name = 'PRIMARY'
     ORDER BY ordinal_position`,
            [tableName]
        );

        // Step 4: Update primary key to include partition_date
        this.logger.log(`Updating primary key for ${tableName}`);

        const pkColumns = await this.dataSource.query(
            `SELECT column_name 
     FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE()
     AND table_name = ?
     AND constraint_name = 'PRIMARY'
     ORDER BY ordinal_position`,
            [tableName]
        );

        const pkColumnNames = pkColumns.map(col => col.column_name).join(', ');

        await this.dataSource.query(
            `ALTER TABLE ${tableName} 
     DROP PRIMARY KEY,
     ADD PRIMARY KEY (${pkColumnNames}, partition_date)`
        );

        // Step 5: Create partitions for existing data range
        this.logger.log(`Creating partitions for date range: ${analysis.dateRange.earliestDate} to ${analysis.dateRange.latestDate}`);

        const startDate = new Date(analysis.dateRange.earliestDate);
        const endDate = new Date(analysis.dateRange.latestDate);

        // Create historical partition for old data
        const partitions = [`PARTITION p_historical VALUES LESS THAN (TO_DAYS('${analysis.dateRange.earliestDate}'))`];

        // Create daily partitions
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const partitionDate = this.formatDate(currentDate);
            const nextDate = new Date(currentDate);
            nextDate.setDate(nextDate.getDate() + 1);
            const nextDateStr = this.formatDate(nextDate);

            partitions.push(
                `PARTITION p_${partitionDate.replace(/-/g, '')} VALUES LESS THAN (TO_DAYS('${nextDateStr}'))`
            );

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Add future partitions
        for (let i = 1; i <= preCreateDays; i++) {
            const futureDate = new Date(endDate);
            futureDate.setDate(futureDate.getDate() + i);
            const partitionDate = this.formatDate(futureDate);
            const nextDate = new Date(futureDate);
            nextDate.setDate(nextDate.getDate() + 1);
            const nextDateStr = this.formatDate(nextDate);

            partitions.push(
                `PARTITION p_${partitionDate.replace(/-/g, '')} VALUES LESS THAN (TO_DAYS('${nextDateStr}'))`
            );
        }

        // Step 6: Apply partitioning
        this.logger.log(`Applying RANGE partitioning to ${tableName}`);

        await this.dataSource.query(
            `ALTER TABLE ${tableName}
     PARTITION BY RANGE (TO_DAYS(partition_date)) (
       ${partitions.join(',\n       ')}
     )`
        );

        // Step 7: Add to partition_config
        this.logger.log(`Adding ${tableName} to partition configuration`);

        const config = this.configRepository.create({
            tableName,
            retentionDays,
            preCreateDays,
            cleanupAction,
            enabled: true
        });

        await this.configRepository.save(config);

        this.logger.log(`✅ Migration completed for ${tableName}`);

        return {
            success: true,
            tableName,
            partitionsCreated: partitions.length,
            dateRange: {
                start: analysis.dateRange.earliestDate,
                end: analysis.dateRange.latestDate
            },
            config: {
                retentionDays,
                preCreateDays,
                cleanupAction
            }
        };
    }
}
