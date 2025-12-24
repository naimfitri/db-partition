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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}