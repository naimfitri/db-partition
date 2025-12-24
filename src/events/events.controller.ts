import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create event log',
    description: 'Creates a new event log entry. The eventDate determines which partition the data is stored in.',
  })
  @ApiResponse({
    status: 201,
    description: 'Event created successfully',
    schema: {
      example: {
        id: 1,
        eventDate: '2025-12-24',
        eventType: 'user.login',
        payload: { userId: 123 },
        createdAt: '2025-12-24T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async create(@Body() createEventDto: CreateEventDto) {
    return await this.eventsService.create(createEventDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Query events',
    description: 'Retrieves events with optional filtering by date range and event type',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (YYYY-MM-DD)',
    example: '2025-12-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (YYYY-MM-DD)',
    example: '2025-12-24',
  })
  @ApiQuery({
    name: 'eventType',
    required: false,
    description: 'Filter by event type',
    example: 'user.login',
  })
  @ApiResponse({
    status: 200,
    description: 'Events retrieved successfully',
    schema: {
      example: {
        total: 100,
        events: [
          {
            id: 1,
            eventDate: '2025-12-24',
            eventType: 'user.login',
            payload: { userId: 123 },
            createdAt: '2025-12-24T10:30:00.000Z',
          },
        ],
      },
    },
  })
  async findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('eventType') eventType?: string,
  ) {
    return await this.eventsService.findAll({ startDate, endDate, eventType });
  }
}
