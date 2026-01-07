// src/partition/dto/partition-config.dto.ts
import { IsString, IsInt, Min, IsEnum, IsBoolean, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreatePartitionConfigDto {
  @ApiProperty({ 
    example: 'my_logs', 
    description: 'Name of the table to partition' 
  })
  @IsString()
  @MaxLength(64, { message: 'Table name must not exceed 64 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Table name can only contain alphanumeric characters, underscores, and hyphens'
  })
  tableName: string;

  @ApiProperty({ 
    example: 30, 
    description: 'Number of days to retain data before cleanup',
    minimum: 1
  })
  @IsInt()
  @Min(1)
  retentionDays: number;

  @ApiProperty({ 
    example: 7, 
    description: 'Number of days to pre-create partitions in advance',
    minimum: 1
  })
  @IsInt()
  @Min(1)
  preCreateDays: number;

  @ApiProperty({ 
    enum: ['DROP', 'TRUNCATE'], 
    example: 'DROP',
    description: 'Action to perform on old partitions: DROP (permanent) or TRUNCATE (keep structure)'
  })
  @IsEnum(['DROP', 'TRUNCATE'])
  cleanupAction: 'DROP' | 'TRUNCATE';

  @ApiProperty({ 
    example: true, 
    required: false,
    default: true,
    description: 'Whether partition management is enabled for this table'
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    example: '02:00',
    description: 'Scheduled time for daily partition management tasks in HH:MM format',
    default: '00:00',
    required: true
  })
  @IsString()
  scheduledTime: string;

  @ApiProperty({
    example: '2025-12-24T12:00:00Z',
    description: 'Timestamp of the last partition management run',
    required: false
  })
  lastRunAt: Date | null;
  
  @ApiProperty({
    example: '2025-12-25T12:00:00Z',
    description: 'Timestamp of the next scheduled partition management run',
    required: false
  })
  nextRunAt: Date | null;

  @ApiProperty({
    example: false,
    description: 'Indicates if a partition management task is currently running',
    required: false
  })
  @IsOptional()
  @IsBoolean()
  isRunning: boolean;
}

export class UpdatePartitionConfigDto extends PartialType(CreatePartitionConfigDto) {
  @ApiProperty({ 
    example: 'my_logs', 
    description: 'Name of the table to partition',
    required: false
  })
  @IsOptional()
  @IsString()
  tableName?: string;
}

export class PartitionConfigResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'event_logs' })
  tableName: string;

  @ApiProperty({ example: 30 })
  retentionDays: number;

  @ApiProperty({ example: 7 })
  preCreateDays: number;

  @ApiProperty({ enum: ['DROP', 'TRUNCATE'], example: 'DROP' })
  cleanupAction: 'DROP' | 'TRUNCATE';

  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: '02:00' })
  scheduledTime: string;

  @ApiProperty({ example: '2025-12-24T12:00:00Z' })
  lastRunAt: Date | null;

  @ApiProperty({ example: '2025-12-25T12:00:00Z' })
  nextRunAt: Date | null;

  @ApiProperty({ example: '2025-12-24T12:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-12-24T12:00:00Z' })
  updatedAt: Date;
}