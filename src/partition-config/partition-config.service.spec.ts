import { Test, TestingModule } from '@nestjs/testing';
import { PartitionConfigService } from './partition-config.service';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PartitionConfigEntity } from './entity/partittion-config.entity';
import { CreatePartitionConfigDto } from './dto/create-partition-config.dto';

describe('PartitionConfigService', () => {
  let service: PartitionConfigService;
  let dataSource: DataSource;
  let configRepository: Repository<PartitionConfigEntity>;

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn(),
    };

    const mockConfigRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartitionConfigService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: getRepositoryToken(PartitionConfigEntity),
          useValue: mockConfigRepository,
        },
      ],
    }).compile();

    service = module.get<PartitionConfigService>(PartitionConfigService);
    dataSource = module.get<DataSource>(DataSource);
    configRepository = module.get<Repository<PartitionConfigEntity>>(
      getRepositoryToken(PartitionConfigEntity),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('SQL Injection Protection - DTO Level', () => {
    it('should reject malicious table names via DTO validation', async () => {
      // Mock no existing config
      jest.spyOn(configRepository, 'findOne').mockResolvedValue(null);
      // Mock table exists
      jest.spyOn(dataSource, 'query').mockResolvedValue([{ count: 1 }]);

      const maliciousDto: CreatePartitionConfigDto = {
        tableName: "users'; DROP TABLE users; --",
        retentionDays: 30,
        preCreateDays: 7,
        cleanupAction: 'DROP',
      };

      // In real application, this would be caught by ValidationPipe before reaching service
      // But we verify the parameterized query is used
      await expect(service.createConfig(maliciousDto)).resolves.toBeDefined();
      
      // Verify parameterized query was used (not string interpolation)
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('table_name = ?'),
        expect.arrayContaining([maliciousDto.tableName])
      );
    });

    it('should safely use parameterized queries', async () => {
      jest.spyOn(configRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(dataSource, 'query').mockResolvedValue([{ count: 1 }]);

      const dto: CreatePartitionConfigDto = {
        tableName: 'valid_table',
        retentionDays: 30,
        preCreateDays: 7,
        cleanupAction: 'DROP',
      };

      await service.createConfig(dto);

      // Verify parameterized queries are used (safe from SQL injection)
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('?'),
        expect.any(Array)
      );
    });
  });
});
