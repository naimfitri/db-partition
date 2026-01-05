import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PartitionFailureStatus } from '../enums/failbucket.enums';

export type PartitionFailureDocument = PartitionFailure & Document;

@Schema({ collection: 'partition_failures', timestamps: true })
export class PartitionFailure {

  @Prop({ required: true, index: true })
  tableName: string;

  @Prop({ required: true })
  partitionName: string; // e.g. p_20251217

  @Prop({ required: true, type: Date })
  partitionDate: Date; // logical date used to generate partition

  @Prop({
    required: true,
    enum: ['CREATE_PARTITION'],
    default: 'CREATE_PARTITION'
  })
  action: string;

  @Prop({
    required: true,
    enum: Object.values(PartitionFailureStatus),
    default: PartitionFailureStatus.PENDING,
    index: true
  })
  status: PartitionFailureStatus;

  @Prop({ default: 0, min: 0 })
  retryCount: number;

  @Prop({ default: 5, min: 1 })
  maxRetry: number;

  @Prop({
    type: {
      message: String,
      code: String,
      stack: String,
    },
    _id: false
  })
  error?: {
    message?: string;
    code?: string;
    stack?: string;
  };

  @Prop({ type: Date, default: null })
  lastRetryAt?: Date;

  @Prop({ type: Date, default: null })
  resolvedAt?: Date;

  // Timestamps are added automatically by mongoose
  createdAt?: Date;
  updatedAt?: Date;
}

export const PartitionFailureSchema = SchemaFactory.createForClass(PartitionFailure);

// ===== INDEXES =====

// Unique constraint: prevent duplicate failures for same table+partition
PartitionFailureSchema.index({ tableName: 1, partitionName: 1 }, { unique: true });

// Compound index for retry queries (find jobs that need retry)
PartitionFailureSchema.index({ status: 1, lastRetryAt: 1 });

// Index for date-based queries and reporting
PartitionFailureSchema.index({ partitionDate: 1 });

// TTL index: auto-delete resolved failures after 90 days (optional)
PartitionFailureSchema.index({ resolvedAt: 1 }, { 
  expireAfterSeconds: 90 * 24 * 60 * 60,
  partialFilterExpression: { resolvedAt: { $ne: null } }
});