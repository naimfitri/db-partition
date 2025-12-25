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
}
