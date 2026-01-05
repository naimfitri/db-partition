import { Test, TestingModule } from '@nestjs/testing';
import { PartitionFailureService } from './partition-failure.service';

describe('PartitionFailureService', () => {
  let service: PartitionFailureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PartitionFailureService],
    }).compile();

    service = module.get<PartitionFailureService>(PartitionFailureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
