import { registerAs } from '@nestjs/config';
import { PartitionConfig } from './../partition/interfaces/partition-config.interface';

export default registerAs('partition', (): PartitionConfig => {
  const rawConfig = process.env.PARTITION_CONFIG || '[]';
  
  let tables = [];
  try {
    tables = JSON.parse(rawConfig);
  } catch (error) {
    console.warn('⚠️  Invalid PARTITION_CONFIG JSON, using empty array:', error.message);
    tables = [];
  }
  
  return {
    enabled: process.env.PARTITION_ENABLED === 'true',
    cronSchedule: process.env.PARTITION_CRON || '0 2 * * *',
    timezone: process.env.PARTITION_TIMEZONE_OFFSET_MS || '28800',
    tables,
    
  };
});