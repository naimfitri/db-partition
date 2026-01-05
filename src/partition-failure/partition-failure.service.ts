import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PartitionFailure, PartitionFailureDocument } from '../partition/schema/partition-failure.schema';
import { PartitionFailureStatus } from '../partition/enums/failbucket.enums';
import { PartitionService } from '../partition/partition.service';

@Injectable()
export class PartitionFailureService {
    private readonly logger = new Logger(PartitionFailureService.name);

    constructor(
        @InjectModel(PartitionFailure.name)
        private failureModel: Model<PartitionFailureDocument>,
        @Inject(forwardRef(() => PartitionService))
        private readonly partitionService: PartitionService,
    ) { }

    async recordFailure(tableName: string, partitionName: string, partitionDate: Date, error: Error,): Promise<PartitionFailureDocument> {
        this.logger.warn(`Recording parition failure: ${tableName}.${partitionName}`,);

        try {
            const existing = await this.failureModel.findOne({
                tableName,
                partitionName,
            });

            if (existing) {
                existing.retryCount += 1;
                existing.error = {
                    message: error.message,
                    code: (error as any).code,
                    stack: error.stack,
                };
                existing.status =
                    existing.retryCount >= existing.maxRetry
                        ? PartitionFailureStatus.DEAD
                        : PartitionFailureStatus.PENDING;

                return await existing.save();
            }

            const failure = new this.failureModel({
                tableName,
                partitionName,
                partitionDate,
                action: 'CREATE_PARTITION',
                status: PartitionFailureStatus.PENDING,
                retryCount: 0,
                maxRetry: 20,
                error: {
                    message: error.message,
                    code: (error as any).code,
                    stack: error.stack,
                },
            });

            return await failure.save();
        } catch (err) {
            this.logger.error('Failed to record partition failure', err);
            throw err;
        }
    }

    @Cron('0 */2 * * *')
    async retryFailedPartitions() {
        this.logger.log('Starting partition failure retry job....');

        try {
            const failures = await this.failureModel.find({
                status: {
                    $in: [PartitionFailureStatus.PENDING, PartitionFailureStatus.RETRYING],
                },
                $or: [
                    { lastRetryAt: null },
                    { lastRetryAt: { $lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
                ],
            });

            this.logger.log(`Found ${failures.length} failures to retry`);

            for (const failure of failures) {
                await this.retryPartitionCreation(failure);
            }

            this.logger.log('Partition failure retry job completed.');
        } catch (error) {
            this.logger.error('Partition retry job failed', error);
        }
    }

    private async retryPartitionCreation(failure: PartitionFailureDocument): Promise<void> {
        this.logger.log(`Retrying partition creation for ${failure.tableName}.${failure.partitionName}`);

        try {
            failure.status = PartitionFailureStatus.RETRYING;
            failure.lastRetryAt = new Date();
            await failure.save();

            await this.partitionService.createPartition(failure.tableName, failure.partitionDate);

            failure.status = PartitionFailureStatus.RESOLVED;
            failure.resolvedAt = new Date();
            await failure.save();

            this.logger.log(`Successfully retried partition creation for ${failure.tableName}.${failure.partitionName}`);
        } catch (error) {
            failure.retryCount += 1;
            failure.error = {
                message: error.message,
                code: (error as any).code,
                stack: error.stack,
            };

            if (failure.retryCount >= failure.maxRetry) {
                failure.status = PartitionFailureStatus.DEAD;
                this.logger.warn(`Partition creation for ${failure.tableName}.${failure.partitionName} marked as DEAD after max retries.`);
            } else {
                failure.status = PartitionFailureStatus.PENDING;
            }

            await failure.save();
        }
    }

    async getFailures(status?: PartitionFailureStatus) {
        const query = status ? { status } : {};
        return await this.failureModel.find(query).sort({ createdAt: -1 }).exec();
    }

    async getFailuresByTable(tableName: string) {
        return await this.failureModel
            .find({ tableName })
            .sort({ createdAt: -1 })
            .exec();
    }

    async retryById(id: string): Promise<PartitionFailureDocument> {
        const failure = await this.failureModel.findById(id);
        if (!failure) {
            throw new Error(`Failure record ${id} not found`);
        }

        await this.retryPartitionCreation(failure);
        return failure;
    }

    async getStats() {
        const [pending, retrying, resolved, dead, total] = await Promise.all([
            this.failureModel.countDocuments({ status: PartitionFailureStatus.PENDING }),
            this.failureModel.countDocuments({ status: PartitionFailureStatus.RETRYING }),
            this.failureModel.countDocuments({ status: PartitionFailureStatus.RESOLVED }),
            this.failureModel.countDocuments({ status: PartitionFailureStatus.DEAD }),
            this.failureModel.countDocuments(),
        ]);

        return {
            total,
            pending,
            retrying,
            resolved,
            dead,
        };
    }
}
