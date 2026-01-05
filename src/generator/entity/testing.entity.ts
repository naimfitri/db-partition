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

@Entity('testing2')
export class Testing2 {
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

@Entity('testing3')
export class Testing3 {
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

@Entity('testing4')
export class Testing4 {
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
