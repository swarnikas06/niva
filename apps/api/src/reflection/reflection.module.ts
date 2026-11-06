import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventsModule } from '../events/events.module';
import { LifeContextModule } from '../life-context/life-context.module';
import { StudyModule } from '../study/study.module';
import { CareerModule } from '../career/career.module';
import { ReflectionRepository } from './reflection.repository';
import { ReflectionEngineService } from './reflection-engine.service';
import { ReflectionController } from './reflection.controller';

@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    LifeContextModule,
    StudyModule,
    CareerModule,
  ],
  controllers: [ReflectionController],
  providers: [ReflectionRepository, ReflectionEngineService],
  exports: [ReflectionRepository, ReflectionEngineService],
})
export class ReflectionModule {}
