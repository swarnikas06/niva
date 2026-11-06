import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CompanionStateRepository } from './companion-state.repository';
import { CompanionStateService } from './companion-state.service';
import { CompanionStateController } from './companion-state.controller';
import { ContextSnapshotRepository } from './context-snapshot.repository';
import { ContextAssemblyService } from './context-assembly.service';
import { ContextController } from './context.controller';
import { MemoryModule } from '../memory/memory.module';
import { CareerModule } from '../career/career.module';
import { StudyModule } from '../study/study.module';
import { ReflectionModule } from '../reflection/reflection.module';

@Module({
  imports: [
    DatabaseModule,
    MemoryModule,
    CareerModule,
    StudyModule,
    ReflectionModule,
  ],
  controllers: [CompanionStateController, ContextController],
  providers: [
    CompanionStateRepository,
    CompanionStateService,
    ContextSnapshotRepository,
    ContextAssemblyService,
  ],
  exports: [
    CompanionStateService,
    ContextAssemblyService,
    CompanionStateRepository,
  ],
})
export class ContextModule {}
