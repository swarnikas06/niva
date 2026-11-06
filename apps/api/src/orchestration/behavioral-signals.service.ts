import { Injectable, Inject, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql, gte, lt } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import { BehavioralSignal } from '@niva/shared-types';

@Injectable()
export class BehavioralSignalsService {
  private readonly logger = new Logger(BehavioralSignalsService.name);

  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Deterministically queries database records to detect factual behavioral patterns.
   * STRICT INVARIANT: No psychological diagnosis or speculative labeling. Pure observable facts.
   */
  async detectSignals(userId: string): Promise<BehavioralSignal[]> {
    const signals: BehavioralSignal[] = [];
    const now = new Date();

    try {
      // 1. Repeated Postponement Signal (Window: 7 days)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const [postponeResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.domainEvents)
        .where(
          and(
            eq(schema.domainEvents.userId, userId),
            eq(schema.domainEvents.eventType, 'TaskPostponed'),
            gte(schema.domainEvents.occurredAt, sevenDaysAgo),
          ),
        );

      const postponeCount = Number(postponeResult?.count || 0);
      if (postponeCount >= 2) {
        signals.push({
          type: 'repeated_postponement',
          count: postponeCount,
          windowDays: 7,
          summary: `Postponed tasks ${postponeCount} times within the past 7 days`,
          details: { occurrences: postponeCount, threshold: 2 },
        });
      }

      // 2. Overdue Commitments Signal
      const [overdueResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.lifeCommitments)
        .where(
          and(
            eq(schema.lifeCommitments.userId, userId),
            eq(schema.lifeCommitments.status, 'upcoming'),
            lt(schema.lifeCommitments.dueAt, now),
          ),
        );

      const overdueCount = Number(overdueResult?.count || 0);
      if (overdueCount > 0) {
        signals.push({
          type: 'overdue_commitments',
          count: overdueCount,
          windowDays: 7,
          summary: `${overdueCount} commitment(s) currently past due`,
          details: { overdueCount },
        });
      }

      // 3. High Momentum Signal (Window: 3 days)
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const [completionResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.domainEvents)
        .where(
          and(
            eq(schema.domainEvents.userId, userId),
            eq(schema.domainEvents.eventType, 'TaskCompleted'),
            gte(schema.domainEvents.occurredAt, threeDaysAgo),
          ),
        );

      const completedCount = Number(completionResult?.count || 0);
      if (completedCount >= 3) {
        signals.push({
          type: 'high_momentum',
          count: completedCount,
          windowDays: 3,
          summary: `Completed ${completedCount} tasks in the last 3 days`,
          details: { completedCount, threshold: 3 },
        });
      }

      // 4. Proactive Fatigue Signal (Window: 1 day / 24 hours)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const [actionsResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.proactiveActions)
        .where(
          and(
            eq(schema.proactiveActions.userId, userId),
            gte(schema.proactiveActions.deliveredAt, oneDayAgo),
            eq(schema.proactiveActions.status, 'delivered'),
          ),
        );

      const deliveredCount = Number(actionsResult?.count || 0);
      if (deliveredCount >= 2) {
        // Check if user had any message in that window
        const [userMsgResult] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.conversationMessages)
          .innerJoin(
            schema.conversations,
            eq(schema.conversationMessages.conversationId, schema.conversations.id),
          )
          .where(
            and(
              eq(schema.conversations.userId, userId),
              eq(schema.conversationMessages.senderRole, 'user'),
              gte(schema.conversationMessages.createdAt, oneDayAgo),
            ),
          );

        const userMsgCount = Number(userMsgResult?.count || 0);
        if (userMsgCount === 0) {
          signals.push({
            type: 'proactive_fatigue',
            count: deliveredCount,
            windowDays: 1,
            summary: `Multiple proactive nudges delivered in the past 24h with no user interaction`,
            details: { deliveredCount, userResponses: 0 },
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to detect behavioral signals for user ${userId}: ${err.message}`);
    }

    return signals;
  }
}
