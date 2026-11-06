import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventsModule } from '../events/events.module';
import { LifeContextModule } from '../life-context/life-context.module';
import { AiModule } from '../ai/ai.module';
import { CareerRepository } from './career.repository';
import { CareerIntelligenceService } from './career-intelligence.service';
import { CareerPlacementStrategyService } from './career-placement-strategy.service';
import { CareerEvaluationService } from './career-evaluation.service';
import { CareerService } from './career.service';
import { CareerController } from './career.controller';

@Module({
  imports: [DatabaseModule, EventsModule, LifeContextModule, AiModule],
  controllers: [CareerController],
  providers: [
    CareerRepository,
    CareerIntelligenceService,
    CareerPlacementStrategyService,
    CareerEvaluationService,
    CareerService,
  ],
  exports: [
    CareerRepository,
    CareerIntelligenceService,
    CareerPlacementStrategyService,
    CareerEvaluationService,
    CareerService,
  ],
})
export class CareerModule {}

