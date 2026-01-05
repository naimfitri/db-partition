import { Test, TestingModule } from '@nestjs/testing';
import { PartitionFailureController } from './partition-failure.controller';

describe('PartitionFailureController', () => {
  let controller: PartitionFailureController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PartitionFailureController],
    }).compile();

    controller = module.get<PartitionFailureController>(PartitionFailureController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
