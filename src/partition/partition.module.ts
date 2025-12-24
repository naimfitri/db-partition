import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartitionService } from './partition.service';
import { PartitionController } from './partition.controller';
import { PartitionScheduler } from './partition.scheduler';
import { PartitionConfigEntity } from './entity/partittion-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PartitionConfigEntity])],
  providers: [PartitionService, PartitionScheduler],
  controllers: [PartitionController],
  exports: [PartitionService],
})
export class PartitionModule {}
