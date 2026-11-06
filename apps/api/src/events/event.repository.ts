import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, sql, gte, ilike } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import {
  DomainEvent,
  NewDomainEvent,
  ProactiveCandidate,
  NewProactiveCandidate,
  ProactiveAction,
  NewProactiveAction,
  ProactiveCooldown,
  UserProactivePreferences,
  NewUserProactivePreferences,
} from '../database/schema';

@Injectable()
export class EventRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ============================================================================
  // DOMAIN EVENTS (DURABLE STORE & OUTBOX)
  // ============================================================================

  async createEvent(data: NewDomainEvent): Promise<DomainEvent> {
    const [event] = await this.db.insert(schema.domainEvents).values(data).returning();
    if (!event) {
      throw new Error(`Failed to persist domain event ${data.eventType}`);
    }
    return event;
  }

  async findEventById(id: string, userId: string): Promise<DomainEvent | null> {
    const [event] = await this.db
      .select()
      .from(schema.domainEvents)
      .where(and(eq(schema.domainEvents.id, id), eq(schema.domainEvents.userId, userId)))
      .limit(1);

    return event || null;
  }

  async findEventsByUser(
    userId: string,
    filter?: { status?: string; eventType?: string; limit?: number; offset?: number },
  ): Promise<DomainEvent[]> {
    const conditions = [eq(schema.domainEvents.userId, userId)];

    if (filter?.status) {
      conditions.push(eq(schema.domainEvents.status, filter.status as any));
    }
    if (filter?.eventType) {
      conditions.push(eq(schema.domainEvents.eventType, filter.eventType));
    }

    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;

    return this.db
      .select()
      .from(schema.domainEvents)
      .where(and(...conditions))
      .orderBy(desc(schema.domainEvents.occurredAt))
      .limit(limit)
      .offset(offset);
  }

  async countEventsByUser(
    userId: string,
    filter?: { status?: string; eventType?: string },
  ): Promise<number> {
    const conditions = [eq(schema.domainEvents.userId, userId)];

    if (filter?.status) {
      conditions.push(eq(schema.domainEvents.status, filter.status as any));
    }
    if (filter?.eventType) {
      conditions.push(eq(schema.domainEvents.eventType, filter.eventType));
    }

    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.domainEvents)
      .where(and(...conditions));

    return row?.count || 0;
  }

  /**
   * Concurrency-safe atomic claim of pending or retryable failed events.
   * Utilizes FOR UPDATE SKIP LOCKED to prevent duplicate processing by concurrent workers.
   */
  async claimPendingEvents(limit = 20): Promise<DomainEvent[]> {
    const result = await this.db.execute(sql`
      UPDATE domain_events
      SET status = 'processing',
          updated_at = NOW()
      WHERE id IN (
        SELECT id
        FROM domain_events
        WHERE status = 'pending'
           OR (status = 'failed' AND retry_count < max_retries)
        ORDER BY occurred_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `);

    const rows = ((result as any).rows || result) as any[];
    return rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      eventType: r.event_type,
      eventVersion: r.event_version,
      aggregateType: r.aggregate_type,
      aggregateId: r.aggregate_id,
      payload: r.payload,
      occurredAt: new Date(r.occurred_at),
      status: r.status,
      retryCount: r.retry_count,
      maxRetries: r.max_retries,
      lastError: r.last_error,
      processedAt: r.processed_at ? new Date(r.processed_at) : null,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }));
  }

  async markEventProcessed(id: string): Promise<DomainEvent | null> {
    const [updated] = await this.db
      .update(schema.domainEvents)
      .set({
        status: 'processed',
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.domainEvents.id, id))
      .returning();

    return updated || null;
  }

  async markEventFailed(id: string, error: string): Promise<DomainEvent | null> {
    // Look up current retry count
    const [event] = await this.db
      .select({ retryCount: schema.domainEvents.retryCount, maxRetries: schema.domainEvents.maxRetries })
      .from(schema.domainEvents)
      .where(eq(schema.domainEvents.id, id))
      .limit(1);

    const nextRetry = (event?.retryCount ?? 0) + 1;
    const isDeadLetter = nextRetry >= (event?.maxRetries ?? 3);

    const [updated] = await this.db
      .update(schema.domainEvents)
      .set({
        status: isDeadLetter ? 'dead_letter' : 'failed',
        retryCount: nextRetry,
        lastError: error.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(schema.domainEvents.id, id))
      .returning();

    return updated || null;
  }

  // ============================================================================
  // PROACTIVE CANDIDATES
  // ============================================================================

  async createCandidate(data: NewProactiveCandidate): Promise<ProactiveCandidate> {
    const [candidate] = await this.db.insert(schema.proactiveCandidates).values(data).returning();
    if (!candidate) {
      throw new Error(`Failed to create proactive candidate for event ${data.eventId}`);
    }
    return candidate;
  }

  async findCandidateById(id: string, userId: string): Promise<ProactiveCandidate | null> {
    const [candidate] = await this.db
      .select()
      .from(schema.proactiveCandidates)
      .where(and(eq(schema.proactiveCandidates.id, id), eq(schema.proactiveCandidates.userId, userId)))
      .limit(1);

    return candidate || null;
  }

  async findCandidateByEvent(eventId: string, userId: string): Promise<ProactiveCandidate | null> {
    const [candidate] = await this.db
      .select()
      .from(schema.proactiveCandidates)
      .where(and(eq(schema.proactiveCandidates.eventId, eventId), eq(schema.proactiveCandidates.userId, userId)))
      .limit(1);

    return candidate || null;
  }

  async updateCandidate(
    id: string,
    data: Partial<NewProactiveCandidate>,
  ): Promise<ProactiveCandidate | null> {
    const [updated] = await this.db
      .update(schema.proactiveCandidates)
      .set({
        ...data,
      })
      .where(eq(schema.proactiveCandidates.id, id))
      .returning();

    return updated || null;
  }

  // ============================================================================
  // PROACTIVE ACTIONS (DELIVERED IN-APP)
  // ============================================================================

  async createAction(data: NewProactiveAction): Promise<ProactiveAction> {
    const [action] = await this.db.insert(schema.proactiveActions).values(data).returning();
    if (!action) {
      throw new Error(`Failed to persist proactive action for user ${data.userId}`);
    }
    return action;
  }

  async findActionsByUser(
    userId: string,
    filter?: { status?: string; limit?: number; offset?: number },
  ): Promise<ProactiveAction[]> {
    const conditions = [eq(schema.proactiveActions.userId, userId)];

    if (filter?.status) {
      conditions.push(eq(schema.proactiveActions.status, filter.status as any));
    }

    const limit = filter?.limit || 20;
    const offset = filter?.offset || 0;

    return this.db
      .select()
      .from(schema.proactiveActions)
      .where(and(...conditions))
      .orderBy(desc(schema.proactiveActions.deliveredAt))
      .limit(limit)
      .offset(offset);
  }

  async dismissAction(actionId: string, userId: string): Promise<ProactiveAction | null> {
    const [updated] = await this.db
      .update(schema.proactiveActions)
      .set({
        status: 'dismissed',
        updatedAt: new Date(),
      })
      .where(and(eq(schema.proactiveActions.id, actionId), eq(schema.proactiveActions.userId, userId)))
      .returning();

    return updated || null;
  }

  // ============================================================================
  // PROACTIVE COOLDOWNS
  // ============================================================================

  async getCooldown(
    userId: string,
    topic: string,
    candidateType: string,
  ): Promise<ProactiveCooldown | null> {
    const [cooldown] = await this.db
      .select()
      .from(schema.proactiveCooldowns)
      .where(
        and(
          eq(schema.proactiveCooldowns.userId, userId),
          eq(schema.proactiveCooldowns.topic, topic),
          eq(schema.proactiveCooldowns.candidateType, candidateType),
        ),
      )
      .limit(1);

    return cooldown || null;
  }

  async setCooldown(
    userId: string,
    topic: string,
    candidateType: string,
    cooldownUntil: Date,
    lastActionId?: string,
  ): Promise<ProactiveCooldown> {
    const [record] = await this.db
      .insert(schema.proactiveCooldowns)
      .values({
        userId,
        topic,
        candidateType,
        cooldownUntil,
        lastActionId: lastActionId || null,
      })
      .onConflictDoUpdate({
        target: [
          schema.proactiveCooldowns.userId,
          schema.proactiveCooldowns.topic,
          schema.proactiveCooldowns.candidateType,
        ],
        set: {
          cooldownUntil,
          lastActionId: lastActionId || null,
        },
      })
      .returning();

    return record!;
  }

  // ============================================================================
  // USER PROACTIVE PREFERENCES
  // ============================================================================

  async getUserPreferences(userId: string): Promise<UserProactivePreferences | null> {
    const [prefs] = await this.db
      .select()
      .from(schema.userProactivePreferences)
      .where(eq(schema.userProactivePreferences.userId, userId))
      .limit(1);

    return prefs || null;
  }

  async upsertUserPreferences(
    userId: string,
    prefs: Partial<NewUserProactivePreferences>,
  ): Promise<UserProactivePreferences> {
    const [record] = await this.db
      .insert(schema.userProactivePreferences)
      .values({
        userId,
        ...prefs,
      })
      .onConflictDoUpdate({
        target: schema.userProactivePreferences.userId,
        set: {
          ...prefs,
          updatedAt: new Date(),
        },
      })
      .returning();

    return record!;
  }

  async countDailyDeliveredActions(userId: string, sinceDate: Date): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.proactiveActions)
      .where(
        and(
          eq(schema.proactiveActions.userId, userId),
          gte(schema.proactiveActions.deliveredAt, sinceDate),
        ),
      );

    return row?.count || 0;
  }

  /**
   * Checks if user has had recent conversation messages within the time window.
   */
  async hasRecentConversationTurnOnTopic(
    userId: string,
    topic: string,
    windowMinutes = 30,
  ): Promise<boolean> {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.conversationMessages)
      .innerJoin(
        schema.conversations,
        eq(schema.conversationMessages.conversationId, schema.conversations.id),
      )
      .where(
        and(
          eq(schema.conversations.userId, userId),
          gte(schema.conversationMessages.createdAt, windowStart),
          ilike(schema.conversationMessages.content, `%${topic}%`),
        ),
      );

    return (row?.count || 0) > 0;
  }

  /**
   * Checks if user has had any conversation dialogue activity within the window.
   */
  async hasRecentDialogue(userId: string, windowMinutes = 15): Promise<boolean> {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.conversationMessages)
      .innerJoin(
        schema.conversations,
        eq(schema.conversationMessages.conversationId, schema.conversations.id),
      )
      .where(
        and(
          eq(schema.conversations.userId, userId),
          gte(schema.conversationMessages.createdAt, windowStart),
        ),
      );

    return (row?.count || 0) > 0;
  }
}

