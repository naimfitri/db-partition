import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('partition_config')
export class PartitionConfigEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'table_name', type: 'varchar', length: 64, unique: true })
  tableName: string;

  @Column({ name: 'retention_days', type: 'int', default: 30 })
  retentionDays: number;

  @Column({ name: 'pre_create_days', type: 'int', default: 7 })
  preCreateDays: number;

  @Column({
    name: 'cleanup_action',
    type: 'enum',
    enum: ['DROP', 'TRUNCATE'],
    default: 'DROP'
  })
  cleanupAction: 'DROP' | 'TRUNCATE';

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'scheduled_time', type: 'varchar', length: 5, default: '00:00' })
  scheduledTime: string;

  @Column({ name: 'last_run_at', type: 'timestamp', nullable: true })
  lastRunAt: Date | null;

  @Column({ name: 'next_run_at', type: 'timestamp', nullable: true })
  nextRunAt: Date | null;

  @Column({ name: 'is_running', type: 'boolean', default: false })
  isRunning: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}