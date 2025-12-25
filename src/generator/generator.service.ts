import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Testing } from './entity/testing.entity';

@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name);

  constructor(
    @InjectRepository(Testing)
    private readonly testingRepository: Repository<Testing>,
  ) {}

  /**
   * Generates 20,000 test records with 1,000 records per date (20 dates)
   */
  async generateTestData(): Promise<{ success: boolean; message: string; recordsCreated: number }> {
    const totalRecords = 20000;
    const recordsPerDate = 1000;
    const numberOfDates = totalRecords / recordsPerDate; // 20 dates
    const batchSize = 100; // Insert in smaller batches for better performance

    this.logger.log(`Starting test data generation: ${totalRecords} records across ${numberOfDates} dates`);

    try {
      let recordsCreated = 0;
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      startDate.setDate(startDate.getDate() - 18);

      // Generate data for each date
      for (let dateIndex = 0; dateIndex < numberOfDates; dateIndex++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + dateIndex);

        this.logger.log(`Generating ${recordsPerDate} records for date: ${currentDate.toISOString().split('T')[0]}`);

        // Generate records in batches
        for (let i = 0; i < recordsPerDate; i += batchSize) {
          const batch: Testing[] = [];
          const currentBatchSize = Math.min(batchSize, recordsPerDate - i);

          for (let j = 0; j < currentBatchSize; j++) {
            const record = this.testingRepository.create({
              randname: this.generateRandomName(),
              randnumb: this.generateRandomNumber(),
              createdDate: currentDate,
              updatedDate: currentDate,
            });
            batch.push(record);
          }

          await this.testingRepository.save(batch);
          recordsCreated += batch.length;

          if (recordsCreated % 1000 === 0) {
            this.logger.log(`Progress: ${recordsCreated}/${totalRecords} records created`);
          }
        }
      }

      this.logger.log(`Successfully generated ${recordsCreated} test records`);
      return {
        success: true,
        message: `Successfully generated ${recordsCreated} test records across ${numberOfDates} dates`,
        recordsCreated,
      };
    } catch (error) {
      this.logger.error('Error generating test data', error);
      throw error;
    }
  }

  /**
   * Generates a random name
   */
  private generateRandomName(): string {
    const prefixes = ['Test', 'Demo', 'Sample', 'Mock', 'Data', 'Record', 'Entry', 'Item'];
    const suffixes = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const randomNum = Math.floor(Math.random() * 10000);
    return `${prefix}_${suffix}_${randomNum}`;
  }

  /**
   * Generates a random number between 1 and 1000000
   */
  private generateRandomNumber(): number {
    return Math.floor(Math.random() * 1000000) + 1;
  }

  /**
   * Clears all test data from the testing table
   */
  async clearTestData(): Promise<{ success: boolean; message: string; recordsDeleted: number }> {
    this.logger.log('Clearing all test data');
    try {
      const result = await this.testingRepository
        .createQueryBuilder()
        .delete()
        .from(Testing)
        .execute();

      const recordsDeleted = result.affected || 0;
      this.logger.log(`Successfully deleted ${recordsDeleted} records`);
      
      return {
        success: true,
        message: `Successfully deleted ${recordsDeleted} records`,
        recordsDeleted,
      };
    } catch (error) {
      this.logger.error('Error clearing test data', error);
      throw error;
    }
  }

  /**
   * Gets statistics about the test data
   */
  async getTestDataStats(): Promise<any> {
    try {
      const totalCount = await this.testingRepository.count();
      
      const dateStats = await this.testingRepository
        .createQueryBuilder('testing')
        .select('DATE(testing.createdDate)', 'date')
        .addSelect('COUNT(*)', 'count')
        .groupBy('DATE(testing.createdDate)')
        .orderBy('date', 'ASC')
        .getRawMany();

      return {
        totalRecords: totalCount,
        recordsByDate: dateStats,
      };
    } catch (error) {
      this.logger.error('Error getting test data stats', error);
      throw error;
    }
  }
}
