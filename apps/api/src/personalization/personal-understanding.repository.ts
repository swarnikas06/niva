import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import { userProfiles, UserProfile, NewUserProfile } from '../database/schema/user-profiles';

@Injectable()
export class PersonalUnderstandingRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const [found] = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    return found || null;
  }

  async upsertProfile(userId: string, data: Partial<NewUserProfile>): Promise<UserProfile> {
    const existing = await this.findByUserId(userId);

    if (existing) {
      const [updated] = await this.db
        .update(userProfiles)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId))
        .returning();

      return updated!;
    }

    const [created] = await this.db
      .insert(userProfiles)
      .values({
        userId,
        education: data.education || {},
        profession: data.profession || {},
        expertiseAreas: data.expertiseAreas || [],
        interests: data.interests || [],
        dailyRoutines: data.dailyRoutines || {},
        communicationPreferences: data.communicationPreferences || {},
        learningPreferences: data.learningPreferences || {},
        ongoingChallenges: data.ongoingChallenges || [],
        importantDates: data.importantDates || [],
        attributeConfidence: data.attributeConfidence || {},
      })
      .returning();

    return created!;
  }
}
