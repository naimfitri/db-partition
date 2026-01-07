import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PartitionModule } from './partition/partition.module';
import { HealthModule } from './health/health.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PartitionConfigModule } from './partition-config/partition-config.module';
import { GeneratorModule } from './generator/generator.module';
import { PartitionFailureModule } from './partition-failure/partition-failure.module';
import { MongooseModule } from '@nestjs/mongoose';


@Module({
  imports: [
    PartitionModule,
    HealthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // load: [databaseConfig, partitionConfig],
      // validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mariadb',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get('DATABASE_PORT', 3306),
        username: config.get('DATABASE_USER', 'root'),
        password: config.get('DATABASE_PASSWORD', ''),
        database: config.get('DATABASE_NAME', 'partition_db'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        migrationsRun: false,
        logging: false,
      }),
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost/partition-manager'),
    ScheduleModule.forRoot(),
    PartitionConfigModule,
    GeneratorModule,
    PartitionFailureModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
