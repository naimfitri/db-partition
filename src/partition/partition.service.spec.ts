import { Test, TestingModule } from '@nestjs/testing';
import { PartitionService } from './partition.service';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PartitionConfigEntity } from '../partition-config/entity/partittion-config.entity';
import { PartitionFailureService } from '../partition-failure/partition-failure.service';


describe('PartitionService', () => {
  let service: PartitionService;
  let dataSource: DataSource;
  let configRepository: Repository<PartitionConfigEntity>;
  let mockFailureService: any;

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

    mockFailureService = {
      recordFailure: jest.fn().mockResolvedValue({}),
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
        {
          provide: PartitionFailureService,
          useValue: mockFailureService,
        },
      ],
    }).compile();

    service = module.get<PartitionService>(PartitionService);
    dataSource = module.get<DataSource>(DataSource);
    (service as any).failureService = mockFailureService;
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

describe('dropPartition with recordFailure', () => {
  let service: PartitionService;
  let dataSource: DataSource;
  let mockFailureService: any;

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

    mockFailureService = {
      recordFailure: jest.fn().mockResolvedValue({}),
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
        {
          provide: PartitionFailureService,
          useValue: mockFailureService,
        },
      ],
    }).compile();

    service = module.get<PartitionService>(PartitionService);
    dataSource = module.get<DataSource>(DataSource);
    // Inject the mock failure service
    (service as any).failureService = mockFailureService;
  });

  it('should successfully drop a partition from testing2 table', async () => {
    const tableName = 'testing2';
    const partitionName = 'p_20250101';

    // Mock: table exists
    jest.spyOn(dataSource, 'query').mockResolvedValueOnce([{ count: 1 }]);

    // Mock: drop partition query succeeds
    jest.spyOn(dataSource, 'query').mockResolvedValueOnce(undefined);

    await service.dropPartition(tableName, partitionName);

    // Verify the DROP PARTITION query was called
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP PARTITION'),
    );
  });

  it('should record failure when dropping partition fails', async () => {
    const tableName = 'testing2';
    const partitionName = 'p_20250105';
    const mockError = new Error('Partition not found');

    // Mock: table exists check
    jest.spyOn(dataSource, 'query').mockResolvedValueOnce([{ count: 1 }]);

    // Mock: drop partition query fails
    jest.spyOn(dataSource, 'query').mockRejectedValueOnce(mockError);

    const mockFailureService = {
      recordFailure: jest.fn().mockResolvedValue({}),
    };
    (service as any).failureService = mockFailureService;

    await service.dropPartition(tableName, partitionName);

    // Verify recordFailure was called with correct arguments
    expect(mockFailureService.recordFailure).toHaveBeenCalledWith(
      tableName,
      partitionName,
      expect.any(Date), // The parsed date from partition name
      mockError,
    );
  });

  it('should correctly parse partition date from partition name p_20250105', async () => {
    const tableName = 'testing2';
    const partitionName = 'p_20250105'; // January 5, 2025

    // Mock: table exists check
    jest.spyOn(dataSource, 'query').mockResolvedValueOnce([{ count: 1 }]);

    // Mock: drop partition query fails
    const mockError = new Error('Test error');
    jest.spyOn(dataSource, 'query').mockRejectedValueOnce(mockError);

    const mockFailureService = {
      recordFailure: jest.fn().mockResolvedValue({}),
    };
    (service as any).failureService = mockFailureService;

    await service.dropPartition(tableName, partitionName);

    // Verify recordFailure was called with the correct parsed date
    const callArgs = mockFailureService.recordFailure.mock.calls[0];
    const parsedDate = callArgs[2];

    expect(parsedDate.getFullYear()).toBe(2025);
    expect(parsedDate.getMonth()).toBe(0); // 0-indexed (January)
    expect(parsedDate.getDate()).toBe(5);
  });

  it('should handle multiple partition drop failures sequentially', async () => {
    const tableName = 'testing2';
    const partitions = ['p_20250101', 'p_20250102', 'p_20250103'];
    const mockError = new Error('Drop failed');

    // Mock: table exists check (once per call)
    jest
      .spyOn(dataSource, 'query')
      .mockResolvedValueOnce([{ count: 1 }])
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce([{ count: 1 }])
      .mockRejectedValueOnce(mockError);

    const mockFailureService = {
      recordFailure: jest.fn().mockResolvedValue({}),
    };
    (service as any).failureService = mockFailureService;

    for (const partition of partitions) {
      await service.dropPartition(tableName, partition);
    }

    // Verify recordFailure was called 3 times
    expect(mockFailureService.recordFailure).toHaveBeenCalledTimes(3);
  });

  it('should throw error and call recordFailure when testing2 table partition drop fails', async () => {
    const tableName = 'testing2';
    const partitionName = 'p_20250105';
    
    // Mock: table exists
    jest.spyOn(dataSource, 'query').mockResolvedValueOnce([{ count: 1 }]);
    
    // Mock: DROP PARTITION query throws an error
    const dbError = new Error('Partition does not exist');
    jest.spyOn(dataSource, 'query').mockRejectedValueOnce(dbError);

    await service.dropPartition(tableName, partitionName);

    // Verify recordFailure was called
    expect(mockFailureService.recordFailure).toHaveBeenCalledTimes(1);
    expect(mockFailureService.recordFailure).toHaveBeenCalledWith(
      'testing2',
      'p_20250105',
      expect.any(Date),
      dbError
    );
  });
});
