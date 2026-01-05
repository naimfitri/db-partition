import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartitionService } from './partition.service';
import { PartitionController } from './partition.controller';
import { PartitionScheduler } from './partition.scheduler';
import { PartitionConfigEntity } from '../partition-config/entity/partittion-config.entity';
import { PartitionFailureModule } from '../partition-failure/partition-failure.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PartitionConfigEntity]),
    forwardRef(() => PartitionFailureModule),
  ],
  providers: [PartitionService, PartitionScheduler],
  controllers: [PartitionController],
  exports: [PartitionService],
})
export class PartitionModule {}
