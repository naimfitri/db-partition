import { Test, TestingModule } from '@nestjs/testing';
import { PartitionService } from './partition.service';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PartitionConfigEntity } from '../partition-config/entity/partittion-config.entity';

describe('PartitionService', () => {
  let service: PartitionService;
  let dataSource: DataSource;
  let configRepository: Repository<PartitionConfigEntity>;

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn(),
    };

    const mockConfigRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartitionService,
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

    service = module.get<PartitionService>(PartitionService);
    dataSource = module.get<DataSource>(DataSource);
    configRepository = module.get<Repository<PartitionConfigEntity>>(
      getRepositoryToken(PartitionConfigEntity),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('SQL Injection Protection', () => {
  let service: PartitionService;
  let dataSource: DataSource;

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn().mockResolvedValue([{ count: 0 }]), // Mock table doesn't exist
    };

    const mockConfigRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartitionService,
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

    service = module.get<PartitionService>(PartitionService);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should reject malicious table names', async () => {
    const maliciousNames = [
      "users'; DROP TABLE users; --",
      "test`; DELETE FROM data; --",
      "table` UNION SELECT * FROM passwords --",
      "../../../etc/passwd",
      "table; DROP DATABASE",
      "table OR 1=1",
    ];

    for (const name of maliciousNames) {
      await expect(service.listPartitions(name)).rejects.toThrow();
    }
  });

  it('should accept valid table names', async () => {
    const validNames = ['users', 'test_table', 'table_name', 'table123'];

    // Mock table exists check to return false (NotFoundException is expected)
    jest.spyOn(dataSource, 'query').mockResolvedValue([{ count: 0 }]);

    for (const name of validNames) {
      // These should throw NotFoundException (table doesn't exist),
      // NOT validation errors - that means validation passed
      await expect(service.listPartitions(name)).rejects.toThrow(
        'does not exist',
      );
    }
  });

  it('should reject table names with special characters', async () => {
    const invalidNames = [
      'table@name',
      'table#name',
      'table$name',
      'table%name',
      'table&name',
      'table*name',
      'table(name',
      'table)name',
      'table=name',
      'table+name',
      'table[name',
      'table]name',
      'table{name',
      'table}name',
      'table|name',
      'table\\name',
      'table/name',
      'table<name',
      'table>name',
      'table?name',
      'table:name',
      'table;name',
      "table'name",
      'table"name',
      'table,name',
      'table.name',
      'table name', // space
    ];

    for (const name of invalidNames) {
      await expect(service.listPartitions(name)).rejects.toThrow(
        /Invalid.*Only alphanumeric/,
      );
    }
  });

  it('should reject excessively long table names', async () => {
    const longName = 'a'.repeat(65); // 65 characters (max should be 64)

    await expect(service.listPartitions(longName)).rejects.toThrow(
      /too long/,
    );
  });
});
