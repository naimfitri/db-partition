import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('event_logs')
export class EventLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'date', name: 'event_date' })
  eventDate: Date;  // ⚠️ MUST be set on insert - determines partition

  @Column({ type: 'varchar', length: 50, name: 'event_type' })
  eventType: string;

  @Column({ type: 'json', nullable: true })
  payload: Record<string, any>;

  @Column({ 
    type: 'timestamp', 
    name: 'created_at',
    default: () => 'CURRENT_TIMESTAMP' 
  })
  createdAt: Date;
}
