export class PartitionInfoDto {
  tableName: string;
  partitionName: string;
  partitionDate: string;
  rowCount: number;
  dataLength: number;  // bytes
}

export class ListPartitionsResponseDto {
  total: number;
  partitions: PartitionInfoDto[];
}