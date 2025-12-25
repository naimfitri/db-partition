import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PartitionConfigEntity } from './entity/partittion-config.entity';
import { CreatePartitionConfigDto, UpdatePartitionConfigDto } from './dto/create-partition-config.dto';

@Injectable()
export class PartitionConfigService {
    private readonly logger = new Logger(PartitionConfigService.name);

    constructor(
        @InjectDataSource() private dataSource: DataSource,
        @InjectRepository(PartitionConfigEntity)
        private configRepository: Repository<PartitionConfigEntity>,
    ) { }

    /**
     * Get all partition configurations (including disabled)
     */
    async getAllConfigs(): Promise<PartitionConfigEntity[]> {
        this.logger.log('Fetching all partition configurations');
        const configs = await this.configRepository.find({
            order: { tableName: 'ASC' }
        });
        this.logger.log(`Retrieved ${configs.length} partition configurations`);
        return configs;
    }

    /**
     * Get partition config by ID
     */
    async getConfigById(id: number): Promise<PartitionConfigEntity> {
        this.logger.log(`Fetching partition config with ID ${id}`);
        const config = await this.configRepository.findOne({ where: { id } });
        if (!config) {
            this.logger.warn(`Partition config with ID ${id} not found`);
            throw new NotFoundException(`Partition config with ID ${id} not found`);
        }
        this.logger.log(`Successfully retrieved partition config for table ${config.tableName}`);
        return config;
    }

    /**
     * Create new partition configuration
     */
    async createConfig(dto: CreatePartitionConfigDto): Promise<PartitionConfigEntity> {
        this.logger.log(`Creating partition config for table ${dto.tableName}`);
        
        // Check if table config already exists
        const existing = await this.configRepository.findOne({
            where: { tableName: dto.tableName }
        });

        if (existing) {
            this.logger.warn(`Partition config for table ${dto.tableName} already exists`);
            throw new ConflictException(`Partition config for table ${dto.tableName} already exists`);
        }

        // Verify table exists in database
        const tableExists = await this.checkTableExists(dto.tableName);
        if (!tableExists) {
            this.logger.error(`Table ${dto.tableName} does not exist in database`);
            throw new NotFoundException(`Table ${dto.tableName} does not exist in database`);
        }

        const config = this.configRepository.create({
            ...dto,
            enabled: dto.enabled ?? true
        });

        const savedConfig = await this.configRepository.save(config);
        this.logger.log(`Successfully created partition config for table ${dto.tableName}`);
        return savedConfig;
    }

    /**
     * Check if table exists in database
     */
    private async checkTableExists(tableName: string): Promise<boolean> {
        this.logger.debug(`Checking if table ${tableName} exists in database`);
        const result = await this.dataSource.query(
            `SELECT COUNT(*) as count 
         FROM information_schema.tables 
         WHERE table_schema = DATABASE() 
         AND table_name = ?`,
            [tableName]
        );
        const exists = result[0].count > 0;
        this.logger.debug(`Table ${tableName} existence check result: ${exists}`);
        return exists;
    }

    /**
         * Update partition configuration
         */
    async updateConfig(id: number, dto: UpdatePartitionConfigDto): Promise<PartitionConfigEntity> {
        this.logger.log(`Updating partition config with ID ${id}`);
        const config = await this.getConfigById(id);

        // If changing table name, check for conflicts
        if (dto.tableName && dto.tableName !== config.tableName) {
            this.logger.log(`Checking for conflicts when renaming table from ${config.tableName} to ${dto.tableName}`);
            const existing = await this.configRepository.findOne({
                where: { tableName: dto.tableName }
            });
            if (existing) {
                this.logger.warn(`Partition config for table ${dto.tableName} already exists`);
                throw new ConflictException(`Partition config for table ${dto.tableName} already exists`);
            }
        }

        Object.assign(config, dto);
        const updatedConfig = await this.configRepository.save(config);
        this.logger.log(`Successfully updated partition config with ID ${id}`);
        return updatedConfig;
    }

    /**
     * Delete partition configuration
     */
    async deleteConfig(id: number): Promise<void> {
        this.logger.log(`Deleting partition config with ID ${id}`);
        const config = await this.getConfigById(id);
        await this.configRepository.remove(config);
        this.logger.log(`Successfully deleted partition config for table ${config.tableName}`);
    }
}
