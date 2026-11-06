import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import {
  notifications,
  NotificationRecord,
  NewNotificationRecord,
  notificationSubscriptions,
  NotificationSubscription,
  NewNotificationSubscription,
} from '../database/schema/notifications';

@Injectable()
export class NotificationRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async createNotification(data: NewNotificationRecord): Promise<NotificationRecord> {
    const [created] = await this.db
      .insert(notifications)
      .values(data)
      .returning();

    return created!;
  }

  async findUserNotifications(
    userId: string,
    options: { read?: boolean; limit?: number; offset?: number } = {},
  ): Promise<NotificationRecord[]> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    let query = this.db
      .select()
      .from(notifications)
      .where(
        options.read !== undefined
          ? and(eq(notifications.userId, userId), eq(notifications.read, options.read))
          : eq(notifications.userId, userId),
      )
      .orderBy(sql`${notifications.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    return query;
  }

  async markAsRead(id: string, userId: string): Promise<NotificationRecord | null> {
    const [updated] = await this.db
      .update(notifications)
      .set({
        read: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    return updated || null;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const updated = await this.db
      .update(notifications)
      .set({
        read: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .returning();

    return updated.length;
  }

  async countUnread(userId: string): Promise<number> {
    const [res] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

    return res?.count || 0;
  }

  async saveSubscription(data: NewNotificationSubscription): Promise<NotificationSubscription> {
    const [saved] = await this.db
      .insert(notificationSubscriptions)
      .values(data)
      .onConflictDoUpdate({
        target: [notificationSubscriptions.userId, notificationSubscriptions.endpoint],
        set: {
          p256dhKey: data.p256dhKey,
          authKey: data.authKey,
          browser: data.browser,
        },
      })
      .returning();

    return saved!;
  }

  async findSubscriptions(userId: string): Promise<NotificationSubscription[]> {
    return this.db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.userId, userId));
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<boolean> {
    const deleted = await this.db
      .delete(notificationSubscriptions)
      .where(
        and(
          eq(notificationSubscriptions.userId, userId),
          eq(notificationSubscriptions.endpoint, endpoint),
        ),
      )
      .returning();

    return deleted.length > 0;
  }

  async deleteSubscriptionById(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(notificationSubscriptions)
      .where(
        and(
          eq(notificationSubscriptions.id, id),
          eq(notificationSubscriptions.userId, userId),
        ),
      )
      .returning();

    return deleted.length > 0;
  }

  async deleteAllSubscriptions(userId: string): Promise<number> {
    const deleted = await this.db
      .delete(notificationSubscriptions)
      .where(eq(notificationSubscriptions.userId, userId))
      .returning();

    return deleted.length;
  }
}
