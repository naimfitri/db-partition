import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { PartitionService } from './partition.service';
import cronstrue from 'cronstrue';
import { PartitionConfigService } from '../partition-config/partition-config.service';
import { PartitionConfigEntity } from 'src/partition-config/entity/partittion-config.entity';
import { PartitionLock } from './partition.lock';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class PartitionScheduler implements OnModuleInit {
  private readonly logger = new Logger(PartitionScheduler.name);
  private readonly enabled: boolean;
  private readonly cronSchedule: string;
  private readonly timezone: string;

  constructor(
    private partitionService: PartitionService,
    private configService: ConfigService,
    private schedulerRegistry: SchedulerRegistry,
    private partitionConfigService: PartitionConfigService,
    private partitionLock: PartitionLock,
    @InjectRepository(PartitionConfigEntity)
    private configRepository: Repository<PartitionConfigEntity>,
  ) {
    this.enabled = this.configService.get('partition.enabled') || false;
    this.cronSchedule = this.configService.get('partition.cronSchedule') || '0 2 * * *';
    this.timezone = this.configService.get('partition.timezone') || '28800';
  }

  /**
   * On startup: Ensure partitions exist for today + N days ahead
   */
  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Partition management is DISABLED');
      return;
    }

    this.logger.log('Initializing partition manager...');

    if (this.timezone === '28800') {
      this.logger.log('Initializing partition manager timezon to GMT+8')
    } else {
      this.logger.log('Initializing partition manager timezone to UTC')
    }

    const humanReadable = cronstrue.toString(this.cronSchedule);
    this.logger.log(`Partition cron schedule: ${humanReadable}`);

    const configs = await this.getActiveConfigs();

    try {
      await this.partitionService.ensureFuturePartitions(configs);
      this.logger.log('Startup partition check complete');
    } catch (error) {
      this.logger.error('Startup partition check failed', error);
      // Don't crash the app, but log prominently
    }

    // Set up dynamic cron job
    this.setupCronJob();
  }

  /**
   * Setup cron job with schedule from environment variable
   */
  private setupCronJob() {
    const job = new CronJob(this.cronSchedule, () => {
      this.handleDailyPartitionMaintenanceScheduler();
    });

    this.schedulerRegistry.addCronJob('partition-maintenance', job);
    job.start();

    this.logger.log(`Partition maintenance cron job registered with schedule: ${this.cronSchedule}`);
  }

  /**
   * Daily cron: Create future partitions + cleanup old ones
   * Schedule is configurable via PARTITION_CRON env variable (default: 0 2 * * * = 2 AM daily)ss
   */
  async handleManualPartitionMaintenance() {
    if (!this.enabled) return;

    this.logger.log('Starting daily partition maintenance...');

    const configs = await this.getActiveConfigs();

    try {
      // 1. Ensure future partitions exist
      await this.partitionService.ensureFuturePartitions(configs);

      // 2. Cleanup old partitions
      await this.partitionService.cleanupOldPartitions(configs);

      this.logger.log('Daily partition maintenance complete');
    } catch (error) {
      this.logger.error('Partition maintenance failed', error);
    }
  }

  async handleDailyPartitionMaintenanceScheduler() {

    if (!this.enabled) return;

    const now = new Date();

    this.logger.log(`Partition scheduler tick at ${now.toISOString()}`);

    const dueConfigs = await this.partitionService.getTablesByCurrentTime(now);

    if (dueConfigs.length === 0) {
      this.logger.debug('No partition maintenance due');
      return;
    }

    for (const config of dueConfigs) {
      await this.runMaintenanceForConfig(config);
    }
  }

  private async runMaintenanceForConfig(
    config: PartitionConfigEntity
  ) {
    const { id, tableName } = config;

    const locked = await this.partitionLock.acquireLock(id);

    if (!locked) {
      this.logger.warn(`Partition maintenance for table ${tableName} is already running. Skipping this run.`);
      return;
    }

    this.logger.log(`Running partition maintenance for table ${tableName}`);

    try {
      await this.partitionService.ensureFuturePartitions([config]);
      await this.partitionService.cleanupOldPartitions([config]);
      // await this.markSuccess(id);

      this.logger.log(`Partition maintenance completed for ${tableName}`);
    } catch (error) {
      this.logger.error(`Partition maintenance failed for table ${tableName}`, error);
      // await this.markFailure(id);
    } finally {
      await this.partitionLock.releaseLock(id);
    }
  }

  /**
   * Manual trigger via API (optional)
   */
  async triggerManualMaintenance() {
    this.logger.log('Manual partition maintenance triggered');
    await this.handleManualPartitionMaintenance();
  }

  /**
   * Get all active partition configurations from database
   */
  async getActiveConfigs(): Promise<PartitionConfigEntity[]> {
    return await this.configRepository.find({
      where: { enabled: true },
      order: { tableName: 'ASC' }
    });
  }

  async markSuccess(id: number) {
    return;
  }

  async markFailure(id: number) {
    return;
  }
}