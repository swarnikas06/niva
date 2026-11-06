import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { NotificationRepository } from './notification.repository';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [AuthModule, forwardRef(() => EventsModule)],
  controllers: [NotificationsController],
  providers: [NotificationRepository, NotificationDeliveryService],
  exports: [NotificationRepository, NotificationDeliveryService],
})
export class NotificationsModule {}
