import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedPrincipal, NotificationRecordDto } from '@niva/shared-types';
import { NotificationRepository } from './notification.repository';
import {
  NotificationDeliveryService,
  DEFAULT_VAPID_PUBLIC_KEY,
} from './notification-delivery.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly deliveryService: NotificationDeliveryService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for authenticated user' })
  @SwaggerApiResponse({ status: 200, description: 'Paginated user notifications' })
  async listNotifications(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('read') read?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ items: NotificationRecordDto[]; unreadCount: number }> {
    const isRead = read !== undefined ? read === 'true' : undefined;
    const records = await this.repository.findUserNotifications(user.userId, {
      read: isRead,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    const unreadCount = await this.repository.countUnread(user.userId);

    return {
      items: records.map((r) => this.deliveryService.mapToDto(r)),
      unreadCount,
    };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: AuthenticatedPrincipal) {
    const count = await this.repository.countUnread(user.userId);
    return { unreadCount: count };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark specific notification as read' })
  async markAsRead(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const updated = await this.repository.markAsRead(id, user.userId);
    return updated ? this.deliveryService.mapToDto(updated) : { success: false };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all unread notifications as read' })
  async markAllAsRead(@CurrentUser() user: AuthenticatedPrincipal) {
    const count = await this.repository.markAllAsRead(user.userId);
    return { markedReadCount: count };
  }

  @Get('browser/public-key')
  @ApiOperation({ summary: 'Get browser notification VAPID public key and configuration' })
  getBrowserPublicKey() {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY', DEFAULT_VAPID_PUBLIC_KEY);
    return {
      publicKey,
      explanation: 'Browser notifications require user consent via the standard Web Notification API (Notification.requestPermission()). Once granted, the Service Worker subscribes using this VAPID public key.',
      instructions: '1. Call Notification.requestPermission(); 2. If granted, call navigator.serviceWorker.ready.pushManager.subscribe(); 3. POST subscription to /notifications/browser/subscribe.',
    };
  }

  @Get('browser/status')
  @ApiOperation({ summary: 'Get current user browser push subscription status' })
  async getBrowserStatus(@CurrentUser() user: AuthenticatedPrincipal) {
    const subs = await this.repository.findSubscriptions(user.userId);
    return {
      subscribed: subs.length > 0,
      subscriptionCount: subs.length,
      subscriptions: subs.map((s) => ({
        id: s.id,
        browser: s.browser,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }

  @Post('browser/subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save browser push subscription' })
  async subscribeBrowser(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() body: { endpoint: string; p256dhKey: string; authKey: string; browser?: string },
  ) {
    const saved = await this.repository.saveSubscription({
      userId: user.userId,
      endpoint: body.endpoint,
      p256dhKey: body.p256dhKey,
      authKey: body.authKey,
      browser: body.browser || 'Chrome/Edge',
    });
    return { success: true, subscriptionId: saved.id };
  }

  @Post('browser/unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsubscribe browser push endpoint' })
  async unsubscribeBrowser(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() body: { endpoint?: string },
  ) {
    if (body.endpoint) {
      await this.repository.deleteSubscription(user.userId, body.endpoint);
    } else {
      await this.repository.deleteAllSubscriptions(user.userId);
    }
    return { success: true, unsubscribed: true };
  }

  @Post('browser/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send test browser push notification' })
  async testBrowserNotification(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.deliveryService.deliver({
      userId: user.userId,
      channel: 'browser',
      title: 'NIVA Companion Notification Test',
      body: 'Browser push notifications are active and communicating with your NIVA instance.',
    });
  }
}
