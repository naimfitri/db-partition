import { Injectable, Logger, NotFoundException, ConflictException, HttpException, InternalServerErrorException, Inject, forwardRef, HttpStatus } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Repository } from 'typeorm';
import { PartitionConfigEntity } from '../partition-config/entity/partittion-config.entity';
import { PARTITION_CONFIG } from './partition.config';
import { PartitionFailureService } from '../partition-failure/partition-failure.service';
import { PartitionFailureAction } from './enums/failbucket.enums';

@Injectable()
export class PartitionService {
    private readonly logger = new Logger(PartitionService.name);

    constructor(
        @InjectDataSource() private dataSource: DataSource,
        @InjectRepository(PartitionConfigEntity)
        private configRepository: Repository<PartitionConfigEntity>,
        @Inject(forwardRef(() => PartitionFailureService))
        private failureService: PartitionFailureService,
    ) { }

    /**
     * Validates identifier (table/partition name) contains only safe characters
     */
    private validateIdentifier(identifier: string, type: string = 'identifier'): void {
        // Allow only alphanumeric, underscores, and hyphens
        const validPattern = /^[a-zA-Z0-9_-]+$/;

        if (!validPattern.test(identifier)) {
            throw new Error(
                `Invalid ${type}: "${identifier}". Only alphanumeric, underscore, and hyphen allowed.`
            );
        }

        // Prevent excessively long names
        if (identifier.length > 64) {
            throw new Error(`${type} name too long. Maximum 64 characters.`);
        }
    }

    /**
     * Escapes identifier with backticks for MySQL
     */
    private escapeIdentifier(identifier: string): string {
        // First validate it's safe
        this.validateIdentifier(identifier);

        // Escape any backticks and wrap in backticks
        return `\`${identifier.replace(/`/g, '``')}\``;
    }

    /**
     * Validates table exists and returns escaped name
     */
    private async validateAndEscapeTableName(tableName: string): Promise<string> {
        this.validateIdentifier(tableName, 'table name');

        const exists = await this.checkTableExists(tableName);
        if (!exists) {
            throw new NotFoundException(`Table ${tableName} does not exist`);
        }

        return this.escapeIdentifier(tableName);
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
     * Check if table exists in database
     */
    async checkTableExists(tableName: string): Promise<boolean> {
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

        const escapedTable = await this.validateAndEscapeTableName(tableName);
        const partitionName = this.getPartitionName(date);
        const escapedPartition = this.escapeIdentifier(partitionName);


        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);

        const nextDayTimestamp = Math.floor(nextDay.getTime() / 1000);

        // Check if p_future (MAXVALUE) partition exists
        const [futurePartition] = await this.dataSource.query(
            `SELECT partition_name, partition_description
             FROM information_schema.partitions
             WHERE table_schema = DATABASE()
             AND table_name = ?
             AND partition_name = 'p_future'`,
            [tableName]
        );

        try {
            if (futurePartition) {
                // Need to reorganize p_future to add new partition before it
                this.logger.log(`Reorganizing p_future to add ${partitionName} for ${tableName}`);
                await this.dataSource.query(
                    `ALTER TABLE ${escapedTable} REORGANIZE PARTITION p_future INTO (
                        PARTITION ${escapedPartition} VALUES LESS THAN (${nextDayTimestamp}),
                        PARTITION p_future VALUES LESS THAN MAXVALUE
                    )`
                );
            } else {
                // No MAXVALUE partition, can add normally
                this.logger.log(`Adding partition ${escapedPartition} for table ${escapedTable}`);
                await this.dataSource.query(
                    `ALTER TABLE ${escapedTable} ADD PARTITION (
                        PARTITION ${escapedPartition} VALUES LESS THAN (${nextDayTimestamp})
                    )`
                );
            }

            this.logger.log(`Created partition ${partitionName} for ${tableName} (Timestamp: ${nextDayTimestamp})`);
        } catch (error) {
            if (error.message.includes('duplicate partition') ||
                error.message.includes('already exists')) {
                this.logger.debug(`Partition ${partitionName} already exists for ${tableName}`);
                return;
            }

            this.logger.error(
                `Failed to create partition ${partitionName} for ${tableName}: ${error.message}`
            );

            await this.failureService.recordFailure(
                tableName,
                partitionName,
                PartitionFailureAction.CREATE,
                date,
                error
            );

            throw {
                sqlMessage: error.sqlMessage || error.message,
                code: error.code || 'UNKNOWN_ERROR',
                message: error.sqlMessage || error.message,
            };
        }
    }

    /**
     * Create partitions N days ahead
     */
    async ensureFuturePartitions(): Promise<void> {
        const configs = await this.getActiveConfigs();

        // Process all tables in parallel
        await Promise.all(
            configs.map(tableConfig => this.processTablePartitions(tableConfig))
        );
    }

    private async processTablePartitions(tableConfig: PartitionConfigEntity): Promise<void> {
        const today = new Date();

        for (let i = 0; i <= tableConfig.preCreateDays; i++) {
            const targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() + i);

            const exist = await this.partitionExists(tableConfig.tableName, targetDate);

            try {
                const exist = await this.partitionExists(tableConfig.tableName, targetDate);

                if (!exist) {
                    await this.createPartition(tableConfig.tableName, targetDate);
                }
            } catch (error) {
                // Error already logged and recorded in createPartition
                // Continue with next partition
                this.logger.warn(
                    `Skipping partition creation for ${tableConfig.tableName} on ${targetDate.toISOString().split('T')[0]} due to error`
                );
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

        await Promise.all(
            configs.map(tableConfig => this.processCleanupOldPartitions(tableConfig))
        )
    }

    private async processCleanupOldPartitions(tableConfig: PartitionConfigEntity): Promise<void> {
        this.logger.log(`Config for ${tableConfig.tableName}: retentionDays=${tableConfig.retentionDays}, preCreateDays=${tableConfig.preCreateDays}, cleanupAction=${tableConfig.cleanupAction}`);

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - tableConfig.retentionDays);

        this.logger.log(`Checking old partitions for ${tableConfig.tableName}, cutoff date: ${this.formatDate(cutoffDate)}`);

        const oldPartitions = await this.getPartitionsOlderThan(
            tableConfig.tableName,
            cutoffDate
        );

        this.logger.log(`Found ${oldPartitions.length} old partitions from ${tableConfig.tableName} to ${tableConfig.cleanupAction}`);

        for (const partition of oldPartitions) {
            if (tableConfig.cleanupAction === 'DROP') {
                await this.dropPartition(tableConfig.tableName, partition.partition_name);
            } else {
                await this.truncatePartition(tableConfig.tableName, partition.partition_name);
            }
        }
    }

    /**
     * Get partitions older than date
     */
    private async getPartitionsOlderThan(tableName: string, date: Date) {
        const dateStr = this.formatDate(date);
        const targetPartitionName = `p_${dateStr.replace(/-/g, '')}`;

        this.logger.log(`Looking for partitions < ${targetPartitionName}`);

        // Get all partitions and filter by date pattern
        const allPartitions = await this.dataSource.query(
            `SELECT partition_name, partition_description
       FROM information_schema.partitions
       WHERE table_schema = DATABASE()
       AND table_name = ?
       AND partition_name IS NOT NULL
       AND partition_name NOT IN ('p_future')
       AND partition_name REGEXP '^p_[0-9]{8}$'`,
            [tableName]
        );

        this.logger.log(`All date partitions: ${allPartitions.map(p => p.partition_name).join(', ')}`);

        // Filter partitions older than or equal to target date
        const oldPartitions = allPartitions.filter(p => p.partition_name <= targetPartitionName);

        this.logger.log(`Filtered old partitions: ${oldPartitions.map(p => p.partition_name).join(', ') || 'none'}`);

        return oldPartitions;
    }

    /**
   * Drop partition
   */
    async dropPartition(tableName: string, partitionName: string): Promise<{ success: boolean; message: string }> {
        const escapedTable = await this.validateAndEscapeTableName(tableName);
        const escapedPartition = this.escapeIdentifier(partitionName);

        const input: string = partitionName;

        const year = parseInt(input.substring(2, 6));
        const month = parseInt(input.substring(6, 8)) - 1; // Subtract 1 for 0-indexing
        const day = parseInt(input.substring(8, 10));

        const date = new Date(year, month, day);

        try {
            await this.dataSource.query(
                `ALTER TABLE ${escapedTable} DROP PARTITION ${escapedPartition}`
            );
            this.logger.warn(`Dropped partition ${partitionName} from ${tableName}`);

            return {
                success: true,
                message: `Partition ${partitionName} dropped successfully from ${tableName}`,
            };

        } catch (err) {

            this.logger.error(
                `Failed to drop partition ${partitionName} for ${tableName}: ${err.message}`
            );

            await this.failureService.recordFailure(
                tableName,
                partitionName,
                PartitionFailureAction.DROP,
                date,
                err
            );

            throw new HttpException({
                success: false,
                message: `Failed to drop partition ${partitionName}`,
                error: err.sqlMessage || err.message,
                code: err.code || 'DB_ERROR'
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Truncate partition (keeps structure, removes data)
     */
    async truncatePartition(tableName: string, partitionName: string): Promise<{ success: boolean; message: string }> {
        const escapedTable = await this.validateAndEscapeTableName(tableName);
        const escapedPartition = this.escapeIdentifier(partitionName);

        const input: string = partitionName;

        const year = parseInt(input.substring(2, 6));
        const month = parseInt(input.substring(6, 8)) - 1; // Subtract 1 for 0-indexing
        const day = parseInt(input.substring(8, 10));

        const date = new Date(year, month, day);

        try {
            await this.dataSource.query(
                `ALTER TABLE ${escapedTable} TRUNCATE PARTITION ${escapedPartition}`
            );
            this.logger.log(`Truncated partition ${partitionName} in ${tableName}`);

            return {
                success: true,
                message: `Partition ${partitionName} truncate successfully from ${tableName}`,
            };

        } catch (err) {

            this.logger.error(
                `Failed to truncate partition ${partitionName} for ${tableName}: ${err.message}`
            );

            await this.failureService.recordFailure(
                tableName,
                partitionName,
                PartitionFailureAction.TRUNCATE,
                date,
                err
            );

            throw new HttpException({
                success: false,
                message: `Failed to truncate partition ${partitionName}`,
                error: err.sqlMessage || err.message,
                code: err.code || 'DB_ERROR'
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
   * List all partitions for a table
   */
    async listPartitions(tableName: string) {
        try {
            // Validate table name first
            await this.validateAndEscapeTableName(tableName);

            const query = `
                SELECT 
                    partition_name,
                    partition_description,
                    table_rows,
                    data_length,
                    create_time
                FROM information_schema.partitions
                WHERE table_schema = DATABASE()
                    AND table_name = ?
                    AND partition_name IS NOT NULL
                ORDER BY partition_name
                `;

            const partitions = await this.dataSource.query(query, [tableName])

            this.logger.log(`Successfully retrieved ${partitions.length} partitions for table ${tableName}`);

            return partitions;
        } catch (error) {
            this.logger.error(`Partition query failed for table ${tableName}`, error.message,);

            throw new InternalServerErrorException({
                message: error.message,
            });
        }
    }


    /**
   * Get partition coverage (earliest to latest)
   */
    async getPartitionCoverage(tableName: string) {
        try {
            const partitions = await this.listPartitions(tableName);
            const futurePartition = partitions.find(p => p.partition_name === 'p_future');

            const coverage = {
                tableName,
                earliestPartition: partitions[0]?.partition_name || null,
                latestPartition: partitions[partitions.length - 2]?.partition_name || null,
                uniquePartition: futurePartition?.partition_name || null,
                totalPartitions: partitions.length,
            };

            this.logger.log(`Successfully retrieved partition coverage for table ${tableName}: earliest=${coverage.earliestPartition}, latest=${coverage.latestPartition}, total=${coverage.totalPartitions}`);

            return coverage;

        } catch (error) {
            this.logger.error(`Failed to get partition for table ${tableName}`, error.message)

            throw new InternalServerErrorException({
                message: error.message,
            });
        }

    }

    /**
   * Helper: Generate partition name (p_YYYYMMDD)
   */
    private getPartitionName(date: Date): string {
        const gmtDate = new Date(date.getTime() + PARTITION_CONFIG.TIMEZONE_OFFSET_MS);
        return `p_${this.formatDate(gmtDate).replace(/-/g, '')}`;
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
        try {
            const escapedTable = await this.validateAndEscapeTableName(tableName);
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

            const [dateRange] = await this.dataSource.query(
                `SELECT 
                DATE_FORMAT(MIN(updatedDate), '%Y-%m-%d %H:%i:%s') as earliest_date,
                DATE_FORMAT(MAX(updatedDate), '%Y-%m-%d %H:%i:%s') as latest_date,
                COUNT(*) as actual_rows,
                COUNT(DISTINCT DATE(updatedDate)) as unique_dates
                FROM ${escapedTable}`
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

            const analyze = {
                tableName,
                isPartitioned: !!partitionInfo?.partition_name,
                columnInfo: {
                    name: 'updatedDate',
                    type: columnInfo.data_type,
                    fullType: columnInfo.column_type
                },
                tableStats: {
                    estimatedRows: Number(tableInfo.estimated_rows), // Force to Number
                    actualRows: Number(dateRange.actual_rows),       // Force to Number
                    dataSizeMB: Math.round(tableInfo.data_size_bytes / 1024 / 1024 * 100) / 100,
                    indexSizeMB: Math.round(tableInfo.index_size_bytes / 1024 / 1024 * 100) / 100
                },
                dateRange: {
                    earliestDate: dateRange.earliest_date, // This will now be "2025-12-15 00:00:00"
                    latestDate: dateRange.latest_date,     // This will now be "2026-01-03 00:00:00"
                    uniqueDates: Number(dateRange.unique_dates),
                    spanDays: Number(dateRange.unique_dates)
                },
                estimatedMigrationTime: this.estimateMigrationTime(dateRange.actual_rows)
            };

            this.logger.log(`Successfully analyzed table ${tableName}: ${analyze.tableStats.actualRows} rows, date range ${analyze.dateRange.earliestDate} to ${analyze.dateRange.latestDate}`);

            return analyze;
        } catch (error) {
            this.logger.error(`Failed to analyze table ${tableName}`, error.message);
            throw new InternalServerErrorException({
                message: error.message,
            });
        }
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
    async migrateTableToPartitions(tableName: string, retentionDays: number = 30, preCreateDays: number = 7, cleanupAction: 'DROP' | 'TRUNCATE' = 'DROP') {
        const escapedTable = await this.validateAndEscapeTableName(tableName);

        this.logger.log(`Starting migration for table: ${tableName}`);

        // Step 1: Analyze table
        const analysis = await this.analyzeTableForMigration(tableName);

        if (analysis.isPartitioned) {
            throw new ConflictException(`Table ${tableName} is already partitioned`);
        }

        // Step 2: Verify updatedDate column exists and is correct type
        const [updatedDateColumn] = await this.dataSource.query(
            `SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = ?
            AND column_name = 'updatedDate'`,
            [tableName]
        );

        if (!updatedDateColumn) {
            throw new NotFoundException(`Column 'updatedDate' not found in table ${tableName}`);
        }

        // If updatedDate is TIMESTAMP, convert it to DATE for partitioning
        if (updatedDateColumn.data_type === 'timestamp') {
            this.logger.log(`updatedDate is TIMESTAMP - will use DATE extraction for partitioning in ${tableName}`);
        }

        // Add index on updatedDate for performance
        this.logger.log(`Ensuring index on updatedDate in ${tableName}`);
        try {
            await this.dataSource.query(
                `ALTER TABLE ${escapedTable} ADD INDEX idx_updatedDate (updatedDate)`
            );
        } catch (error) {
            // Index might already exist, ignore duplicate key name error
            if (!error.message.includes('Duplicate key name')) {
                throw error;
            }
        }

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

        const pkColumnNames = pkColumns.map(col => col.column_name);

        // Only update primary key if updatedDate is not already in it
        if (!pkColumnNames.includes('updatedDate')) {
            this.logger.log(`Adding updatedDate to primary key of ${tableName}`);
            await this.dataSource.query(
                `ALTER TABLE ${escapedTable} 
                DROP PRIMARY KEY,
                ADD PRIMARY KEY (${pkColumnNames.join(', ')}, updatedDate)`
            );
        } else {
            this.logger.log(`updatedDate already in primary key of ${tableName}`);
        }

        // Step 5: Create partitions for existing data range
        this.logger.log(`Creating partitions for date range: ${analysis.dateRange.earliestDate} to ${analysis.dateRange.latestDate}`);


        const parseDbDate = (dateStr: string) => {
            // Split "2025-12-15 00:00:00" into [2025, 12, 15]
            const [datePart] = dateStr.split(' ');
            const [year, month, day] = datePart.split('-').map(Number);
            // Create a date using local time values (month is 0-indexed in JS)
            return new Date(year, month - 1, day, 0, 0, 0, 0);
        };

        const startDate = new Date(analysis.dateRange.earliestDate);
        const endDate = new Date(analysis.dateRange.latestDate);

        // Create historical partition for old data
        // const partitions = [`PARTITION p_historical VALUES LESS THAN (TO_DAYS('${this.formatDate(startDate)}'))`];

        const partitions: string[] = [];

        // Create daily partitions
        const currentDate = new Date(startDate);
        currentDate.setHours(0, 0, 0, 0);

        while (currentDate <= endDate) {
            // const partitionSuffix = this.formatDate(currentDate).replace(/-/g, '');
            const partitionSuffix = this.formatDate(new Date(currentDate.getTime() + PARTITION_CONFIG.TIMEZONE_OFFSET_MS)).replace(/-/g, '');

            // const partitionDate = this.formatDate(currentDate);
            const nextDay = new Date(currentDate);
            nextDay.setDate(nextDay.getDate() + 1);
            nextDay.setHours(0, 0, 0, 0);

            const nextDayTimestamp = Math.floor(nextDay.getTime() / 1000);

            // const nextDateStr = this.formatDate(nextDate);

            partitions.push(
                `PARTITION p_${partitionSuffix} VALUES LESS THAN (${nextDayTimestamp})`
            );

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Add future partitions
        for (let i = 1; i <= preCreateDays; i++) {
            const futureDate = new Date(endDate);
            futureDate.setDate(futureDate.getDate() + i);
            futureDate.setHours(0, 0, 0, 0);

            // const partitionSuffix = this.formatDate(futureDate).replace(/-/g, '');
            const partitionSuffix = this.formatDate(new Date(futureDate.getTime() + PARTITION_CONFIG.TIMEZONE_OFFSET_MS)).replace(/-/g, '');
            // const partitionDate = this.formatDate(futureDate);
            const nextDay = new Date(futureDate);
            nextDay.setDate(nextDay.getDate() + 1);
            nextDay.setHours(0, 0, 0, 0);

            const nextDayTimeStamp = Math.floor(nextDay.getTime() / 1000);

            // const nextDateStr = this.formatDate(nextDate);

            partitions.push(
                `PARTITION p_${partitionSuffix} VALUES LESS THAN (${nextDayTimeStamp})`
            );
        }

        // Add MAXVALUE partition to catch any future data beyond pre-created partitions
        partitions.push(`PARTITION p_future VALUES LESS THAN MAXVALUE`);

        // Step 6: Apply partitioning
        this.logger.log(`Applying RANGE partitioning to ${tableName}`);

        const validatedPartitions = partitions.map(p => {
            // Handle both "LESS THAN (value)" and "LESS THAN MAXVALUE"
            let match = p.match(/PARTITION\s+(\w+)\s+VALUES\s+LESS\s+THAN\s+MAXVALUE/i);

            if (match) {
                // MAXVALUE case (no parentheses)
                const pName = match[1];
                this.validateIdentifier(pName, 'partition name');
                return `PARTITION ${this.escapeIdentifier(pName)} VALUES LESS THAN MAXVALUE`;
            }

            // Regular value case with parentheses
            // Updated regex to properly handle nested parentheses like TO_DAYS('2023-01-01')
            match = p.match(/PARTITION\s+(\w+)\s+VALUES\s+LESS\s+THAN\s+\((.*)\)$/i);

            if (!match) {
                throw new Error(`Invalid partition format: ${p}`);
            }

            const pName = match[1];
            const pValue = match[2].trim(); // e.g., "TO_DAYS('2023-01-01')" or just a number

            // Validate partition name
            this.validateIdentifier(pName, 'partition name');

            // UPDATED VALIDATION: 
            // We now strictly allow digits (Unix Timestamps) or the legacy TO_DAYS for backward compatibility
            if (!/^(\d+|TO_DAYS\('\d{4}-\d{2}-\d{2}'\))$/.test(pValue)) {
                throw new Error(`Invalid partition value: ${pValue}. Expected a Unix timestamp (integer).`);
            }

            // Reconstruct safely
            return `PARTITION ${this.escapeIdentifier(pName)} VALUES LESS THAN (${pValue})`;
        });

        await this.dataSource.query(
            `ALTER TABLE ${escapedTable}
            PARTITION BY RANGE (UNIX_TIMESTAMP(updatedDate)) (
            ${validatedPartitions.join(',\n       ')}
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

        this.logger.log(`Migration completed for ${tableName}`);

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
