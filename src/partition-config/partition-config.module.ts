import { Module } from '@nestjs/common';
import { PartitionConfigService } from './partition-config.service';
import { PartitionConfigController } from './partition-config.controller';
import { PartitionConfigEntity } from './entity/partittion-config.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([PartitionConfigEntity])],
  providers: [PartitionConfigService],
  controllers: [PartitionConfigController]
})
export class PartitionConfigModule {}
