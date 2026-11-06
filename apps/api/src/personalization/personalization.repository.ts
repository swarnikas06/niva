import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import {
  userPersonalization,
  UserPersonalization,
  NewUserPersonalization,
} from '../database/schema';

@Injectable()
export class PersonalizationRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByUserId(userId: string): Promise<UserPersonalization | null> {
    const result = await this.db
      .select()
      .from(userPersonalization)
      .where(eq(userPersonalization.userId, userId))
      .limit(1);
    return result[0] || null;
  }

  async upsert(
    userId: string,
    data: Partial<NewUserPersonalization>,
  ): Promise<UserPersonalization> {
    const insertValues: NewUserPersonalization = {
      userId,
      selectedArchetypeId: data.selectedArchetypeId || 'niva_anchor',
      warmth: data.warmth ?? 75,
      directness: data.directness ?? 65,
      humor: data.humor ?? 50,
      challengeLevel: data.challengeLevel ?? 60,
      proactivity: data.proactivity || 'medium',
      responseLength: data.responseLength || 'balanced',
      onboardingCompleted: data.onboardingCompleted ?? false,
      onboardingStep: data.onboardingStep || 'identity',
      preferredName: data.preferredName || null,
      occupationRole: data.occupationRole || null,
      primaryFocus: data.primaryFocus || null,
      onboardedAt: data.onboardedAt || null,
      ...data,
    };

    const updateSet: Partial<NewUserPersonalization> = {
      ...data,
      updatedAt: new Date(),
    };

    const result = await this.db
      .insert(userPersonalization)
      .values(insertValues)
      .onConflictDoUpdate({
        target: userPersonalization.userId,
        set: updateSet,
      })
      .returning();

    if (!result[0]) {
      throw new Error('Failed to upsert user personalization');
    }
    return result[0];
  }
}
