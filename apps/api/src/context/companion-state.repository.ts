import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import {
  companionStates,
  characterArchetypes,
  lifeGoals,
  lifeProjects,
  NewCompanionState,
} from '../database/schema';
import { CompanionStateDto } from '@niva/shared-types';

@Injectable()
export class CompanionStateRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByUserId(userId: string): Promise<CompanionStateDto | null> {
    const rows = await this.db
      .select({
        id: companionStates.id,
        userId: companionStates.userId,
        characterId: companionStates.characterId,
        presenceStatus: companionStates.presenceStatus,
        interactionMode: companionStates.interactionMode,
        activeFocusGoalId: companionStates.activeFocusGoalId,
        activeFocusProjectId: companionStates.activeFocusProjectId,
        continuityStreakDays: companionStates.continuityStreakDays,
        totalInteractions: companionStates.totalInteractions,
        lastInteractionAt: companionStates.lastInteractionAt,
        metadata: companionStates.metadata,
        createdAt: companionStates.createdAt,
        updatedAt: companionStates.updatedAt,
        characterName: characterArchetypes.name,
        characterTagline: characterArchetypes.tagline,
        goalTitle: lifeGoals.title,
        goalProgress: lifeGoals.progressPercentage,
        goalStatus: lifeGoals.status,
        projectTitle: lifeProjects.title,
        projectStatus: lifeProjects.status,
        projectColor: lifeProjects.color,
      })
      .from(companionStates)
      .leftJoin(characterArchetypes, eq(companionStates.characterId, characterArchetypes.id))
      .leftJoin(lifeGoals, eq(companionStates.activeFocusGoalId, lifeGoals.id))
      .leftJoin(lifeProjects, eq(companionStates.activeFocusProjectId, lifeProjects.id))
      .where(eq(companionStates.userId, userId))
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0]!;

    return {
      id: r.id,
      userId: r.userId,
      characterId: r.characterId,
      presenceStatus: r.presenceStatus as any,
      interactionMode: r.interactionMode as any,
      activeFocusGoalId: r.activeFocusGoalId,
      activeFocusProjectId: r.activeFocusProjectId,
      continuityStreakDays: r.continuityStreakDays,
      totalInteractions: r.totalInteractions,
      lastInteractionAt: r.lastInteractionAt.toISOString(),
      metadata: (r.metadata as Record<string, unknown>) || null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      character: r.characterName
        ? {
            id: r.characterId,
            name: r.characterName,
            tagline: r.characterTagline || undefined,
          }
        : undefined,
      activeFocusGoal: r.goalTitle
        ? {
            id: r.activeFocusGoalId!,
            title: r.goalTitle,
            progressPercentage: r.goalProgress ?? 0,
            status: r.goalStatus ?? 'active',
          }
        : null,
      activeFocusProject: r.projectTitle
        ? {
            id: r.activeFocusProjectId!,
            title: r.projectTitle,
            status: r.projectStatus ?? 'in_progress',
            color: r.projectColor,
          }
        : null,
    };
  }

  async findOrCreate(userId: string, defaultArchetypeId: string = 'niva_anchor'): Promise<CompanionStateDto> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;

    // Insert default state
    await this.db
      .insert(companionStates)
      .values({
        userId,
        characterId: defaultArchetypeId,
        presenceStatus: 'active',
        interactionMode: 'chat',
        continuityStreakDays: 1,
        totalInteractions: 0,
        metadata: {},
      })
      .onConflictDoNothing({ target: companionStates.userId });

    const created = await this.findByUserId(userId);
    if (!created) {
      throw new Error(`Failed to initialize companion state for user ${userId}`);
    }
    return created;
  }

  async update(userId: string, data: Partial<NewCompanionState>): Promise<CompanionStateDto> {
    await this.db
      .update(companionStates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(companionStates.userId, userId));

    const updated = await this.findByUserId(userId);
    if (!updated) {
      throw new Error(`Companion state for user ${userId} not found after update`);
    }
    return updated;
  }

  async incrementInteractions(userId: string): Promise<void> {
    await this.db
      .update(companionStates)
      .set({
        totalInteractions: sql`${companionStates.totalInteractions} + 1`,
        lastInteractionAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(companionStates.userId, userId));
  }
}
