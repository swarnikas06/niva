import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JobSchedulerRepository } from './job-scheduler.repository';
import { JobSchedulerService } from './job-scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { LifeContextModule } from '../life-context/life-context.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => LifeContextModule),
    forwardRef(() => EventsModule),
  ],
  providers: [JobSchedulerRepository, JobSchedulerService],
  exports: [JobSchedulerRepository, JobSchedulerService],
})
export class JobsModule {}
