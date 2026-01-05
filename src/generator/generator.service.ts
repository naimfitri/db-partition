import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Testing, Testing2, Testing3, Testing4 } from './entity/testing.entity';


@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name);

  constructor(
    @InjectRepository(Testing)
    private readonly testingRepository: Repository<Testing>,
    @InjectRepository(Testing2)
    private readonly testingRepository2: Repository<Testing2>,
    @InjectRepository(Testing3)
    private readonly testingRepository3: Repository<Testing3>,
    @InjectRepository(Testing4)
    private readonly testingRepository4: Repository<Testing4>,
  ) {}

  /**
   * Generates 20,000 test records with 1,000 records per date (20 dates) for all 4 testing tables
   */
  async generateTestData(): Promise<{ success: boolean; message: string; recordsCreated: number }> {
    const totalRecords = 20000;
    const recordsPerDate = 1000;
    const numberOfDates = totalRecords / recordsPerDate; // 20 dates
    const batchSize = 100; // Insert in smaller batches for better performance
    const repositories = [this.testingRepository, this.testingRepository2, this.testingRepository3, this.testingRepository4];
    const tableNames = ['testing', 'testing2', 'testing3', 'testing4'];

    this.logger.log(`Starting test data generation: ${totalRecords} records across ${numberOfDates} dates for ${repositories.length} tables`);

    try {
      let totalRecordsCreated = 0;
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() - 12);

      // Generate data for each repository
      for (let repoIndex = 0; repoIndex < repositories.length; repoIndex++) {
        const repository = repositories[repoIndex];
        const tableName = tableNames[repoIndex];
        this.logger.log(`Starting data generation for table: ${tableName}`);

        let recordsCreated = 0;

        // Generate data for each date
        for (let dateIndex = 0; dateIndex < numberOfDates; dateIndex++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + dateIndex);

          this.logger.log(`Generating ${recordsPerDate} records for ${tableName} on date: ${currentDate.toISOString().split('T')[0]}`);

          // Generate records in batches
          for (let i = 0; i < recordsPerDate; i += batchSize) {
            const batch: any[] = [];
            const currentBatchSize = Math.min(batchSize, recordsPerDate - i);

            for (let j = 0; j < currentBatchSize; j++) {
              const record = repository.create({
                randname: this.generateRandomName(),
                randnumb: this.generateRandomNumber(),
                updatedDate: currentDate,
                createdDate: currentDate,
              });
              batch.push(record);
            }

            await repository.save(batch);
            recordsCreated += batch.length;
            totalRecordsCreated += batch.length;

            if (recordsCreated % 1000 === 0) {
              this.logger.log(`Progress [${tableName}]: ${recordsCreated}/${totalRecords} records created`);
            }
          }
        }

        this.logger.log(`Successfully generated ${recordsCreated} test records for table: ${tableName}`);
      }

      this.logger.log(`Successfully generated ${totalRecordsCreated} test records across all 4 tables`);
      return {
        success: true,
        message: `Successfully generated ${totalRecordsCreated} test records across all 4 tables and ${numberOfDates} dates`,
        recordsCreated: totalRecordsCreated,
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
   * Clears all test data from all testing tables
   */
  async clearTestData(): Promise<{ success: boolean; message: string; recordsDeleted: number }> {
    this.logger.log('Clearing all test data from all tables');
    try {
      const repositories = [this.testingRepository, this.testingRepository2, this.testingRepository3, this.testingRepository4];
      const tableNames = ['testing', 'testing2', 'testing3', 'testing4'];
      let totalRecordsDeleted = 0;

      for (let i = 0; i < repositories.length; i++) {
        const repository = repositories[i];
        const tableName = tableNames[i];
        const result = await repository
          .createQueryBuilder()
          .delete()
          .from(repository.target)
          .execute();

        const recordsDeleted = result.affected || 0;
        totalRecordsDeleted += recordsDeleted;
        this.logger.log(`Successfully deleted ${recordsDeleted} records from ${tableName}`);
      }

      return {
        success: true,
        message: `Successfully deleted ${totalRecordsDeleted} records from all tables`,
        recordsDeleted: totalRecordsDeleted,
      };
    } catch (error) {
      this.logger.error('Error clearing test data', error);
      throw error;
    }
  }

  /**
   * Updates random records with new random data and updatedDate for all tables
   * partition_date is automatically updated via entity hooks
   */
  async updateTestData(count: number = 100): Promise<{ success: boolean; message: string; recordsUpdated: number }> {
    this.logger.log(`Updating ${count} random records in each table`);
    try {
      const repositories = [this.testingRepository, this.testingRepository2, this.testingRepository3, this.testingRepository4];
      const tableNames = ['testing', 'testing2', 'testing3', 'testing4'];
      let totalRecordsUpdated = 0;

      for (let i = 0; i < repositories.length; i++) {
        const repository = repositories[i];
        const tableName = tableNames[i];

        // Get random records to update
        const records = await repository
          .createQueryBuilder('testing')
          .orderBy('RAND()')
          .limit(count)
          .getMany();

        if (records.length === 0) {
          this.logger.log(`No records found to update in ${tableName}`);
          continue;
        }

        // Update records with new data
        for (const record of records) {
          record.randname = this.generateRandomName();
          record.randnumb = this.generateRandomNumber();
          record.updatedDate = new Date();
        }

        await repository.save(records);
        totalRecordsUpdated += records.length;

        this.logger.log(`Successfully updated ${records.length} records in ${tableName}`);
      }

      return {
        success: true,
        message: `Successfully updated ${totalRecordsUpdated} records across all tables`,
        recordsUpdated: totalRecordsUpdated,
      };
    } catch (error) {
      this.logger.error('Error updating test data', error);
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
