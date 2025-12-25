import { IsString, IsInt, Min, IsEnum, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MigrateTableDto {
  @ApiProperty({ 
    example: 'users', 
    description: 'Name of the existing table to migrate to partitioning' 
  })
  @IsString()
  @MaxLength(64, { message: 'Table name must not exceed 64 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Table name can only contain alphanumeric characters, underscores, and hyphens'
  })
  tableName: string;

  @ApiProperty({ 
    example: 30, 
    description: 'Days to retain data',
    default: 30,
    required: false
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number = 30;

  @ApiProperty({ 
    example: 7, 
    description: 'Days to pre-create partitions',
    default: 7,
    required: false
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  preCreateDays?: number = 7;

  @ApiProperty({ 
    enum: ['DROP', 'TRUNCATE'], 
    example: 'DROP',
    default: 'DROP',
    required: false
  })
  @IsOptional()
  @IsEnum(['DROP', 'TRUNCATE'])
  cleanupAction?: 'DROP' | 'TRUNCATE' = 'DROP';
}