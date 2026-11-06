import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventsModule } from '../events/events.module';
import { LifeContextModule } from '../life-context/life-context.module';
import { CareerModule } from '../career/career.module';
import { StudyRepository } from './study.repository';
import { StudyIntelligenceService } from './study-intelligence.service';
import { StudyController } from './study.controller';

@Module({
  imports: [DatabaseModule, EventsModule, LifeContextModule, CareerModule],
  controllers: [StudyController],
  providers: [StudyRepository, StudyIntelligenceService],
  exports: [StudyRepository, StudyIntelligenceService],
})
export class StudyModule {}
