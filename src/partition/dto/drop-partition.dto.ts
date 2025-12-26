import { IsString, IsDateString, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DropPartitionDto {
  @ApiProperty({
    description: 'Name of the table to truncate partition from',
    example: 'event_logs',
  })
  @IsString()
  @MaxLength(64, { message: 'Table name must not exceed 64 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Table name can only contain alphanumeric characters, underscores, and hyphens'
  })
  tableName: string;

  @ApiProperty({
    description: 'Date of the partition to truncate (YYYY-MM-DD)',
    example: '2025-12-24',
  })
  @IsDateString()
  partitionDate: string;
}