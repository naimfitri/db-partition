import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('testing')
export class Testing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  randname: string;

  @Column({ type: 'int' })
  randnumb: number;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedDate: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdDate: Date;
}
