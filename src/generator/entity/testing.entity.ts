import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('testing')
export class Testing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  randname: string;

  @Column({ type: 'int' })
  randnumb: number;

  @Column({ type: 'date' })
  updatedDate: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdDate: Date;
}
