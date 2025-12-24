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

}
