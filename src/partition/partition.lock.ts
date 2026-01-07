import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartitionConfigEntity } from '../partition-config/entity/partittion-config.entity';

@Injectable()
export class PartitionLock {

    constructor(
        @InjectRepository(PartitionConfigEntity)
        private readonly repo: Repository<PartitionConfigEntity>,
    ) {}
    // Acquire logical lock
    async acquireLock(id: number): Promise<boolean> {
        const result = await this.repo.update(
            { id, isRunning: false },
            { isRunning: true }
        );
        return result.affected === 1; // true if we got the lock
    }

    // Release logical lock
    async releaseLock(id: number): Promise<void> {
        await this.repo.update({ id }, { isRunning: false });
    }

}