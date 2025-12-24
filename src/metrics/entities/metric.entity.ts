import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('metrics')
export class Metric {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'date', name: 'metric_date' })
  metricDate: Date;  // ⚠️ MUST be set on insert - determines partition

  @Column({ type: 'varchar', length: 100, name: 'metric_name' })
  metricName: string;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'metric_value' })
  metricValue: number;

  @Column({ type: 'json', nullable: true })
  tags: Record<string, any>;

  @Column({ 
    type: 'timestamp', 
    name: 'created_at',
    default: () => 'CURRENT_TIMESTAMP' 
  })
  createdAt: Date;
}
