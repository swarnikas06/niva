import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import { contextSnapshots, NewContextSnapshot } from '../database/schema';
import { ContextSnapshotDto } from '@niva/shared-types';

@Injectable()
export class ContextSnapshotRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async saveSnapshot(data: NewContextSnapshot): Promise<ContextSnapshotDto> {
    const [inserted] = await this.db
      .insert(contextSnapshots)
      .values(data)
      .returning();

    if (!inserted) {
      throw new Error('Failed to insert context snapshot');
    }

    return {
      id: inserted.id,
      userId: inserted.userId,
      conversationId: inserted.conversationId,
      triggerReason: inserted.triggerReason,
      tokenBudgetAllocated: inserted.tokenBudgetAllocated,
      tokenCountEstimated: inserted.tokenCountEstimated,
      assembledFrame: inserted.assembledFrame as any,
      createdAt: inserted.createdAt.toISOString(),
    };
  }

  async listRecentSnapshots(userId: string, limit: number = 20): Promise<ContextSnapshotDto[]> {
    const rows = await this.db
      .select()
      .from(contextSnapshots)
      .where(eq(contextSnapshots.userId, userId))
      .orderBy(desc(contextSnapshots.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      conversationId: r.conversationId,
      triggerReason: r.triggerReason,
      tokenBudgetAllocated: r.tokenBudgetAllocated,
      tokenCountEstimated: r.tokenCountEstimated,
      assembledFrame: r.assembledFrame as any,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getSnapshotById(userId: string, snapshotId: string): Promise<ContextSnapshotDto | null> {
    const [row] = await this.db
      .select()
      .from(contextSnapshots)
      .where(and(eq(contextSnapshots.id, snapshotId), eq(contextSnapshots.userId, userId)))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      conversationId: row.conversationId,
      triggerReason: row.triggerReason,
      tokenBudgetAllocated: row.tokenBudgetAllocated,
      tokenCountEstimated: row.tokenCountEstimated,
      assembledFrame: row.assembledFrame as any,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
