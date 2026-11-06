import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, asc, lte, gte } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import {
  LifeGoal,
  NewLifeGoal,
  LifeProject,
  NewLifeProject,
  LifeTask,
  NewLifeTask,
  LifeCommitment,
  NewLifeCommitment,
  LifeIdea,
  NewLifeIdea,
} from '../database/schema';

@Injectable()
export class LifeContextRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ==========================================
  // GOALS
  // ==========================================
  async findGoals(
    userId: string,
    filter?: { status?: string; category?: string },
  ): Promise<LifeGoal[]> {
    const conditions = [eq(schema.lifeGoals.userId, userId)];

    if (filter?.status) {
      conditions.push(eq(schema.lifeGoals.status, filter.status));
    }
    if (filter?.category) {
      conditions.push(eq(schema.lifeGoals.category, filter.category));
    }

    return this.db
      .select()
      .from(schema.lifeGoals)
      .where(and(...conditions))
      .orderBy(desc(schema.lifeGoals.updatedAt));
  }

  async findGoalById(id: string, userId: string): Promise<LifeGoal | null> {
    const rows = await this.db
      .select()
      .from(schema.lifeGoals)
      .where(and(eq(schema.lifeGoals.id, id), eq(schema.lifeGoals.userId, userId)))
      .limit(1);
    return rows[0] || null;
  }

  async createGoal(data: NewLifeGoal): Promise<LifeGoal> {
    const rows = await this.db
      .insert(schema.lifeGoals)
      .values(data)
      .returning();
    return rows[0]!;
  }

  async updateGoal(
    id: string,
    userId: string,
    data: Partial<NewLifeGoal>,
  ): Promise<LifeGoal | null> {
    const rows = await this.db
      .update(schema.lifeGoals)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.lifeGoals.id, id), eq(schema.lifeGoals.userId, userId)))
      .returning();
    return rows[0] || null;
  }

  async deleteGoal(id: string, userId: string): Promise<boolean> {
    const res = await this.db
      .delete(schema.lifeGoals)
      .where(and(eq(schema.lifeGoals.id, id), eq(schema.lifeGoals.userId, userId)))
      .returning({ id: schema.lifeGoals.id });
    return res.length > 0;
  }

  // ==========================================
  // PROJECTS
  // ==========================================
  async findProjects(
    userId: string,
    filter?: { goalId?: string; status?: string },
  ): Promise<LifeProject[]> {
    const conditions = [eq(schema.lifeProjects.userId, userId)];

    if (filter?.goalId) {
      conditions.push(eq(schema.lifeProjects.goalId, filter.goalId));
    }
    if (filter?.status) {
      conditions.push(eq(schema.lifeProjects.status, filter.status));
    }

    return this.db
      .select()
      .from(schema.lifeProjects)
      .where(and(...conditions))
      .orderBy(desc(schema.lifeProjects.updatedAt));
  }

  async findProjectById(id: string, userId: string): Promise<LifeProject | null> {
    const rows = await this.db
      .select()
      .from(schema.lifeProjects)
      .where(and(eq(schema.lifeProjects.id, id), eq(schema.lifeProjects.userId, userId)))
      .limit(1);
    return rows[0] || null;
  }

  async createProject(data: NewLifeProject): Promise<LifeProject> {
    const rows = await this.db
      .insert(schema.lifeProjects)
      .values(data)
      .returning();
    return rows[0]!;
  }

  async updateProject(
    id: string,
    userId: string,
    data: Partial<NewLifeProject>,
  ): Promise<LifeProject | null> {
    const rows = await this.db
      .update(schema.lifeProjects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.lifeProjects.id, id), eq(schema.lifeProjects.userId, userId)))
      .returning();
    return rows[0] || null;
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    const res = await this.db
      .delete(schema.lifeProjects)
      .where(and(eq(schema.lifeProjects.id, id), eq(schema.lifeProjects.userId, userId)))
      .returning({ id: schema.lifeProjects.id });
    return res.length > 0;
  }

  // ==========================================
  // TASKS
  // ==========================================
  async findTasks(
    userId: string,
    filter?: { projectId?: string; status?: string; priority?: string },
  ): Promise<LifeTask[]> {
    const conditions = [eq(schema.lifeTasks.userId, userId)];

    if (filter?.projectId) {
      conditions.push(eq(schema.lifeTasks.projectId, filter.projectId));
    }
    if (filter?.status) {
      conditions.push(eq(schema.lifeTasks.status, filter.status));
    }
    if (filter?.priority) {
      conditions.push(eq(schema.lifeTasks.priority, filter.priority));
    }

    return this.db
      .select()
      .from(schema.lifeTasks)
      .where(and(...conditions))
      .orderBy(asc(schema.lifeTasks.orderIndex), desc(schema.lifeTasks.updatedAt));
  }

  async findTaskById(id: string, userId: string): Promise<LifeTask | null> {
    const rows = await this.db
      .select()
      .from(schema.lifeTasks)
      .where(and(eq(schema.lifeTasks.id, id), eq(schema.lifeTasks.userId, userId)))
      .limit(1);
    return rows[0] || null;
  }

  async createTask(data: NewLifeTask): Promise<LifeTask> {
    const rows = await this.db
      .insert(schema.lifeTasks)
      .values(data)
      .returning();
    return rows[0]!;
  }

  async updateTask(
    id: string,
    userId: string,
    data: Partial<NewLifeTask>,
  ): Promise<LifeTask | null> {
    const rows = await this.db
      .update(schema.lifeTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.lifeTasks.id, id), eq(schema.lifeTasks.userId, userId)))
      .returning();
    return rows[0] || null;
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    const res = await this.db
      .delete(schema.lifeTasks)
      .where(and(eq(schema.lifeTasks.id, id), eq(schema.lifeTasks.userId, userId)))
      .returning({ id: schema.lifeTasks.id });
    return res.length > 0;
  }

  // ==========================================
  // COMMITMENTS
  // ==========================================
  async findCommitments(
    userId: string,
    filter?: { status?: string; from?: Date; to?: Date },
  ): Promise<LifeCommitment[]> {
    const conditions = [eq(schema.lifeCommitments.userId, userId)];

    if (filter?.status) {
      conditions.push(eq(schema.lifeCommitments.status, filter.status));
    }
    if (filter?.from) {
      conditions.push(gte(schema.lifeCommitments.dueAt, filter.from));
    }
    if (filter?.to) {
      conditions.push(lte(schema.lifeCommitments.dueAt, filter.to));
    }

    return this.db
      .select()
      .from(schema.lifeCommitments)
      .where(and(...conditions))
      .orderBy(asc(schema.lifeCommitments.dueAt));
  }

  async findCommitmentById(id: string, userId: string): Promise<LifeCommitment | null> {
    const rows = await this.db
      .select()
      .from(schema.lifeCommitments)
      .where(and(eq(schema.lifeCommitments.id, id), eq(schema.lifeCommitments.userId, userId)))
      .limit(1);
    return rows[0] || null;
  }

  async createCommitment(data: NewLifeCommitment): Promise<LifeCommitment> {
    const rows = await this.db
      .insert(schema.lifeCommitments)
      .values(data)
      .returning();
    return rows[0]!;
  }

  async updateCommitment(
    id: string,
    userId: string,
    data: Partial<NewLifeCommitment>,
  ): Promise<LifeCommitment | null> {
    const rows = await this.db
      .update(schema.lifeCommitments)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.lifeCommitments.id, id), eq(schema.lifeCommitments.userId, userId)))
      .returning();
    return rows[0] || null;
  }

  async deleteCommitment(id: string, userId: string): Promise<boolean> {
    const res = await this.db
      .delete(schema.lifeCommitments)
      .where(and(eq(schema.lifeCommitments.id, id), eq(schema.lifeCommitments.userId, userId)))
      .returning({ id: schema.lifeCommitments.id });
    return res.length > 0;
  }

  // ==========================================
  // IDEAS
  // ==========================================
  async findIdeas(
    userId: string,
    filter?: { status?: string },
  ): Promise<LifeIdea[]> {
    const conditions = [eq(schema.lifeIdeas.userId, userId)];

    if (filter?.status) {
      conditions.push(eq(schema.lifeIdeas.status, filter.status));
    }

    return this.db
      .select()
      .from(schema.lifeIdeas)
      .where(and(...conditions))
      .orderBy(desc(schema.lifeIdeas.updatedAt));
  }

  async findIdeaById(id: string, userId: string): Promise<LifeIdea | null> {
    const rows = await this.db
      .select()
      .from(schema.lifeIdeas)
      .where(and(eq(schema.lifeIdeas.id, id), eq(schema.lifeIdeas.userId, userId)))
      .limit(1);
    return rows[0] || null;
  }

  async createIdea(data: NewLifeIdea): Promise<LifeIdea> {
    const rows = await this.db
      .insert(schema.lifeIdeas)
      .values(data)
      .returning();
    return rows[0]!;
  }

  async updateIdea(
    id: string,
    userId: string,
    data: Partial<NewLifeIdea>,
  ): Promise<LifeIdea | null> {
    const rows = await this.db
      .update(schema.lifeIdeas)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.lifeIdeas.id, id), eq(schema.lifeIdeas.userId, userId)))
      .returning();
    return rows[0] || null;
  }

  async deleteIdea(id: string, userId: string): Promise<boolean> {
    const res = await this.db
      .delete(schema.lifeIdeas)
      .where(and(eq(schema.lifeIdeas.id, id), eq(schema.lifeIdeas.userId, userId)))
      .returning({ id: schema.lifeIdeas.id });
    return res.length > 0;
  }
}
