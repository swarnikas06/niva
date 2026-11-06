import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventsModule } from '../events/events.module';
import { JobsModule } from '../jobs/jobs.module';
import { LifeContextRepository } from './life-context.repository';
import { LifeContextService } from './life-context.service';
import { LifeContextController } from './life-context.controller';

@Module({
  imports: [DatabaseModule, EventsModule, forwardRef(() => JobsModule)],
  controllers: [LifeContextController],
  providers: [LifeContextRepository, LifeContextService],
  exports: [LifeContextService, LifeContextRepository],
})
export class LifeContextModule {}
