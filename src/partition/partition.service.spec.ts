import { Test, TestingModule } from '@nestjs/testing';
import { PartitionService } from './partition.service';

describe('PartitionService', () => {
  let service: PartitionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PartitionService],
    }).compile();

    service = module.get<PartitionService>(PartitionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
