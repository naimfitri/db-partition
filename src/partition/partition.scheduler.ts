import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PartitionService } from './partition.service';

@Injectable()
export class PartitionScheduler implements OnModuleInit {
  private readonly logger = new Logger(PartitionScheduler.name);
  private readonly enabled: boolean;

  constructor(
    private partitionService: PartitionService,
    private configService: ConfigService,
  ) {
    this.enabled = this.configService.get('partition.enabled') || false;
  }

  /**
   * On startup: Ensure partitions exist for today + N days ahead
   */
  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('⚠️  Partition management is DISABLED');
      return;
    }

    this.logger.log('🚀 Initializing partition manager...');
    
    try {
      await this.partitionService.ensureFuturePartitions();
      this.logger.log('✅ Startup partition check complete');
    } catch (error) {
      this.logger.error('❌ Startup partition check failed', error);
      // Don't crash the app, but log prominently
    }
  }

  /**
   * Daily cron: Create future partitions + cleanup old ones
   * Runs at 2 AM by default (configurable)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyPartitionMaintenance() {
    if (!this.enabled) return;

    this.logger.log('🔧 Starting daily partition maintenance...');

    try {
      // 1. Ensure future partitions exist
      await this.partitionService.ensureFuturePartitions();
      
      // 2. Cleanup old partitions
      await this.partitionService.cleanupOldPartitions();
      
      this.logger.log('✅ Daily partition maintenance complete');
    } catch (error) {
      this.logger.error('❌ Partition maintenance failed', error);
    }
  }

  /**
   * Manual trigger via API (optional)
   */
  async triggerManualMaintenance() {
    this.logger.log('🔧 Manual partition maintenance triggered');
    await this.handleDailyPartitionMaintenance();
  }
}