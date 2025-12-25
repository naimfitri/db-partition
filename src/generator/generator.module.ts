import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratorService } from './generator.service';
import { GeneratorController } from './generator.controller';
import { Testing } from './entity/testing.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Testing])],
  providers: [GeneratorService],
  controllers: [GeneratorController]
})
export class GeneratorModule {}
