import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventLog } from './entities/event-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EventLog])],
  providers: [EventsService],
  controllers: [EventsController],
})
export class EventsModule {}
