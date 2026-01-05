import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratorService } from './generator.service';
import { GeneratorController } from './generator.controller';
import { Testing, Testing2, Testing3, Testing4 } from './entity/testing.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Testing,Testing2,Testing3,Testing4])],
  providers: [GeneratorService],
  controllers: [GeneratorController]
})
export class GeneratorModule {}
