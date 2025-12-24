import { IsString, IsDateString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({
    description: 'Date for the event (determines partition)',
    example: '2025-12-24',
  })
  @IsDateString()
  eventDate: string;  // Required: determines partition

  @ApiProperty({
    description: 'Type of event',
    example: 'user.login',
  })
  @IsString()
  eventType: string;

  @ApiPropertyOptional({
    description: 'Additional event data as JSON object',
    example: { userId: 123, ip: '192.168.1.1' },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}