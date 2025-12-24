export interface PartitionTableConfig {
  tableName: string;
  retentionDays: number;    // How long to keep data
  preCreateDays: number;    // Create partitions N days ahead
  cleanupAction: 'DROP' | 'TRUNCATE';
}

export interface PartitionConfig {
  enabled: boolean;
  tables: PartitionTableConfig[];
  cronSchedule: string;     // Default: '0 2 * * *' (2 AM daily)
}