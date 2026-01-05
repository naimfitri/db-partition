import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PartitionFailure, PartitionFailureSchema } from '../partition/schema/partition-failure.schema';
import { PartitionFailureController } from './partition-failure.controller';
import { PartitionFailureService } from './partition-failure.service';
import { PartitionModule } from '../partition/partition.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PartitionFailure.name, schema: PartitionFailureSchema }]),
    forwardRef(() => PartitionModule),
  ],
  controllers: [PartitionFailureController],
  providers: [PartitionFailureService],
  exports: [PartitionFailureService],
})
export class PartitionFailureModule {}
