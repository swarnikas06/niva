import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.service';
import * as schema from '../../database/schema';
import { sessions, Session, NewSession } from '../../database/schema';

@Injectable()
export class SessionRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: NewSession): Promise<Session> {
    const result = await this.db.insert(sessions).values(data).returning();
    if (!result[0]) {
      throw new Error('Failed to create session');
    }
    return result[0];
  }

  async findValidByTokenHash(tokenHash: string): Promise<Session | null> {
    const now = new Date();
    const result = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      )
      .limit(1);
    return result[0] || null;
  }

  async revoke(id: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.id, id));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }
}
