import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { EventLog } from './entities/event-log.entity';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EventLog)
    private eventLogRepository: Repository<EventLog>,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<EventLog> {
    const eventLog = this.eventLogRepository.create({
      eventDate: new Date(createEventDto.eventDate),
      eventType: createEventDto.eventType,
      payload: createEventDto.payload,
    });

    return await this.eventLogRepository.save(eventLog);
  }

  async findAll(filters: {
    startDate?: string;
    endDate?: string;
    eventType?: string;
  }) {
    const queryBuilder = this.eventLogRepository
      .createQueryBuilder('event')
      .orderBy('event.createdAt', 'DESC')
      .limit(1000); // Limit results for performance

    // Apply date range filter
    if (filters.startDate && filters.endDate) {
      queryBuilder.andWhere('event.eventDate BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters.startDate) {
      queryBuilder.andWhere('event.eventDate >= :startDate', {
        startDate: filters.startDate,
      });
    } else if (filters.endDate) {
      queryBuilder.andWhere('event.eventDate <= :endDate', {
        endDate: filters.endDate,
      });
    }

    // Apply event type filter
    if (filters.eventType) {
      queryBuilder.andWhere('event.eventType = :eventType', {
        eventType: filters.eventType,
      });
    }

    const [events, total] = await queryBuilder.getManyAndCount();

    return {
      total,
      events,
    };
  }
}
