import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import {
  longitudinalObservations,
  reflectionSnapshots,
  LongitudinalObservation,
  NewLongitudinalObservation,
  ReflectionSnapshot,
  NewReflectionSnapshot,
} from '../database/schema';

@Injectable()
export class ReflectionRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ==========================================
  // LONGITUDINAL OBSERVATIONS
  // ==========================================

  async findObservations(
    userId: string,
    filters?: {
      status?: string;
      category?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<LongitudinalObservation[]> {
    const conditions = [eq(longitudinalObservations.userId, userId)];

    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(longitudinalObservations.status, filters.status));
    }
    if (filters?.category) {
      conditions.push(eq(longitudinalObservations.category, filters.category));
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    return this.db
      .select()
      .from(longitudinalObservations)
      .where(and(...conditions))
      .orderBy(desc(longitudinalObservations.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async findObservationById(
    userId: string,
    id: string,
  ): Promise<LongitudinalObservation | null> {
    const rows = await this.db
      .select()
      .from(longitudinalObservations)
      .where(
        and(
          eq(longitudinalObservations.id, id),
          eq(longitudinalObservations.userId, userId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async createObservation(
    data: NewLongitudinalObservation,
  ): Promise<LongitudinalObservation> {
    const rows = await this.db
      .insert(longitudinalObservations)
      .values(data)
      .returning();

    return rows[0]!;
  }

  async updateObservation(
    userId: string,
    id: string,
    updates: Partial<NewLongitudinalObservation>,
  ): Promise<LongitudinalObservation | null> {
    const rows = await this.db
      .update(longitudinalObservations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(longitudinalObservations.id, id),
          eq(longitudinalObservations.userId, userId),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  async deleteObservation(userId: string, id: string): Promise<boolean> {
    const result = await this.db
      .delete(longitudinalObservations)
      .where(
        and(
          eq(longitudinalObservations.id, id),
          eq(longitudinalObservations.userId, userId),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }

  async findActiveAndConfirmedObservations(
    userId: string,
    limit = 10,
  ): Promise<LongitudinalObservation[]> {
    return this.db
      .select()
      .from(longitudinalObservations)
      .where(
        and(
          eq(longitudinalObservations.userId, userId),
          inArray(longitudinalObservations.status, ['active', 'confirmed']),
        ),
      )
      .orderBy(
        desc(longitudinalObservations.confidence),
        desc(longitudinalObservations.createdAt),
      )
      .limit(limit);
  }

  async findRecentCorrections(
    userId: string,
    limit = 10,
  ): Promise<LongitudinalObservation[]> {
    return this.db
      .select()
      .from(longitudinalObservations)
      .where(
        and(
          eq(longitudinalObservations.userId, userId),
          eq(longitudinalObservations.status, 'corrected'),
        ),
      )
      .orderBy(desc(longitudinalObservations.correctedAt))
      .limit(limit);
  }

  async countObservationsByStatus(
    userId: string,
  ): Promise<{
    total: number;
    active: number;
    confirmed: number;
    corrected: number;
    dismissed: number;
  }> {
    const rows = await this.db
      .select({
        status: longitudinalObservations.status,
        count: sql<number>`count(*)::int`,
      })
      .from(longitudinalObservations)
      .where(eq(longitudinalObservations.userId, userId))
      .groupBy(longitudinalObservations.status);

    const counts = {
      total: 0,
      active: 0,
      confirmed: 0,
      corrected: 0,
      dismissed: 0,
    };

    for (const row of rows) {
      counts.total += row.count;
      if (row.status === 'active') counts.active = row.count;
      else if (row.status === 'confirmed') counts.confirmed = row.count;
      else if (row.status === 'corrected') counts.corrected = row.count;
      else if (row.status === 'dismissed') counts.dismissed = row.count;
    }

    return counts;
  }

  async touchObservationsSurfaced(userId: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.db
      .update(longitudinalObservations)
      .set({
        surfacedCount: sql`${longitudinalObservations.surfacedCount} + 1`,
        lastSurfacedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(longitudinalObservations.userId, userId),
          inArray(longitudinalObservations.id, ids),
        ),
      );
  }

  // ==========================================
  // REFLECTION SNAPSHOTS
  // ==========================================

  async createSnapshot(
    data: NewReflectionSnapshot,
  ): Promise<ReflectionSnapshot> {
    const rows = await this.db
      .insert(reflectionSnapshots)
      .values(data)
      .returning();

    return rows[0]!;
  }

  async getLatestSnapshot(
    userId: string,
    windowDays?: number,
  ): Promise<ReflectionSnapshot | null> {
    const conditions = [eq(reflectionSnapshots.userId, userId)];
    if (windowDays) {
      conditions.push(eq(reflectionSnapshots.windowDays, windowDays));
    }

    const rows = await this.db
      .select()
      .from(reflectionSnapshots)
      .where(and(...conditions))
      .orderBy(desc(reflectionSnapshots.createdAt))
      .limit(1);

    return rows[0] ?? null;
  }
}
