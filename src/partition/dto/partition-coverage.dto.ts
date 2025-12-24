export class PartitionCoverageDto {
  tableName: string;
  earliestPartition: string;
  latestPartition: string;
  totalPartitions: number;
  retentionDays: number;
}