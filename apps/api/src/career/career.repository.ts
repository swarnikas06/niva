import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import {
  CareerProfile,
  NewCareerProfile,
  CareerTargetRole,
  NewCareerTargetRole,
  CareerSkill,
  NewCareerSkill,
  TargetRoleSkill,
  NewTargetRoleSkill,
  UserSkill,
  NewUserSkill,
  SkillEvidence,
  NewSkillEvidence,
  CareerPreparationActivity,
  NewCareerPreparationActivity,
  CareerGapAnalysis,
  NewCareerGapAnalysis,
  CareerEvaluationSession,
  NewCareerEvaluationSession,
  CareerEvaluationQuestion,
  NewCareerEvaluationQuestion,
  CareerEvaluationAnswer,
  NewCareerEvaluationAnswer,
} from '../database/schema';

@Injectable()
export class CareerRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ==========================================
  // CAREER PROFILES
  // ==========================================
  async findProfileByUserId(userId: string): Promise<CareerProfile | null> {
    const rows = await this.db
      .select()
      .from(schema.careerProfiles)
      .where(eq(schema.careerProfiles.userId, userId))
      .limit(1);
    return rows[0] || null;
  }

  async createProfile(data: NewCareerProfile): Promise<CareerProfile> {
    const rows = await this.db
      .insert(schema.careerProfiles)
      .values(data)
      .returning();
    return rows[0] as CareerProfile;
  }

  async updateProfile(
    userId: string,
    data: Partial<NewCareerProfile>,
  ): Promise<CareerProfile | null> {
    const rows = await this.db
      .update(schema.careerProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.careerProfiles.userId, userId))
      .returning();
    return rows[0] || null;
  }

  // ==========================================
  // TARGET ROLES
  // ==========================================
  async listTargetRoles(userId: string, activeOnly = false): Promise<CareerTargetRole[]> {
    const conditions = [eq(schema.careerTargetRoles.userId, userId)];
    if (activeOnly) {
      conditions.push(eq(schema.careerTargetRoles.isActive, true));
    }
    return this.db
      .select()
      .from(schema.careerTargetRoles)
      .where(and(...conditions))
      .orderBy(
        // prioritize 'primary' first
        sql`CASE WHEN ${schema.careerTargetRoles.priority} = 'primary' THEN 1 WHEN ${schema.careerTargetRoles.priority} = 'secondary' THEN 2 ELSE 3 END`,
        desc(schema.careerTargetRoles.updatedAt),
      );
  }

  async findTargetRoleById(id: string, userId: string): Promise<CareerTargetRole | null> {
    const rows = await this.db
      .select()
      .from(schema.careerTargetRoles)
      .where(
        and(
          eq(schema.careerTargetRoles.id, id),
          eq(schema.careerTargetRoles.userId, userId),
        ),
      )
      .limit(1);
    return rows[0] || null;
  }

  async findPrimaryTargetRole(userId: string): Promise<CareerTargetRole | null> {
    const rows = await this.db
      .select()
      .from(schema.careerTargetRoles)
      .where(
        and(
          eq(schema.careerTargetRoles.userId, userId),
          eq(schema.careerTargetRoles.isActive, true),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${schema.careerTargetRoles.priority} = 'primary' THEN 1 ELSE 2 END`,
        desc(schema.careerTargetRoles.updatedAt),
      )
      .limit(1);
    return rows[0] || null;
  }

  async createTargetRole(data: NewCareerTargetRole): Promise<CareerTargetRole> {
    const rows = await this.db
      .insert(schema.careerTargetRoles)
      .values(data)
      .returning();
    return rows[0] as CareerTargetRole;
  }

  async updateTargetRole(
    id: string,
    userId: string,
    data: Partial<NewCareerTargetRole>,
  ): Promise<CareerTargetRole | null> {
    const rows = await this.db
      .update(schema.careerTargetRoles)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.careerTargetRoles.id, id),
          eq(schema.careerTargetRoles.userId, userId),
        ),
      )
      .returning();
    return rows[0] || null;
  }

  async deleteTargetRole(id: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .delete(schema.careerTargetRoles)
      .where(
        and(
          eq(schema.careerTargetRoles.id, id),
          eq(schema.careerTargetRoles.userId, userId),
        ),
      )
      .returning();
    return rows.length > 0;
  }

  // ==========================================
  // CANONICAL SKILLS & TAXONOMY
  // ==========================================
  async findSkillById(id: string): Promise<CareerSkill | null> {
    const rows = await this.db
      .select()
      .from(schema.careerSkills)
      .where(eq(schema.careerSkills.id, id))
      .limit(1);
    return rows[0] || null;
  }

  async findSkillByName(name: string): Promise<CareerSkill | null> {
    const rows = await this.db
      .select()
      .from(schema.careerSkills)
      .where(sql`LOWER(${schema.careerSkills.name}) = LOWER(${name})`)
      .limit(1);
    return rows[0] || null;
  }

  async createSkill(data: NewCareerSkill): Promise<CareerSkill> {
    const rows = await this.db
      .insert(schema.careerSkills)
      .values(data)
      .returning();
    return rows[0] as CareerSkill;
  }

  async listSkills(category?: string): Promise<CareerSkill[]> {
    if (category) {
      return this.db
        .select()
        .from(schema.careerSkills)
        .where(eq(schema.careerSkills.category, category))
        .orderBy(asc(schema.careerSkills.name));
    }
    return this.db
      .select()
      .from(schema.careerSkills)
      .orderBy(asc(schema.careerSkills.name));
  }

  // ==========================================
  // TARGET ROLE REQUIRED SKILLS
  // ==========================================
  async listRoleSkills(
    targetRoleId: string,
  ): Promise<Array<TargetRoleSkill & { skill: CareerSkill }>> {
    const rows = await this.db
      .select({
        id: schema.targetRoleSkills.id,
        targetRoleId: schema.targetRoleSkills.targetRoleId,
        skillId: schema.targetRoleSkills.skillId,
        importance: schema.targetRoleSkills.importance,
        minimumProficiency: schema.targetRoleSkills.minimumProficiency,
        createdAt: schema.targetRoleSkills.createdAt,
        skill: schema.careerSkills,
      })
      .from(schema.targetRoleSkills)
      .innerJoin(
        schema.careerSkills,
        eq(schema.targetRoleSkills.skillId, schema.careerSkills.id),
      )
      .where(eq(schema.targetRoleSkills.targetRoleId, targetRoleId))
      .orderBy(
        sql`CASE WHEN ${schema.targetRoleSkills.importance} = 'mandatory' THEN 1 WHEN ${schema.targetRoleSkills.importance} = 'high_priority' THEN 2 ELSE 3 END`,
      );
    return rows as Array<TargetRoleSkill & { skill: CareerSkill }>;
  }

  async linkRoleSkill(data: NewTargetRoleSkill): Promise<TargetRoleSkill> {
    const rows = await this.db
      .insert(schema.targetRoleSkills)
      .values(data)
      .onConflictDoUpdate({
        target: [schema.targetRoleSkills.targetRoleId, schema.targetRoleSkills.skillId],
        set: {
          importance: data.importance,
          minimumProficiency: data.minimumProficiency,
        },
      })
      .returning();
    return rows[0] as TargetRoleSkill;
  }

  async unlinkRoleSkill(targetRoleId: string, skillId: string): Promise<boolean> {
    const rows = await this.db
      .delete(schema.targetRoleSkills)
      .where(
        and(
          eq(schema.targetRoleSkills.targetRoleId, targetRoleId),
          eq(schema.targetRoleSkills.skillId, skillId),
        ),
      )
      .returning();
    return rows.length > 0;
  }

  // ==========================================
  // USER SKILLS & TANGIBLE EVIDENCE
  // ==========================================
  async listUserSkillsWithEvidence(
    userId: string,
  ): Promise<Array<UserSkill & { skill: CareerSkill; evidence: SkillEvidence[] }>> {
    const userSkillsList = await this.db
      .select({
        userSkill: schema.userSkills,
        skill: schema.careerSkills,
      })
      .from(schema.userSkills)
      .innerJoin(
        schema.careerSkills,
        eq(schema.userSkills.skillId, schema.careerSkills.id),
      )
      .where(eq(schema.userSkills.userId, userId))
      .orderBy(desc(schema.userSkills.updatedAt));

    const evidenceList = await this.db
      .select()
      .from(schema.skillEvidence)
      .where(eq(schema.skillEvidence.userId, userId))
      .orderBy(desc(schema.skillEvidence.createdAt));

    const evidenceBySkillId = new Map<string, SkillEvidence[]>();
    for (const ev of evidenceList) {
      const arr = evidenceBySkillId.get(ev.userSkillId) || [];
      arr.push(ev);
      evidenceBySkillId.set(ev.userSkillId, arr);
    }

    return userSkillsList.map((row) => ({
      ...row.userSkill,
      skill: row.skill,
      evidence: evidenceBySkillId.get(row.userSkill.id) || [],
    }));
  }

  async findUserSkill(userId: string, skillId: string): Promise<UserSkill | null> {
    const rows = await this.db
      .select()
      .from(schema.userSkills)
      .where(
        and(
          eq(schema.userSkills.userId, userId),
          eq(schema.userSkills.skillId, skillId),
        ),
      )
      .limit(1);
    return rows[0] || null;
  }

  async findUserSkillById(id: string, userId: string): Promise<UserSkill | null> {
    const rows = await this.db
      .select()
      .from(schema.userSkills)
      .where(
        and(
          eq(schema.userSkills.id, id),
          eq(schema.userSkills.userId, userId),
        ),
      )
      .limit(1);
    return rows[0] || null;
  }

  async createUserSkill(data: NewUserSkill): Promise<UserSkill> {
    const rows = await this.db
      .insert(schema.userSkills)
      .values(data)
      .onConflictDoUpdate({
        target: [schema.userSkills.userId, schema.userSkills.skillId],
        set: {
          selfRating: data.selfRating,
          confidenceScore: data.confidenceScore,
          lastPracticedAt: data.lastPracticedAt,
          notes: data.notes,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0] as UserSkill;
  }

  async updateUserSkill(
    id: string,
    userId: string,
    data: Partial<NewUserSkill>,
  ): Promise<UserSkill | null> {
    const rows = await this.db
      .update(schema.userSkills)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.userSkills.id, id),
          eq(schema.userSkills.userId, userId),
        ),
      )
      .returning();
    return rows[0] || null;
  }

  async addSkillEvidence(data: NewSkillEvidence): Promise<SkillEvidence> {
    const rows = await this.db
      .insert(schema.skillEvidence)
      .values(data)
      .returning();
    return rows[0] as SkillEvidence;
  }

  async listSkillEvidence(userSkillId: string, userId: string): Promise<SkillEvidence[]> {
    return this.db
      .select()
      .from(schema.skillEvidence)
      .where(
        and(
          eq(schema.skillEvidence.userSkillId, userSkillId),
          eq(schema.skillEvidence.userId, userId),
        ),
      )
      .orderBy(desc(schema.skillEvidence.createdAt));
  }

  // ==========================================
  // PREPARATION ACTIVITIES
  // ==========================================
  async listPreparationActivities(
    userId: string,
    targetRoleId?: string,
  ): Promise<Array<CareerPreparationActivity & { skill?: CareerSkill | null }>> {
    const conditions = [eq(schema.careerPreparationActivities.userId, userId)];
    if (targetRoleId) {
      conditions.push(eq(schema.careerPreparationActivities.targetRoleId, targetRoleId));
    }

    const rows = await this.db
      .select({
        activity: schema.careerPreparationActivities,
        skill: schema.careerSkills,
      })
      .from(schema.careerPreparationActivities)
      .leftJoin(
        schema.careerSkills,
        eq(schema.careerPreparationActivities.skillId, schema.careerSkills.id),
      )
      .where(and(...conditions))
      .orderBy(desc(schema.careerPreparationActivities.createdAt));

    return rows.map((r) => ({
      ...r.activity,
      skill: r.skill,
    }));
  }

  async findPreparationActivityById(
    id: string,
    userId: string,
  ): Promise<CareerPreparationActivity | null> {
    const rows = await this.db
      .select()
      .from(schema.careerPreparationActivities)
      .where(
        and(
          eq(schema.careerPreparationActivities.id, id),
          eq(schema.careerPreparationActivities.userId, userId),
        ),
      )
      .limit(1);
    return rows[0] || null;
  }

  async createPreparationActivity(
    data: NewCareerPreparationActivity,
  ): Promise<CareerPreparationActivity> {
    const rows = await this.db
      .insert(schema.careerPreparationActivities)
      .values(data)
      .returning();
    return rows[0] as CareerPreparationActivity;
  }

  async updatePreparationActivity(
    id: string,
    userId: string,
    data: Partial<NewCareerPreparationActivity>,
  ): Promise<CareerPreparationActivity | null> {
    const rows = await this.db
      .update(schema.careerPreparationActivities)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.careerPreparationActivities.id, id),
          eq(schema.careerPreparationActivities.userId, userId),
        ),
      )
      .returning();
    return rows[0] || null;
  }

  // ==========================================
  // GAP ANALYSES
  // ==========================================
  async findLatestGapAnalysis(
    userId: string,
    targetRoleId?: string,
  ): Promise<CareerGapAnalysis | null> {
    const conditions = [eq(schema.careerGapAnalyses.userId, userId)];
    if (targetRoleId) {
      conditions.push(eq(schema.careerGapAnalyses.targetRoleId, targetRoleId));
    }

    const rows = await this.db
      .select()
      .from(schema.careerGapAnalyses)
      .where(and(...conditions))
      .orderBy(desc(schema.careerGapAnalyses.computedAt))
      .limit(1);
    return rows[0] || null;
  }

  async saveGapAnalysis(data: NewCareerGapAnalysis): Promise<CareerGapAnalysis> {
    const rows = await this.db
      .insert(schema.careerGapAnalyses)
      .values(data)
      .returning();
    return rows[0] as CareerGapAnalysis;
  }

  // ==========================================
  // EVALUATION SESSIONS & MOCK INTERVIEWS
  // ==========================================
  async createEvaluationSession(
    data: NewCareerEvaluationSession,
  ): Promise<CareerEvaluationSession> {
    const rows = await this.db
      .insert(schema.careerEvaluationSessions)
      .values(data)
      .returning();
    return rows[0] as CareerEvaluationSession;
  }

  async findEvaluationSessionById(
    id: string,
    userId: string,
  ): Promise<CareerEvaluationSession | null> {
    const rows = await this.db
      .select()
      .from(schema.careerEvaluationSessions)
      .where(
        and(
          eq(schema.careerEvaluationSessions.id, id),
          eq(schema.careerEvaluationSessions.userId, userId),
        ),
      )
      .limit(1);
    return rows[0] || null;
  }

  async findActiveEvaluationSession(
    userId: string,
  ): Promise<CareerEvaluationSession | null> {
    const rows = await this.db
      .select()
      .from(schema.careerEvaluationSessions)
      .where(
        and(
          eq(schema.careerEvaluationSessions.userId, userId),
          eq(schema.careerEvaluationSessions.status, 'in_progress'),
        ),
      )
      .orderBy(desc(schema.careerEvaluationSessions.createdAt))
      .limit(1);
    return rows[0] || null;
  }

  async listEvaluationSessions(
    userId: string,
    limit = 20,
  ): Promise<Array<CareerEvaluationSession & { targetRole?: CareerTargetRole | null; skill?: CareerSkill | null }>> {
    const rows = await this.db
      .select({
        session: schema.careerEvaluationSessions,
        targetRole: schema.careerTargetRoles,
        skill: schema.careerSkills,
      })
      .from(schema.careerEvaluationSessions)
      .innerJoin(
        schema.careerTargetRoles,
        eq(schema.careerEvaluationSessions.targetRoleId, schema.careerTargetRoles.id),
      )
      .leftJoin(
        schema.careerSkills,
        eq(schema.careerEvaluationSessions.skillId, schema.careerSkills.id),
      )
      .where(eq(schema.careerEvaluationSessions.userId, userId))
      .orderBy(desc(schema.careerEvaluationSessions.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r.session,
      targetRole: r.targetRole,
      skill: r.skill,
    }));
  }

  async updateEvaluationSession(
    id: string,
    userId: string,
    data: Partial<NewCareerEvaluationSession>,
  ): Promise<CareerEvaluationSession | null> {
    const rows = await this.db
      .update(schema.careerEvaluationSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.careerEvaluationSessions.id, id),
          eq(schema.careerEvaluationSessions.userId, userId),
        ),
      )
      .returning();
    return rows[0] || null;
  }

  // ==========================================
  // EVALUATION QUESTIONS & ANSWERS
  // ==========================================
  async createEvaluationQuestion(
    data: NewCareerEvaluationQuestion,
  ): Promise<CareerEvaluationQuestion> {
    const rows = await this.db
      .insert(schema.careerEvaluationQuestions)
      .values(data)
      .returning();
    return rows[0] as CareerEvaluationQuestion;
  }

  async findEvaluationQuestions(sessionId: string): Promise<CareerEvaluationQuestion[]> {
    return this.db
      .select()
      .from(schema.careerEvaluationQuestions)
      .where(eq(schema.careerEvaluationQuestions.sessionId, sessionId))
      .orderBy(asc(schema.careerEvaluationQuestions.sequenceNumber));
  }

  async createEvaluationAnswer(
    data: NewCareerEvaluationAnswer,
  ): Promise<CareerEvaluationAnswer> {
    const rows = await this.db
      .insert(schema.careerEvaluationAnswers)
      .values(data)
      .returning();
    return rows[0] as CareerEvaluationAnswer;
  }

  async findEvaluationAnswers(sessionId: string): Promise<CareerEvaluationAnswer[]> {
    return this.db
      .select()
      .from(schema.careerEvaluationAnswers)
      .where(eq(schema.careerEvaluationAnswers.sessionId, sessionId))
      .orderBy(asc(schema.careerEvaluationAnswers.createdAt));
  }

  async findEvaluationAnswerByQuestionId(questionId: string): Promise<CareerEvaluationAnswer | null> {
    const rows = await this.db
      .select()
      .from(schema.careerEvaluationAnswers)
      .where(eq(schema.careerEvaluationAnswers.questionId, questionId))
      .limit(1);
    return rows[0] || null;
  }

  async updateEvaluationAnswer(
    id: string,
    data: Partial<NewCareerEvaluationAnswer>,
  ): Promise<CareerEvaluationAnswer | null> {
    const rows = await this.db
      .update(schema.careerEvaluationAnswers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.careerEvaluationAnswers.id, id))
      .returning();
    return rows[0] || null;
  }

  async findFullSessionDetails(sessionId: string, userId: string) {
    const session = await this.findEvaluationSessionById(sessionId, userId);
    if (!session) return null;

    const targetRole = await this.findTargetRoleById(session.targetRoleId, userId);
    const skill = session.skillId ? await this.findSkillById(session.skillId) : null;
    const questions = await this.findEvaluationQuestions(sessionId);
    const answers = await this.findEvaluationAnswers(sessionId);

    const answerMap = new Map<string, CareerEvaluationAnswer>();
    for (const a of answers) {
      answerMap.set(a.questionId, a);
    }

    const questionsWithAnswers = questions.map((q) => ({
      ...q,
      answer: answerMap.get(q.id) || null,
    }));

    return {
      session,
      targetRole,
      skill,
      questions: questionsWithAnswers,
    };
  }
}
