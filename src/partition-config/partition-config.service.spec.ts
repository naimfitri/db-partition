import { Test, TestingModule } from '@nestjs/testing';
import { PartitionConfigService } from './partition-config.service';

describe('PartitionConfigService', () => {
  let service: PartitionConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PartitionConfigService],
    }).compile();

    service = module.get<PartitionConfigService>(PartitionConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
