import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import { lifeGoals, lifeProjects, userPersonalization } from '../database/schema';
import { CompanionStateRepository } from './companion-state.repository';
import { UpdateCompanionStateDto } from './dto/companion-state.dto';
import { CompanionStateDto } from '@niva/shared-types';

@Injectable()
export class CompanionStateService {
  constructor(
    private readonly repository: CompanionStateRepository,
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getCompanionState(userId: string): Promise<CompanionStateDto> {
    // 1. Fetch user's selected archetype from personalization if available
    const [pers] = await this.db
      .select({ selectedArchetypeId: userPersonalization.selectedArchetypeId })
      .from(userPersonalization)
      .where(eq(userPersonalization.userId, userId))
      .limit(1);

    const defaultArchetypeId = pers?.selectedArchetypeId || 'niva_anchor';
    return this.repository.findOrCreate(userId, defaultArchetypeId);
  }

  async updateCompanionState(
    userId: string,
    dto: UpdateCompanionStateDto,
  ): Promise<CompanionStateDto> {
    // Ensure state exists
    const current = await this.getCompanionState(userId);

    // Validate activeFocusGoalId ownership if provided
    let targetGoalId = current.activeFocusGoalId;
    if (dto.activeFocusGoalId !== undefined) {
      if (dto.activeFocusGoalId !== null) {
        const [goal] = await this.db
          .select({ id: lifeGoals.id })
          .from(lifeGoals)
          .where(and(eq(lifeGoals.id, dto.activeFocusGoalId), eq(lifeGoals.userId, userId)))
          .limit(1);

        if (!goal) {
          throw new NotFoundException(`Goal ${dto.activeFocusGoalId} not found or access denied`);
        }
        targetGoalId = goal.id;
      } else {
        targetGoalId = null;
      }
    }

    // Validate activeFocusProjectId ownership if provided
    let targetProjectId = current.activeFocusProjectId;
    let projectParentGoalId: string | null = null;
    if (dto.activeFocusProjectId !== undefined) {
      if (dto.activeFocusProjectId !== null) {
        const [project] = await this.db
          .select({ id: lifeProjects.id, goalId: lifeProjects.goalId })
          .from(lifeProjects)
          .where(and(eq(lifeProjects.id, dto.activeFocusProjectId), eq(lifeProjects.userId, userId)))
          .limit(1);

        if (!project) {
          throw new NotFoundException(`Project ${dto.activeFocusProjectId} not found or access denied`);
        }
        targetProjectId = project.id;
        projectParentGoalId = project.goalId;
      } else {
        targetProjectId = null;
      }
    } else if (targetProjectId) {
      // Look up parent goal of existing active project
      const [existingProject] = await this.db
        .select({ goalId: lifeProjects.goalId })
        .from(lifeProjects)
        .where(eq(lifeProjects.id, targetProjectId))
        .limit(1);
      projectParentGoalId = existingProject?.goalId || null;
    }

    // Consistency check: If project has a linked goalId and a goal is also selected, verify relationship
    if (targetGoalId && targetProjectId && projectParentGoalId && projectParentGoalId !== targetGoalId) {
      throw new BadRequestException(
        `Active focus project belongs to goal ${projectParentGoalId}, which does not match active focus goal ${targetGoalId}`,
      );
    }

    const updateData: any = {};
    if (dto.presenceStatus !== undefined) updateData.presenceStatus = dto.presenceStatus;
    if (dto.interactionMode !== undefined) updateData.interactionMode = dto.interactionMode;
    if (dto.activeFocusGoalId !== undefined) updateData.activeFocusGoalId = dto.activeFocusGoalId;
    if (dto.activeFocusProjectId !== undefined) updateData.activeFocusProjectId = dto.activeFocusProjectId;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata;

    return this.repository.update(userId, updateData);
  }
}
