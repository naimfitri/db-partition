// src/partition/dto/partition-config.dto.ts
import { IsString, IsInt, Min, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreatePartitionConfigDto {
  @ApiProperty({ 
    example: 'my_logs', 
    description: 'Name of the table to partition' 
  })
  @IsString()
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

  @ApiProperty({ example: '2025-12-24T12:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-12-24T12:00:00Z' })
  updatedAt: Date;
}