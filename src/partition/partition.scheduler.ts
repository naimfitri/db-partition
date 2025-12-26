import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { PartitionService } from './partition.service';
import cronstrue from 'cronstrue';

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
    
    try {
      await this.partitionService.ensureFuturePartitions();
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
      this.handleDailyPartitionMaintenance();
    });

    this.schedulerRegistry.addCronJob('partition-maintenance', job);
    job.start();

    this.logger.log(`Partition maintenance cron job registered with schedule: ${this.cronSchedule}`);
  }

  /**
   * Daily cron: Create future partitions + cleanup old ones
   * Schedule is configurable via PARTITION_CRON env variable (default: 0 2 * * * = 2 AM daily)ss
   */
  async handleDailyPartitionMaintenance() {
    if (!this.enabled) return;

    this.logger.log('Starting daily partition maintenance...');

    try {
      // 1. Ensure future partitions exist
      await this.partitionService.ensureFuturePartitions();
      
      // 2. Cleanup old partitions
      await this.partitionService.cleanupOldPartitions();
      
      this.logger.log('Daily partition maintenance complete');
    } catch (error) {
      this.logger.error('Partition maintenance failed', error);
    }
  }

  /**
   * Manual trigger via API (optional)
   */
  async triggerManualMaintenance() {
    this.logger.log('Manual partition maintenance triggered');
    await this.handleDailyPartitionMaintenance();
  }
}