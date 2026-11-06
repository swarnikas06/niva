import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { CharactersModule } from './characters/characters.module';
import { PersonalizationModule } from './personalization/personalization.module';
import { LifeContextModule } from './life-context/life-context.module';
import { ConversationModule } from './conversation/conversation.module';
import { ContextModule } from './context/context.module';
import { AiModule } from './ai/ai.module';
import { MemoryModule } from './memory/memory.module';
import { EventsModule } from './events/events.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { CareerModule } from './career/career.module';
import { StudyModule } from './study/study.module';
import { ReflectionModule } from './reflection/reflection.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    CharactersModule,
    PersonalizationModule,
    LifeContextModule,
    ConversationModule,
    ContextModule,
    AiModule,
    MemoryModule,
    EventsModule,
    OrchestrationModule,
    CareerModule,
    StudyModule,
    ReflectionModule,
    JobsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
