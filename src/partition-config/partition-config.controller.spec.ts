import { Test, TestingModule } from '@nestjs/testing';
import { PartitionConfigController } from './partition-config.controller';

describe('PartitionConfigController', () => {
  let controller: PartitionConfigController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PartitionConfigController],
    }).compile();

    controller = module.get<PartitionConfigController>(PartitionConfigController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
