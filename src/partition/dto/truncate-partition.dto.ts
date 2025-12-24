import { IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TruncatePartitionDto {
  @ApiProperty({
    description: 'Name of the table to truncate partition from',
    example: 'event_logs',
  })
  @IsString()
  tableName: string;

  @ApiProperty({
    description: 'Date of the partition to truncate (YYYY-MM-DD)',
    example: '2025-12-24',
  })
  @IsDateString()
  partitionDate: string;
}