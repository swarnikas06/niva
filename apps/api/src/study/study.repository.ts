import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import {
  studyTopics,
  studySessions,
  learningDifficulties,
  careerSkills,
  lifeGoals,
  StudyTopic,
  NewStudyTopic,
  StudySession,
  NewStudySession,
  LearningDifficulty,
  NewLearningDifficulty,
} from '../database/schema';

@Injectable()
export class StudyRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ==========================================
  // TOPICS
  // ==========================================

  async findTopics(
    userId: string,
    filters?: { subjectName?: string; status?: string },
  ): Promise<
    Array<
      StudyTopic & {
        linkedSkillName: string | null;
        linkedGoalTitle: string | null;
      }
    >
  > {
    const conditions = [eq(studyTopics.userId, userId)];
    if (filters?.subjectName) {
      conditions.push(eq(studyTopics.subjectName, filters.subjectName));
    }
    if (filters?.status) {
      conditions.push(eq(studyTopics.status, filters.status));
    }

    const rows = await this.db
      .select({
        topic: studyTopics,
        linkedSkillName: careerSkills.name,
        linkedGoalTitle: lifeGoals.title,
      })
      .from(studyTopics)
      .leftJoin(careerSkills, eq(studyTopics.linkedSkillId, careerSkills.id))
      .leftJoin(lifeGoals, eq(studyTopics.linkedGoalId, lifeGoals.id))
      .where(and(...conditions))
      .orderBy(asc(studyTopics.subjectName), desc(studyTopics.updatedAt));

    return rows.map((r) => ({
      ...r.topic,
      linkedSkillName: r.linkedSkillName ?? null,
      linkedGoalTitle: r.linkedGoalTitle ?? null,
    }));
  }

  async findTopicById(
    id: string,
    userId: string,
  ): Promise<
    | (StudyTopic & {
        linkedSkillName: string | null;
        linkedGoalTitle: string | null;
      })
    | null
  > {
    const rows = await this.db
      .select({
        topic: studyTopics,
        linkedSkillName: careerSkills.name,
        linkedGoalTitle: lifeGoals.title,
      })
      .from(studyTopics)
      .leftJoin(careerSkills, eq(studyTopics.linkedSkillId, careerSkills.id))
      .leftJoin(lifeGoals, eq(studyTopics.linkedGoalId, lifeGoals.id))
      .where(and(eq(studyTopics.id, id), eq(studyTopics.userId, userId)))
      .limit(1);

    if (!rows[0]) return null;
    return {
      ...rows[0].topic,
      linkedSkillName: rows[0].linkedSkillName ?? null,
      linkedGoalTitle: rows[0].linkedGoalTitle ?? null,
    };
  }

  async findTopicsByIds(
    ids: string[],
    userId: string,
  ): Promise<StudyTopic[]> {
    if (!ids || ids.length === 0) return [];
    return this.db
      .select()
      .from(studyTopics)
      .where(and(inArray(studyTopics.id, ids), eq(studyTopics.userId, userId)));
  }

  async createTopic(data: NewStudyTopic): Promise<StudyTopic> {
    const [created] = await this.db.insert(studyTopics).values(data).returning();
    if (!created) throw new Error('Failed to insert study topic');
    return created;
  }

  async updateTopic(
    id: string,
    userId: string,
    data: Partial<NewStudyTopic>,
  ): Promise<StudyTopic | null> {
    const [updated] = await this.db
      .update(studyTopics)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(studyTopics.id, id), eq(studyTopics.userId, userId)))
      .returning();
    return updated || null;
  }

  async deleteTopic(id: string, userId: string): Promise<boolean> {
    const res = await this.db
      .delete(studyTopics)
      .where(and(eq(studyTopics.id, id), eq(studyTopics.userId, userId)))
      .returning({ id: studyTopics.id });
    return res.length > 0;
  }

  async countTopics(
    userId: string,
  ): Promise<{
    total: number;
    inProgress: number;
    demonstrated: number;
    needsReview: number;
  }> {
    const all = await this.db
      .select({ status: studyTopics.status })
      .from(studyTopics)
      .where(eq(studyTopics.userId, userId));

    return {
      total: all.length,
      inProgress: all.filter((t) => t.status === 'in_progress').length,
      demonstrated: all.filter((t) => t.status === 'demonstrated').length,
      needsReview: all.filter((t) => t.status === 'needs_review').length,
    };
  }

  // ==========================================
  // SESSIONS
  // ==========================================

  async findSessions(
    userId: string,
    topicId?: string,
    limit = 50,
  ): Promise<
    Array<
      StudySession & {
        topicTitle: string;
        subjectName: string;
      }
    >
  > {
    const conditions = [eq(studySessions.userId, userId)];
    if (topicId) {
      conditions.push(eq(studySessions.topicId, topicId));
    }

    const rows = await this.db
      .select({
        session: studySessions,
        topicTitle: studyTopics.title,
        subjectName: studyTopics.subjectName,
      })
      .from(studySessions)
      .innerJoin(studyTopics, eq(studySessions.topicId, studyTopics.id))
      .where(and(...conditions))
      .orderBy(desc(studySessions.startedAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r.session,
      topicTitle: r.topicTitle,
      subjectName: r.subjectName,
    }));
  }

  async findSessionById(
    id: string,
    userId: string,
  ): Promise<
    | (StudySession & {
        topicTitle: string;
        subjectName: string;
      })
    | null
  > {
    const rows = await this.db
      .select({
        session: studySessions,
        topicTitle: studyTopics.title,
        subjectName: studyTopics.subjectName,
      })
      .from(studySessions)
      .innerJoin(studyTopics, eq(studySessions.topicId, studyTopics.id))
      .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
      .limit(1);

    if (!rows[0]) return null;
    return {
      ...rows[0].session,
      topicTitle: rows[0].topicTitle,
      subjectName: rows[0].subjectName,
    };
  }

  async findActiveSession(
    userId: string,
  ): Promise<
    | (StudySession & {
        topicTitle: string;
        subjectName: string;
      })
    | null
  > {
    const rows = await this.db
      .select({
        session: studySessions,
        topicTitle: studyTopics.title,
        subjectName: studyTopics.subjectName,
      })
      .from(studySessions)
      .innerJoin(studyTopics, eq(studySessions.topicId, studyTopics.id))
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.status, 'in_progress'),
        ),
      )
      .orderBy(desc(studySessions.startedAt))
      .limit(1);

    if (!rows[0]) return null;
    return {
      ...rows[0].session,
      topicTitle: rows[0].topicTitle,
      subjectName: rows[0].subjectName,
    };
  }

  async createSession(data: NewStudySession): Promise<StudySession> {
    const [created] = await this.db
      .insert(studySessions)
      .values(data)
      .returning();
    if (!created) throw new Error('Failed to insert study session');
    return created;
  }

  async updateSession(
    id: string,
    userId: string,
    data: Partial<NewStudySession>,
  ): Promise<StudySession | null> {
    const [updated] = await this.db
      .update(studySessions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
      .returning();
    return updated || null;
  }

  async sumStudyMinutes(userId: string): Promise<number> {
    const [res] = await this.db
      .select({
        total: sql<string>`coalesce(sum(${studySessions.durationMinutes}), 0)`,
      })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.status, 'completed'),
        ),
      );

    return Number(res?.total || 0);
  }

  // ==========================================
  // DIFFICULTIES
  // ==========================================

  async findDifficulties(
    userId: string,
    filters?: { topicId?: string; status?: string },
  ): Promise<
    Array<
      LearningDifficulty & {
        topicTitle: string;
        subjectName: string;
      }
    >
  > {
    const conditions = [eq(learningDifficulties.userId, userId)];
    if (filters?.topicId) {
      conditions.push(eq(learningDifficulties.topicId, filters.topicId));
    }
    if (filters?.status) {
      conditions.push(eq(learningDifficulties.status, filters.status));
    }

    const rows = await this.db
      .select({
        difficulty: learningDifficulties,
        topicTitle: studyTopics.title,
        subjectName: studyTopics.subjectName,
      })
      .from(learningDifficulties)
      .innerJoin(studyTopics, eq(learningDifficulties.topicId, studyTopics.id))
      .where(and(...conditions))
      .orderBy(desc(learningDifficulties.createdAt));

    return rows.map((r) => ({
      ...r.difficulty,
      topicTitle: r.topicTitle,
      subjectName: r.subjectName,
    }));
  }

  async findDifficultyById(
    id: string,
    userId: string,
  ): Promise<
    | (LearningDifficulty & {
        topicTitle: string;
        subjectName: string;
      })
    | null
  > {
    const rows = await this.db
      .select({
        difficulty: learningDifficulties,
        topicTitle: studyTopics.title,
        subjectName: studyTopics.subjectName,
      })
      .from(learningDifficulties)
      .innerJoin(studyTopics, eq(learningDifficulties.topicId, studyTopics.id))
      .where(
        and(
          eq(learningDifficulties.id, id),
          eq(learningDifficulties.userId, userId),
        ),
      )
      .limit(1);

    if (!rows[0]) return null;
    return {
      ...rows[0].difficulty,
      topicTitle: rows[0].topicTitle,
      subjectName: rows[0].subjectName,
    };
  }

  async createDifficulty(
    data: NewLearningDifficulty,
  ): Promise<LearningDifficulty> {
    const [created] = await this.db
      .insert(learningDifficulties)
      .values(data)
      .returning();
    if (!created) throw new Error('Failed to insert learning difficulty');
    return created;
  }

  async updateDifficulty(
    id: string,
    userId: string,
    data: Partial<NewLearningDifficulty>,
  ): Promise<LearningDifficulty | null> {
    const [updated] = await this.db
      .update(learningDifficulties)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(learningDifficulties.id, id),
          eq(learningDifficulties.userId, userId),
        ),
      )
      .returning();
    return updated || null;
  }

  async countActiveDifficulties(userId: string): Promise<number> {
    const [res] = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(learningDifficulties)
      .where(
        and(
          eq(learningDifficulties.userId, userId),
          eq(learningDifficulties.status, 'active'),
        ),
      );
    return Number(res?.count || 0);
  }
}
