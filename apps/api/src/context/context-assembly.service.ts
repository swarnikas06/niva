import {
  Injectable,
  NotFoundException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, asc, inArray, gte, lte, count, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import {
  users,
  userPersonalization,
  characterArchetypes,
  lifeGoals,
  lifeProjects,
  lifeTasks,
  lifeCommitments,
  lifeIdeas,
  conversations,
  conversationMessages,
} from '../database/schema';
import { CompanionStateService } from './companion-state.service';
import { ContextSnapshotRepository } from './context-snapshot.repository';
import { AssembleContextQueryDto } from './dto/context-assembly.dto';
import { MemoryRetrievalService } from '../memory/memory-retrieval.service';
import { CareerIntelligenceService } from '../career/career-intelligence.service';
import {
  ContextFrameDto,
  ContextFrameIdentity,
  ContextFrameCompanion,
  ContextFramePreferences,
  ContextFrameLifeState,
  ContextFrameDialogue,
  ContextFrameTemporal,
  TokenBudgetBreakdown,
  RelevantMemoryDto,
  CareerContextFrameDto,
  StudyContextFrameDto,
  LongitudinalContextFrameDto,
} from '@niva/shared-types';
import { StudyIntelligenceService } from '../study/study-intelligence.service';
import { ReflectionEngineService } from '../reflection/reflection-engine.service';

@Injectable()
export class ContextAssemblyService {
  private readonly logger = new Logger(ContextAssemblyService.name);

  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly companionStateService: CompanionStateService,
    private readonly snapshotRepo: ContextSnapshotRepository,
    private readonly memoryRetrievalService: MemoryRetrievalService,
    @Optional()
    private readonly careerIntelligenceService?: CareerIntelligenceService,
    @Optional()
    private readonly studyIntelligenceService?: StudyIntelligenceService,
    @Optional()
    private readonly reflectionEngineService?: ReflectionEngineService,
  ) {}

  /**
   * Deterministic token estimation heuristic: 4 characters per token (safe approximation).
   */
  private estimateTokens(payload: unknown): number {
    const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return Math.ceil(str.length / 4);
  }

  async assembleContext(
    userId: string,
    query: AssembleContextQueryDto,
  ): Promise<ContextFrameDto> {
    const maxTokens = query.maxTokens || 4000;

    // 1. Fetch User Identity
    const [user] = await this.db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // 2. Fetch Target Conversation Character ID (if specific conversation requested)
    let convCharacterId: string | null = null;
    if (query.conversationId) {
      const [conv] = await this.db
        .select({ characterId: conversations.characterId })
        .from(conversations)
        .where(and(eq(conversations.id, query.conversationId), eq(conversations.userId, userId)))
        .limit(1);
      if (conv?.characterId) {
        convCharacterId = conv.characterId;
      }
    }

    // 3. Fetch User Personalization
    const [pers] = await this.db
      .select()
      .from(userPersonalization)
      .where(eq(userPersonalization.userId, userId))
      .limit(1);

    const archetypeId = convCharacterId || pers?.selectedArchetypeId || 'niva_anchor';

    // 4. Fetch Character Archetype
    const [archetype] = await this.db
      .select()
      .from(characterArchetypes)
      .where(eq(characterArchetypes.id, archetypeId))
      .limit(1);

    // 4. Fetch Companion State
    const companionState = await this.companionStateService.getCompanionState(userId);

    // 5. Fetch Life Context (Bounded & Prioritized)
    // 5a. Active Goals (max 5)
    const goalsList = await this.db
      .select({
        id: lifeGoals.id,
        title: lifeGoals.title,
        category: lifeGoals.category,
        priority: lifeGoals.priority,
        progressPercentage: lifeGoals.progressPercentage,
        targetDate: lifeGoals.targetDate,
      })
      .from(lifeGoals)
      .where(and(eq(lifeGoals.userId, userId), eq(lifeGoals.status, 'active')))
      .orderBy(desc(sql`CASE WHEN ${lifeGoals.priority} = 'high' THEN 1 ELSE 0 END`), desc(lifeGoals.progressPercentage))
      .limit(5);

    // 5b. Active Projects (max 5)
    const projectsList = await this.db
      .select({
        id: lifeProjects.id,
        title: lifeProjects.title,
        goalId: lifeProjects.goalId,
        status: lifeProjects.status,
        color: lifeProjects.color,
        targetDate: lifeProjects.targetDate,
      })
      .from(lifeProjects)
      .where(and(eq(lifeProjects.userId, userId), inArray(lifeProjects.status, ['planning', 'in_progress'])))
      .orderBy(asc(lifeProjects.targetDate))
      .limit(5);

    // 5b-2. Completed Projects (max 3, recently updated)
    const completedProjectsList = await this.db
      .select({
        id: lifeProjects.id,
        title: lifeProjects.title,
        status: lifeProjects.status,
        updatedAt: lifeProjects.updatedAt,
      })
      .from(lifeProjects)
      .where(and(eq(lifeProjects.userId, userId), eq(lifeProjects.status, 'completed')))
      .orderBy(desc(lifeProjects.updatedAt))
      .limit(3);

    // 5c. Relevant Tasks (max 10, open only)
    const tasksList = await this.db
      .select({
        id: lifeTasks.id,
        title: lifeTasks.title,
        projectId: lifeTasks.projectId,
        priority: lifeTasks.priority,
        status: lifeTasks.status,
        dueDate: lifeTasks.dueDate,
      })
      .from(lifeTasks)
      .where(and(eq(lifeTasks.userId, userId), inArray(lifeTasks.status, ['todo', 'in_progress'])))
      .orderBy(
        desc(sql`CASE WHEN ${lifeTasks.priority} = 'urgent' THEN 3 WHEN ${lifeTasks.priority} = 'high' THEN 2 ELSE 1 END`),
        asc(lifeTasks.dueDate),
      )
      .limit(10);

    // 5c-2. Recent Completed Tasks (max 5, recently completed)
    const completedTasksList = await this.db
      .select({
        id: lifeTasks.id,
        title: lifeTasks.title,
        completedAt: lifeTasks.completedAt,
      })
      .from(lifeTasks)
      .where(and(eq(lifeTasks.userId, userId), eq(lifeTasks.status, 'completed')))
      .orderBy(desc(lifeTasks.completedAt))
      .limit(5);

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 5d. Upcoming Commitments (within next 30 days, max 10)
    const commitmentsList = await this.db
      .select({
        id: lifeCommitments.id,
        title: lifeCommitments.title,
        commitmentType: lifeCommitments.commitmentType,
        importance: lifeCommitments.importance,
        dueAt: lifeCommitments.dueAt,
      })
      .from(lifeCommitments)
      .where(
        and(
          eq(lifeCommitments.userId, userId),
          eq(lifeCommitments.status, 'upcoming'),
          gte(lifeCommitments.dueAt, now),
          lte(lifeCommitments.dueAt, thirtyDaysFromNow),
        ),
      )
      .orderBy(asc(lifeCommitments.dueAt))
      .limit(10);

    // 5d-2. Recently Fulfilled Commitments (max 5)
    const fulfilledCommitmentsList = await this.db
      .select({
        id: lifeCommitments.id,
        title: lifeCommitments.title,
        commitmentType: lifeCommitments.commitmentType,
      })
      .from(lifeCommitments)
      .where(and(eq(lifeCommitments.userId, userId), eq(lifeCommitments.status, 'fulfilled')))
      .orderBy(desc(lifeCommitments.updatedAt))
      .limit(5);

    // 5e. Recent Ideas (max 5)
    const ideasList = await this.db
      .select({
        id: lifeIdeas.id,
        title: lifeIdeas.title,
        tags: lifeIdeas.tags,
        status: lifeIdeas.status,
      })
      .from(lifeIdeas)
      .where(and(eq(lifeIdeas.userId, userId), eq(lifeIdeas.status, 'captured')))
      .orderBy(desc(lifeIdeas.createdAt))
      .limit(5);

    // Counts for full awareness
    const [goalCount] = await this.db.select({ count: count() }).from(lifeGoals).where(eq(lifeGoals.userId, userId));
    const [projectCount] = await this.db.select({ count: count() }).from(lifeProjects).where(eq(lifeProjects.userId, userId));
    const [taskCount] = await this.db.select({ count: count() }).from(lifeTasks).where(and(eq(lifeTasks.userId, userId), inArray(lifeTasks.status, ['todo', 'in_progress'])));
    const [commCount] = await this.db.select({ count: count() }).from(lifeCommitments).where(and(eq(lifeCommitments.userId, userId), eq(lifeCommitments.status, 'upcoming')));
    const [ideaCount] = await this.db.select({ count: count() }).from(lifeIdeas).where(eq(lifeIdeas.userId, userId));

    // 6. Fetch Conversation Dialogue Context
    let targetConvId: string | null = null;
    let convTitle: string | null = null;
    let convStatus: string | null = null;
    let rawMessages: Array<{
      sequenceNumber: number;
      senderRole: string;
      content: string;
      createdAt: Date;
    }> = [];

    if (query.conversationId) {
      // Validate ownership
      const [conv] = await this.db
        .select({ id: conversations.id, title: conversations.title, status: conversations.status })
        .from(conversations)
        .where(and(eq(conversations.id, query.conversationId), eq(conversations.userId, userId)))
        .limit(1);

      if (!conv) {
        throw new NotFoundException(`Conversation ${query.conversationId} not found or access denied`);
      }
      targetConvId = conv.id;
      convTitle = conv.title;
      convStatus = conv.status;
    } else {
      // Pick most recently updated active conversation
      const [latestConv] = await this.db
        .select({ id: conversations.id, title: conversations.title, status: conversations.status })
        .from(conversations)
        .where(and(eq(conversations.userId, userId), eq(conversations.status, 'active')))
        .orderBy(desc(conversations.updatedAt))
        .limit(1);

      if (latestConv) {
        targetConvId = latestConv.id;
        convTitle = latestConv.title;
        convStatus = latestConv.status;
      }
    }

    if (targetConvId) {
      rawMessages = await this.db
        .select({
          sequenceNumber: conversationMessages.sequenceNumber,
          senderRole: conversationMessages.senderRole,
          content: conversationMessages.content,
          createdAt: conversationMessages.createdAt,
        })
        .from(conversationMessages)
        .where(and(eq(conversationMessages.conversationId, targetConvId), eq(conversationMessages.status, 'complete')))
        .orderBy(desc(conversationMessages.sequenceNumber))
        .limit(20);

      // Re-order ascending for chronological presentation
      rawMessages.reverse();
    }

    // 7. Temporal Grounding
    // Note: timezone defaults deterministically to UTC as documented in Phase 1F limitations
    const timezone = 'UTC';
    const hour = now.getUTCHours();
    let timeOfDayGreeting = 'Good evening';
    if (hour >= 5 && hour < 12) timeOfDayGreeting = 'Good morning';
    else if (hour >= 12 && hour < 17) timeOfDayGreeting = 'Good afternoon';
    else if (hour >= 22 || hour < 5) timeOfDayGreeting = 'Good night';

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[now.getUTCDay()]!;

    const lastInteractionMs = new Date(companionState.lastInteractionAt).getTime();
    const minutesSinceLastInteraction = Math.max(0, Math.floor((now.getTime() - lastInteractionMs) / (60 * 1000)));

    const temporal: ContextFrameTemporal = {
      utcTimestamp: now.toISOString(),
      userLocalTime: now.toISOString(),
      timezone,
      dayOfWeek,
      timeOfDayGreeting,
      minutesSinceLastInteraction,
    };

    // 8. Construct Sub-frames
    const identity: ContextFrameIdentity = {
      userId: user.id,
      displayName: user.name,
      preferredName: pers?.preferredName || null,
      occupationRole: pers?.occupationRole || null,
      primaryFocus: pers?.primaryFocus || null,
      timezone,
    };

    const companion: ContextFrameCompanion = {
      archetypeId,
      name: archetype?.name || 'The Balanced Anchor',
      tagline: archetype?.tagline || '',
      description: archetype?.description || '',
      defaultTraits: {
        warmth: archetype?.defaultWarmth ?? 75,
        directness: archetype?.defaultDirectness ?? 65,
        humor: archetype?.defaultHumor ?? 50,
        challengeLevel: archetype?.defaultChallengeLevel ?? 60,
        proactivity: archetype?.defaultProactivity || 'medium',
        responseLength: archetype?.defaultResponseLength || 'balanced',
      },
      avatarSymbol: archetype?.name ? archetype.name.charAt(0).toUpperCase() : 'A',
      colorAccent: '#6366f1',
      presenceStatus: companionState.presenceStatus,
      interactionMode: companionState.interactionMode,
      continuityStreakDays: companionState.continuityStreakDays,
      totalInteractions: companionState.totalInteractions,
      lastInteractionAt: companionState.lastInteractionAt,
      activeFocusGoalTitle: companionState.activeFocusGoal?.title || null,
      activeFocusProjectTitle: companionState.activeFocusProject?.title || null,
    };

    const communicationPreferences: ContextFramePreferences = {
      warmth: pers?.warmth ?? (archetype?.defaultWarmth ?? 75),
      directness: pers?.directness ?? (archetype?.defaultDirectness ?? 65),
      humor: pers?.humor ?? (archetype?.defaultHumor ?? 50),
      challengeLevel: pers?.challengeLevel ?? (archetype?.defaultChallengeLevel ?? 60),
      proactivity: pers?.proactivity || (archetype?.defaultProactivity || 'medium'),
      responseLength: pers?.responseLength || (archetype?.defaultResponseLength || 'balanced'),
    };

    const lifeGroundTruth: ContextFrameLifeState = {
      activeGoals: goalsList.map((g) => ({
        id: g.id,
        title: g.title,
        category: g.category,
        priority: g.priority,
        progressPercentage: g.progressPercentage,
        targetDate: g.targetDate,
      })),
      activeProjects: projectsList.map((p) => ({
        id: p.id,
        title: p.title,
        goalId: p.goalId,
        status: p.status,
        color: p.color,
        targetDate: p.targetDate,
      })),
      completedProjects: completedProjectsList.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
      })),
      relevantTasks: tasksList.map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        isOverdue: t.dueDate ? t.dueDate.getTime() < now.getTime() : false,
      })),
      recentCompletedTasks: completedTasksList.map((t) => ({
        id: t.id,
        title: t.title,
        completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      })),
      upcomingCommitments: commitmentsList.map((c) => {
        const hoursUntilDue = Math.max(0, Math.round((c.dueAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
        return {
          id: c.id,
          title: c.title,
          commitmentType: c.commitmentType,
          importance: c.importance,
          dueAt: c.dueAt.toISOString(),
          hoursUntilDue,
        };
      }),
      fulfilledCommitments: fulfilledCommitmentsList.map((c) => ({
        id: c.id,
        title: c.title,
        commitmentType: c.commitmentType,
      })),
      recentIdeas: ideasList.map((i) => ({
        id: i.id,
        title: i.title,
        tags: (i.tags as string[]) || [],
        status: i.status,
      })),
      counts: {
        totalGoals: Number(goalCount?.count || 0),
        totalProjects: Number(projectCount?.count || 0),
        totalOpenTasks: Number(taskCount?.count || 0),
        totalUpcomingCommitments: Number(commCount?.count || 0),
        totalIdeas: Number(ideaCount?.count || 0),
      },
    };

    // 9. Memory Retrieval (Phase 3D)
    // Identify query text: explicit current turn message, or most recent user message from conversation
    const queryText =
      query.currentMessage?.trim() ||
      (rawMessages.length > 0
        ? [...rawMessages].reverse().find((m) => m.senderRole === 'user')?.content
        : undefined);

    let relevantMemories: RelevantMemoryDto[] = [];
    let relevantMemoriesTokens = 0;

    // Gating: Skip vector search for pure casual greetings or short pleasantries to prevent irrelevant memory pollution
    const isPureGreetingOrAck = (text?: string): boolean => {
      if (!text) return true;
      const lower = text.toLowerCase().trim().replace(/[?!.,]+$/, '');
      if (
        /^(?:hey+|hi+|hello+|howdy|yo|sup|greetings)(?:\s+niva)?(?:\s*,?\s*(?:how\s+are\s+you|how's\s+it\s+going|what's\s+up|how\s+are\s+things))?$/i.test(
          lower,
        )
      ) {
        return true;
      }
      if (/^(?:good\s+(?:morning|afternoon|evening|night|day))(?:\s+niva)?$/i.test(lower)) {
        return true;
      }
      if (
        /^(?:ok|okay|thanks|thank\s+you|got\s+it|cool|great|sounds\s+good|sure|bye|goodbye)$/i.test(
          lower,
        )
      ) {
        return true;
      }
      return false;
    };

    if (queryText && !isPureGreetingOrAck(queryText)) {
      const memoryTokenBudget = query.memoryTokenBudget || 400;
      const retrievalResult = await this.memoryRetrievalService.retrieveRelevantMemories(
        userId,
        queryText,
        {
          limit: 5,
          maxTokens: memoryTokenBudget,
        },
      );
      relevantMemories = retrievalResult.memories;
      relevantMemoriesTokens = this.estimateTokens(relevantMemories);
    }

    // 10. Career Context (Phase 6A)
    let careerContext: CareerContextFrameDto | undefined;
    let careerTokens = 0;
    if (this.careerIntelligenceService) {
      try {
        const assembledCareer = await this.careerIntelligenceService.assembleCareerContext(userId);
        if (assembledCareer) {
          careerContext = assembledCareer;
          careerTokens = this.estimateTokens(careerContext);
        }
      } catch (err: any) {
        // Non-blocking degradation safety: career context assembly failure shouldn't crash overall turn
        careerContext = undefined;
        careerTokens = 0;
      }
    }

    // 11. Study Context (Phase 7)
    let studyContext: StudyContextFrameDto | undefined;
    let studyTokens = 0;
    if (this.studyIntelligenceService) {
      try {
        const assembledStudy = await this.studyIntelligenceService.assembleStudyContext(userId);
        if (assembledStudy) {
          studyContext = assembledStudy;
          studyTokens = this.estimateTokens(studyContext);
        }
      } catch (err: any) {
        // Non-blocking degradation safety: study context assembly failure shouldn't crash overall turn
        studyContext = undefined;
        studyTokens = 0;
      }
    }

    // 12. Longitudinal Context & Reflection (Phase 8)
    let longitudinalContext: LongitudinalContextFrameDto | undefined;
    let longitudinalTokens = 0;
    if (this.reflectionEngineService) {
      try {
        const assembledLongitudinal = await this.reflectionEngineService.getAssembledLongitudinalContext(userId);
        if (assembledLongitudinal) {
          longitudinalContext = assembledLongitudinal;
          longitudinalTokens = this.estimateTokens(longitudinalContext);
        }
      } catch (err: any) {
        // Non-blocking degradation safety: reflection context assembly failure shouldn't crash overall turn
        longitudinalContext = undefined;
        longitudinalTokens = 0;
      }
    }

    // 12.5 Personal Understanding & Recent Proactive Intervention (Phase 10)
    let personalUnderstanding: Record<string, unknown> | undefined;
    let recentProactiveIntervention: {
      id: string;
      title: string;
      body: string;
      channel: string;
      createdAt: string;
    } | null = null;

    try {
      const [profile] = await this.db
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId))
        .limit(1);

      if (profile) {
        personalUnderstanding = {
          education: profile.education,
          profession: profile.profession,
          expertiseAreas: profile.expertiseAreas,
          interests: profile.interests,
          dailyRoutines: profile.dailyRoutines,
          communicationPreferences: profile.communicationPreferences,
          learningPreferences: profile.learningPreferences,
          ongoingChallenges: profile.ongoingChallenges,
          importantDates: profile.importantDates,
        };
      }

      const [recentNotif] = await this.db
        .select({
          id: schema.notifications.id,
          title: schema.notifications.title,
          body: schema.notifications.body,
          channel: schema.notifications.channel,
          createdAt: schema.notifications.createdAt,
        })
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, userId))
        .orderBy(desc(schema.notifications.createdAt))
        .limit(1);

      if (recentNotif) {
        recentProactiveIntervention = {
          id: recentNotif.id,
          title: recentNotif.title,
          body: recentNotif.body,
          channel: recentNotif.channel,
          createdAt: recentNotif.createdAt.toISOString(),
        };
      }
    } catch (e: any) {
      this.logger.debug(`Could not assemble personal understanding: ${e.message}`);
    }

    // 13. Token Budgeting & Dialogue Truncation
    const identityTokens = this.estimateTokens(identity) + this.estimateTokens(companion) + this.estimateTokens(communicationPreferences);
    const companionStateTokens = this.estimateTokens(companionState) + this.estimateTokens(temporal);
    const lifeStateTokens = this.estimateTokens(lifeGroundTruth);

    // Remaining tokens for dialogue history
    const baseReserved = identityTokens + companionStateTokens + lifeStateTokens + relevantMemoriesTokens + careerTokens + studyTokens + longitudinalTokens;
    const availableForDialogue = Math.max(200, maxTokens - baseReserved);

    // Truncate dialogue from oldest first if needed, preserving at least 2 messages
    let budgetedMessages = rawMessages;
    while (budgetedMessages.length > 2 && this.estimateTokens(budgetedMessages) > availableForDialogue) {
      budgetedMessages = budgetedMessages.slice(1);
    }

    const dialogueContext: ContextFrameDialogue = {
      conversationId: targetConvId,
      title: convTitle,
      status: convStatus,
      messageCount: budgetedMessages.length,
      messages: budgetedMessages.map((m) => ({
        sequenceNumber: m.sequenceNumber,
        senderRole: m.senderRole,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    };

    const dialogueTokens = this.estimateTokens(dialogueContext);
    const totalEstimatedTokens =
      identityTokens + companionStateTokens + lifeStateTokens + relevantMemoriesTokens + careerTokens + studyTokens + longitudinalTokens + dialogueTokens;

    const tokenBudget: TokenBudgetBreakdown = {
      identityAndPersona: identityTokens,
      lifeGroundTruth: lifeStateTokens,
      dialogueHistory: dialogueTokens,
      companionState: companionStateTokens,
      relevantMemories: relevantMemoriesTokens,
      careerContext: careerTokens,
      studyContext: studyTokens,
      longitudinalContext: longitudinalTokens,
      totalEstimatedTokens,
      allocatedMaxTokens: maxTokens,
      charactersCount: JSON.stringify({
        identity,
        companion,
        communicationPreferences,
        lifeGroundTruth,
        dialogueContext,
        temporal,
        relevantMemories,
        careerContext,
        studyContext,
        longitudinalContext,
      }).length,
      estimationMethod: 'deterministic_heuristic_4chars_per_token',
    };

    const frame: ContextFrameDto = {
      assembledAt: now.toISOString(),
      tokenBudget,
      identity,
      companion,
      communicationPreferences,
      lifeGroundTruth,
      dialogueContext,
      temporalGrounding: temporal,
      relevantMemories,
      careerContext,
      studyContext,
      longitudinalContext,
      personalUnderstanding,
      recentProactiveIntervention,
    };

    // 11. Persist Snapshot if explicitly requested
    if (query.persistSnapshot) {
      const savedSnapshot = await this.snapshotRepo.saveSnapshot({
        userId,
        conversationId: targetConvId,
        triggerReason: query.triggerReason || 'manual_query',
        tokenBudgetAllocated: maxTokens,
        tokenCountEstimated: totalEstimatedTokens,
        assembledFrame: frame as any,
      });
      frame.snapshotId = savedSnapshot.id;
    }

    return frame;
  }
}
