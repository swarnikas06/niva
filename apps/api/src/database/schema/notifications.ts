import { pgTable, uuid, varchar, text, boolean, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { scheduledJobs } from './scheduled-jobs';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    jobId: uuid('job_id').references(() => scheduledJobs.id, { onDelete: 'set null' }),
    channel: varchar('channel', { length: 32 }).default('in_app').notNull(), // in_app, browser, email
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    actionUrl: text('action_url'),
    read: boolean('read').default(false).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    deliveryStatus: varchar('delivery_status', { length: 32 }).default('delivered').notNull(), // pending, delivered, failed, suppressed
    deliveryAttempts: integer('delivery_attempts').default(1).notNull(),
    deliveryResult: jsonb('delivery_result').default(sql`'{}'::jsonb`).notNull(),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userReadIdx: index('notifications_user_read_idx').on(table.userId, table.read, table.createdAt),
  }),
);

export const notificationSubscriptions = pgTable(
  'notification_subscriptions',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey().notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    endpoint: text('endpoint').notNull(),
    p256dhKey: text('p256dh_key').notNull(),
    authKey: text('auth_key').notNull(),
    browser: varchar('browser', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userEndpointIdx: uniqueIndex('notif_subs_user_endpoint_idx').on(table.userId, table.endpoint),
    userIdx: index('notif_subs_user_idx').on(table.userId),
  }),
);

export type NotificationRecord = typeof notifications.$inferSelect;
export type NewNotificationRecord = typeof notifications.$inferInsert;

export type NotificationSubscription = typeof notificationSubscriptions.$inferSelect;
export type NewNotificationSubscription = typeof notificationSubscriptions.$inferInsert;
