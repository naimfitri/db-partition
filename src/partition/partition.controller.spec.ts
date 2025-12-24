import { Test, TestingModule } from '@nestjs/testing';
import { PartitionController } from './partition.controller';

describe('PartitionController', () => {
  let controller: PartitionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PartitionController],
    }).compile();

    controller = module.get<PartitionController>(PartitionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
