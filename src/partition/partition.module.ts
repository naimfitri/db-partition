import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartitionService } from './partition.service';
import { PartitionController } from './partition.controller';
import { PartitionScheduler } from './partition.scheduler';
import { PartitionConfigEntity } from '../partition-config/entity/partittion-config.entity';
import { PartitionFailureModule } from '../partition-failure/partition-failure.module';
import { PartitionConfigModule } from '../partition-config/partition-config.module';
import { PartitionLock } from './partition.lock';
import { PartitionConfigService } from '../partition-config/partition-config.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PartitionConfigEntity]),
    forwardRef(() => PartitionFailureModule),
    PartitionConfigModule
  ],
  providers: [PartitionService, PartitionScheduler, PartitionLock, PartitionConfigService],
  controllers: [PartitionController],
  exports: [PartitionService],
})
export class PartitionModule {}
