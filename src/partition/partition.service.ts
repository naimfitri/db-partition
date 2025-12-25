import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Repository } from 'typeorm';
import { PartitionConfigEntity } from '../partition-config/entity/partittion-config.entity';



@Injectable()
export class PartitionService {
    private readonly logger = new Logger(PartitionService.name);

    constructor(
        @InjectDataSource() private dataSource: DataSource,
        @InjectRepository(PartitionConfigEntity)
        private configRepository: Repository<PartitionConfigEntity>,
    ) { }

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

        const escapedTable = await this.validateAndEscapeTableName(tableName);
        const partitionName = this.getPartitionName(date);
        const escapedPartition = this.escapeIdentifier(partitionName);


        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = this.formatDate(nextDay);

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
                        PARTITION ${escapedPartition} VALUES LESS THAN (TO_DAYS('${nextDayStr}')),
                        PARTITION p_future VALUES LESS THAN MAXVALUE
                    )`
                );
            } else {
                // No MAXVALUE partition, can add normally
                await this.dataSource.query(
                    `ALTER TABLE ${escapedTable} ADD PARTITION (
                        PARTITION ${escapedPartition} VALUES LESS THAN (TO_DAYS('${nextDayStr}'))
                    )`
                );
            }

            this.logger.log(`Created partition ${partitionName} for ${tableName}`);
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
            this.logger.log(`Config for ${tableConfig.tableName}: retentionDays=${tableConfig.retentionDays}, preCreateDays=${tableConfig.preCreateDays}, cleanupAction=${tableConfig.cleanupAction}`);

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - tableConfig.retentionDays);

            this.logger.log(`Checking old partitions for ${tableConfig.tableName}, cutoff date: ${this.formatDate(cutoffDate)}`);

            const oldPartitions = await this.getPartitionsOlderThan(
                tableConfig.tableName,
                cutoffDate
            );

            this.logger.log(`Found ${oldPartitions.length} old partitions to ${tableConfig.cleanupAction}`);

            for (const partition of oldPartitions) {
                if (tableConfig.cleanupAction === 'DROP') {
                    await this.dropPartition(tableConfig.tableName, partition.partition_name);
                } else {
                    await this.truncatePartition(tableConfig.tableName, partition.partition_name);
                }
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
       AND partition_name NOT IN ('p_future', 'p_historical')
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
    async dropPartition(tableName: string, partitionName: string): Promise<void> {
        const escapedTable = await this.validateAndEscapeTableName(tableName);
        const escapedPartition = this.escapeIdentifier(partitionName);

        await this.dataSource.query(
            `ALTER TABLE ${escapedTable} DROP PARTITION ${escapedPartition}`
        );
        this.logger.warn(`🗑️  Dropped partition ${partitionName} from ${tableName}`);
    }

    /**
     * Truncate partition (keeps structure, removes data)
     */
    async truncatePartition(tableName: string, partitionName: string): Promise<void> {
        const escapedTable = await this.validateAndEscapeTableName(tableName);
        const escapedPartition = this.escapeIdentifier(partitionName);

        await this.dataSource.query(
            `ALTER TABLE ${escapedTable} TRUNCATE PARTITION ${escapedPartition}`
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

    /**
     * Validate identifier (table/partition name) contains only safe character
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
    async migrateTableToPartitions(tableName: string, retentionDays: number = 30, preCreateDays: number = 7, cleanupAction: 'DROP' | 'TRUNCATE' = 'DROP') {
        const escapedTable = await this.validateAndEscapeTableName(tableName);

        this.logger.log(`Starting migration for table: ${tableName}`);

        // Step 1: Analyze table
        const analysis = await this.analyzeTableForMigration(tableName);

        if (analysis.isPartitioned) {
            throw new ConflictException(`Table ${tableName} is already partitioned`);
        }

        // Step 2: Add partition_date column (if not exists)
        const [partitionDateColumn] = await this.dataSource.query(
            `SELECT column_name, generation_expression, extra
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = ?
            AND column_name = 'partition_date'`,
            [tableName]
        );

        if (!partitionDateColumn) {
            this.logger.log(`Adding partition_date column to ${tableName}`);

            // Add as regular column, not generated
            await this.dataSource.query(
                `ALTER TABLE ${escapedTable} 
                ADD COLUMN partition_date DATE NOT NULL
                COMMENT 'Partition key based on updatedDate'`
            );

            // Populate with values from updatedDate
            this.logger.log(`Populating partition_date from updatedDate in ${tableName}`);
            await this.dataSource.query(
                `UPDATE ${escapedTable} SET partition_date = DATE(updatedDate)`
            );

            // Add index for performance
            await this.dataSource.query(
                `ALTER TABLE ${escapedTable} ADD INDEX idx_partition_date (partition_date)`
            );
        } else if (partitionDateColumn.generation_expression) {
            // Column exists but is a GENERATED column - need to recreate it
            this.logger.log(`Recreating partition_date column in ${tableName} (was generated, needs to be regular)`);

            await this.dataSource.query(
                `ALTER TABLE ${escapedTable} DROP COLUMN partition_date`
            );

            await this.dataSource.query(
                `ALTER TABLE ${escapedTable} 
                ADD COLUMN partition_date DATE NOT NULL
                COMMENT 'Partition key based on updatedDate'`
            );

            this.logger.log(`Populating partition_date from updatedDate in ${tableName}`);
            await this.dataSource.query(
                `UPDATE ${escapedTable} SET partition_date = DATE(updatedDate)`
            );

            await this.dataSource.query(
                `ALTER TABLE ${escapedTable} ADD INDEX idx_partition_date (partition_date)`
            );
        } else {
            this.logger.log(`partition_date column already exists in ${tableName}`);
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

        // Only update primary key if partition_date is not already in it
        if (!pkColumnNames.includes('partition_date')) {
            this.logger.log(`Adding partition_date to primary key of ${tableName}`);
            await this.dataSource.query(
                `ALTER TABLE ${escapedTable} 
                DROP PRIMARY KEY,
                ADD PRIMARY KEY (${pkColumnNames.join(', ')}, partition_date)`
            );
        } else {
            this.logger.log(`partition_date already in primary key of ${tableName}`);
        }

        // Step 5: Create partitions for existing data range
        this.logger.log(`Creating partitions for date range: ${analysis.dateRange.earliestDate} to ${analysis.dateRange.latestDate}`);

        const startDate = new Date(analysis.dateRange.earliestDate);
        const endDate = new Date(analysis.dateRange.latestDate);

        // Create historical partition for old data
        const partitions = [`PARTITION p_historical VALUES LESS THAN (TO_DAYS('${this.formatDate(startDate)}'))`];

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
            match = p.match(/PARTITION\s+(\w+)\s+VALUES\s+LESS\s+THAN\s+\(([^)]+)\)/i);

            if (!match) {
                throw new Error(`Invalid partition format: ${p}`);
            }

            const pName = match[1];
            const pValue = match[2]; // e.g., "TO_DAYS('2023-01-01')" or just a number

            // Validate partition name
            this.validateIdentifier(pName, 'partition name');

            // Validate the value - allow TO_DAYS function with date, or plain numbers
            // Pattern: TO_DAYS('YYYY-MM-DD') or just digits
            if (!/^(TO_DAYS\('\d{4}-\d{2}-\d{2}'\)|\d+)$/.test(pValue.trim())) {
                throw new Error(`Invalid partition value: ${pValue}`);
            }

            // Reconstruct safely
            return `PARTITION ${this.escapeIdentifier(pName)} VALUES LESS THAN (${pValue})`;
        });

        await this.dataSource.query(
            `ALTER TABLE ${escapedTable}
            PARTITION BY RANGE (TO_DAYS(partition_date)) (
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
