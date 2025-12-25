import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PartitionModule } from './partition/partition.module';
import { HealthModule } from './health/health.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import databaseConfig from './config/database.config';
import partitionConfig from './config/partition.config';
import { validationSchema } from './config/validation.schema';
import { PartitionConfigModule } from './partition-config/partition-config.module';
import { GeneratorModule } from './generator/generator.module';


@Module({
  imports: [
    PartitionModule,
    HealthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, partitionConfig],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mariadb',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // ⚠️ Never use in production - partitions managed manually
        migrationsRun: false,
        logging: false,
      }),
    }),
    ScheduleModule.forRoot(),
    PartitionConfigModule,
    GeneratorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
