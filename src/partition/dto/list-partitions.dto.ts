import { IsString, Matches, MaxLength, IsNumber } from 'class-validator';

export class PartitionInfoDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Table name can only contain letters, numbers, underscores, and hyphens'
  })
  tableName: string;

  @IsString()
  partitionName: string;

  @IsString()
  partitionDate: string;

  @IsNumber()
  rowCount: number;

  @IsNumber()
  dataLength: number;  // bytes
}

export class ListPartitionsResponseDto {
  total: number;
  partitions: PartitionInfoDto[];
}