import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import {
  StudyTopicDto,
  CreateStudyTopicDto,
  UpdateStudyTopicDto,
  StudySessionDto,
  StartStudySessionDto,
  CompleteStudySessionDto,
  LearningDifficultyDto,
  CreateLearningDifficultyDto,
  UpdateLearningDifficultyDto,
  StudyRecommendationDto,
  StudyOverviewSummaryDto,
  StudyContextFrameDto,
  TopicProgressStatus,
  StudyProficiencyLevel,
  StudyRecommendationPriority,
  StudySessionType,
} from '@niva/shared-types';
import { StudyRepository } from './study.repository';
import { LifeContextRepository } from '../life-context/life-context.repository';
import { CareerRepository } from '../career/career.repository';
import { EventPublisherService } from '../events/event-publisher.service';
import { UpdateStudySessionRequestDto } from './dto/study.dto';

@Injectable()
export class StudyIntelligenceService {
  constructor(
    private readonly repository: StudyRepository,
    private readonly lifeContextRepo: LifeContextRepository,
    private readonly eventPublisher: EventPublisherService,
    @Optional()
    private readonly careerRepo?: CareerRepository,
  ) {}

  // ==========================================
  // TOPICS
  // ==========================================

  async listTopics(
    userId: string,
    filters?: { subjectName?: string; status?: string },
  ): Promise<StudyTopicDto[]> {
    const rawTopics = await this.repository.findTopics(userId, filters);
    const allUserTopics = await this.repository.findTopics(userId);
    const topicMap = new Map(allUserTopics.map((t) => [t.id, t]));

    return rawTopics.map((t) => this.mapTopicToDto(t, topicMap));
  }

  async getTopic(id: string, userId: string): Promise<StudyTopicDto> {
    const topic = await this.repository.findTopicById(id, userId);
    if (!topic) {
      throw new NotFoundException(`Study topic ${id} not found or access denied`);
    }

    const allUserTopics = await this.repository.findTopics(userId);
    const topicMap = new Map(allUserTopics.map((t) => [t.id, t]));

    return this.mapTopicToDto(topic, topicMap);
  }

  async createTopic(
    userId: string,
    dto: CreateStudyTopicDto,
  ): Promise<StudyTopicDto> {
    const trimmedTitle = (dto.title || '').trim();
    const trimmedSubject = (dto.subjectName || '').trim();
    if (!trimmedTitle || !trimmedSubject) {
      throw new BadRequestException('Topic title and subject name are required');
    }

    // Validate parentTopicId if supplied
    if (dto.parentTopicId) {
      const parent = await this.repository.findTopicById(dto.parentTopicId, userId);
      if (!parent) {
        throw new BadRequestException('Specified parent topic does not exist');
      }
    }

    // Validate prerequisite topic IDs
    const prereqIds = dto.prerequisiteTopicIds || [];
    if (prereqIds.length > 0) {
      const prereqs = await this.repository.findTopicsByIds(prereqIds, userId);
      if (prereqs.length !== prereqIds.length) {
        throw new BadRequestException('One or more prerequisite topics do not exist or belong to another user');
      }
    }

    const created = await this.repository.createTopic({
      userId,
      parentTopicId: dto.parentTopicId || null,
      subjectName: trimmedSubject,
      title: trimmedTitle,
      description: dto.description ?? null,
      status: 'not_started',
      targetProficiency: dto.targetProficiency || 'intermediate',
      demonstratedProficiency: null, // Mastery must have evidence; cannot be claimed on creation
      linkedGoalId: dto.linkedGoalId || null,
      linkedSkillId: dto.linkedSkillId || null,
      learningObjectives: dto.learningObjectives || [],
      prerequisiteTopicIds: prereqIds,
      confidenceScore: 0,
    });

    return this.getTopic(created.id, userId);
  }

  async updateTopic(
    id: string,
    userId: string,
    dto: UpdateStudyTopicDto,
  ): Promise<StudyTopicDto> {
    const existing = await this.repository.findTopicById(id, userId);
    if (!existing) {
      throw new NotFoundException(`Study topic ${id} not found or access denied`);
    }

    // Cycle detection in parent
    if (dto.parentTopicId && dto.parentTopicId === id) {
      throw new BadRequestException('A topic cannot be its own parent');
    }

    // Cycle detection in prerequisites
    if (dto.prerequisiteTopicIds) {
      if (dto.prerequisiteTopicIds.includes(id)) {
        throw new BadRequestException('A topic cannot be a prerequisite of itself');
      }
      const prereqs = await this.repository.findTopicsByIds(dto.prerequisiteTopicIds, userId);
      if (prereqs.length !== dto.prerequisiteTopicIds.length) {
        throw new BadRequestException('One or more prerequisite topics not found');
      }
    }

    // INVARIANT ENFORCEMENT: Cannot set demonstrated status or proficiency without evidence
    if (
      dto.status === 'demonstrated' ||
      dto.demonstratedProficiency
    ) {
      // Check if candidate has completed sessions with evidence notes, or verified career evidence
      const pastSessions = await this.repository.findSessions(userId, id);
      const hasSessionEvidence = pastSessions.some(
        (s) => s.status === 'completed' && s.evidenceNotes && s.evidenceNotes.trim().length > 0,
      );

      let hasCareerEvidence = false;
      if (existing.linkedSkillId && this.careerRepo) {
        const userSkills = await this.careerRepo.listUserSkillsWithEvidence(userId);
        const matching = userSkills.find((us) => us.skillId === existing.linkedSkillId);
        hasCareerEvidence = !!matching && matching.evidence.length > 0;
      }

      if (!hasSessionEvidence && !hasCareerEvidence) {
        throw new BadRequestException(
          'Demonstrated proficiency requires supporting evidence. Complete a study session with evidence notes or attach practical artifact evidence.',
        );
      }
    }

    const updated = await this.repository.updateTopic(id, userId, {
      parentTopicId:
        dto.parentTopicId !== undefined ? dto.parentTopicId : existing.parentTopicId,
      subjectName: dto.subjectName ? dto.subjectName.trim() : existing.subjectName,
      title: dto.title ? dto.title.trim() : existing.title,
      description:
        dto.description !== undefined ? dto.description : existing.description,
      status: dto.status ?? existing.status,
      targetProficiency: dto.targetProficiency ?? existing.targetProficiency,
      demonstratedProficiency:
        dto.demonstratedProficiency !== undefined
          ? dto.demonstratedProficiency
          : existing.demonstratedProficiency,
      linkedGoalId:
        dto.linkedGoalId !== undefined ? dto.linkedGoalId : existing.linkedGoalId,
      linkedSkillId:
        dto.linkedSkillId !== undefined ? dto.linkedSkillId : existing.linkedSkillId,
      learningObjectives:
        dto.learningObjectives !== undefined
          ? dto.learningObjectives
          : (existing.learningObjectives as string[]),
      prerequisiteTopicIds:
        dto.prerequisiteTopicIds !== undefined
          ? dto.prerequisiteTopicIds
          : (existing.prerequisiteTopicIds as string[]),
      confidenceScore:
        dto.confidenceScore !== undefined
          ? dto.confidenceScore
          : existing.confidenceScore,
    });

    if (!updated) {
      throw new NotFoundException(`Study topic ${id} not found`);
    }

    await this.eventPublisher.publish({
      userId,
      eventType: 'TopicProgressUpdated',
      aggregateType: 'study_topic',
      aggregateId: updated.id,
      payload: {
        topicId: updated.id,
        status: updated.status,
        demonstratedProficiency: updated.demonstratedProficiency,
      },
    });

    return this.getTopic(id, userId);
  }

  async deleteTopic(id: string, userId: string): Promise<void> {
    const topic = await this.repository.findTopicById(id, userId);
    if (!topic) {
      throw new NotFoundException(`Study topic ${id} not found or access denied`);
    }
    await this.repository.deleteTopic(id, userId);
  }

  // ==========================================
  // SESSIONS
  // ==========================================

  async startSession(
    userId: string,
    dto: StartStudySessionDto,
  ): Promise<StudySessionDto> {
    // 1. Check for existing active session (graceful recovery / prevention of orphan sessions)
    const active = await this.repository.findActiveSession(userId);
    if (active) {
      if (active.topicId === dto.topicId) {
        return this.mapSessionToDto(active);
      }
      // If user had an active session on a different topic, complete or cancel the older session
      await this.repository.updateSession(active.id, userId, {
        status: 'abandoned',
        completedAt: new Date(),
      });
    }

    // 2. Verify target topic exists
    const topic = await this.repository.findTopicById(dto.topicId, userId);
    if (!topic) {
      throw new NotFoundException(`Topic ${dto.topicId} not found or access denied`);
    }

    // 3. Update topic status to in_progress if not_started
    if (topic.status === 'not_started') {
      await this.repository.updateTopic(topic.id, userId, {
        status: 'in_progress',
      });
    }

    // 4. Create new study session
    const session = await this.repository.createSession({
      userId,
      topicId: dto.topicId,
      sessionType: dto.sessionType || 'concept_study',
      status: 'in_progress',
      startedAt: new Date(),
      userNotes: dto.userNotes ?? null,
      conceptsUnderstood: [],
      difficultiesEncountered: [],
      followUpActions: [],
      evidenceNotes: null,
      metadata: {},
    });

    await this.eventPublisher.publish({
      userId,
      eventType: 'StudySessionStarted',
      aggregateType: 'study_session',
      aggregateId: session.id,
      payload: {
        sessionId: session.id,
        topicId: session.topicId,
        sessionType: session.sessionType,
      },
    });

    return {
      id: session.id,
      userId: session.userId,
      topicId: session.topicId,
      topicTitle: topic.title,
      subjectName: topic.subjectName,
      sessionType: session.sessionType as any,
      status: session.status as any,
      startedAt: session.startedAt.toISOString(),
      completedAt: null,
      durationMinutes: null,
      userNotes: session.userNotes,
      conceptsUnderstood: [],
      difficultiesEncountered: [],
      followUpActions: [],
      evidenceNotes: null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  async getActiveSession(userId: string): Promise<StudySessionDto | null> {
    const session = await this.repository.findActiveSession(userId);
    if (!session) return null;
    return this.mapSessionToDto(session);
  }

  async completeSession(
    id: string,
    userId: string,
    dto: CompleteStudySessionDto,
  ): Promise<StudySessionDto> {
    const session = await this.repository.findSessionById(id, userId);
    if (!session) {
      throw new NotFoundException(`Study session ${id} not found or access denied`);
    }

    // Idempotent completion check
    if (session.status === 'completed') {
      return this.mapSessionToDto(session);
    }

    const completedAt = new Date();
    // Compute duration if not provided
    const durationMinutes =
      dto.durationMinutes ||
      Math.max(
        1,
        Math.round((completedAt.getTime() - session.startedAt.getTime()) / 60000),
      );

    const updated = await this.repository.updateSession(id, userId, {
      status: 'completed',
      completedAt,
      durationMinutes,
      userNotes: dto.userNotes !== undefined ? dto.userNotes : session.userNotes,
      conceptsUnderstood: dto.conceptsUnderstood || (session.conceptsUnderstood as string[]),
      difficultiesEncountered:
        dto.difficultiesEncountered || (session.difficultiesEncountered as string[]),
      followUpActions:
        dto.followUpActions || (session.followUpActions as string[]),
      evidenceNotes:
        dto.evidenceNotes !== undefined ? dto.evidenceNotes : session.evidenceNotes,
    });

    if (!updated) {
      throw new NotFoundException(`Failed to complete session ${id}`);
    }

    // Update topic lastStudiedAt and status
    const topic = await this.repository.findTopicById(session.topicId, userId);
    if (topic) {
      let newStatus: TopicProgressStatus = topic.status as TopicProgressStatus;
      if (dto.updateTopicStatus) {
        newStatus = dto.updateTopicStatus;
      } else if (topic.status === 'not_started' || topic.status === 'in_progress') {
        newStatus = 'practiced';
      }

      await this.repository.updateTopic(topic.id, userId, {
        lastStudiedAt: completedAt,
        status: newStatus,
        demonstratedProficiency:
          dto.demonstratedProficiency && dto.evidenceNotes
            ? dto.demonstratedProficiency
            : topic.demonstratedProficiency,
      });
    }

    // Auto-record difficulties if supplied
    if (dto.difficultiesEncountered && dto.difficultiesEncountered.length > 0) {
      for (const diff of dto.difficultiesEncountered) {
        if (diff.trim().length > 0) {
          await this.repository.createDifficulty({
            userId,
            topicId: session.topicId,
            sessionId: id,
            concept: diff.trim().slice(0, 255),
            description: `Encountered difficulty during study session on ${session.topicTitle}`,
            source: 'user_reported',
            confidence: '1.00',
            status: 'active',
          });
        }
      }
    }

    await this.eventPublisher.publish({
      userId,
      eventType: 'StudySessionCompleted',
      aggregateType: 'study_session',
      aggregateId: updated.id,
      payload: {
        sessionId: updated.id,
        topicId: updated.topicId,
        durationMinutes,
        conceptsUnderstoodCount: (dto.conceptsUnderstood || []).length,
      },
    });

    const fullUpdated = await this.repository.findSessionById(id, userId);
    return this.mapSessionToDto({
      ...updated,
      topicTitle: fullUpdated?.topicTitle || session.topicTitle,
      subjectName: fullUpdated?.subjectName || session.subjectName,
    });
  }

  async abandonSession(id: string, userId: string): Promise<StudySessionDto> {
    const session = await this.repository.findSessionById(id, userId);
    if (!session) {
      throw new NotFoundException(`Study session ${id} not found or access denied`);
    }

    const updated = await this.repository.updateSession(id, userId, {
      status: 'abandoned',
      completedAt: new Date(),
    });

    return this.mapSessionToDto({
      ...updated,
      topicTitle: session.topicTitle,
      subjectName: session.subjectName,
    });
  }

  async updateSession(
    id: string,
    userId: string,
    dto: UpdateStudySessionRequestDto,
  ): Promise<StudySessionDto> {
    const session = await this.repository.findSessionById(id, userId);
    if (!session) {
      throw new NotFoundException(`Study session ${id} not found or access denied`);
    }

    const updated = await this.repository.updateSession(id, userId, {
      userNotes: dto.userNotes !== undefined ? dto.userNotes : session.userNotes,
    });

    if (!updated) {
      throw new NotFoundException(`Failed to update study session ${id}`);
    }

    return this.mapSessionToDto({
      ...updated,
      topicTitle: session.topicTitle,
      subjectName: session.subjectName,
    });
  }

  async listSessions(
    userId: string,
    topicId?: string,
  ): Promise<StudySessionDto[]> {
    const sessions = await this.repository.findSessions(userId, topicId);
    return sessions.map((s) => this.mapSessionToDto(s));
  }

  // ==========================================
  // DIFFICULTIES
  // ==========================================

  async listDifficulties(
    userId: string,
    filters?: { topicId?: string; status?: string },
  ): Promise<LearningDifficultyDto[]> {
    const diffs = await this.repository.findDifficulties(userId, filters);
    return diffs.map((d) => this.mapDifficultyToDto(d));
  }

  async recordDifficulty(
    userId: string,
    dto: CreateLearningDifficultyDto,
  ): Promise<LearningDifficultyDto> {
    const topic = await this.repository.findTopicById(dto.topicId, userId);
    if (!topic) {
      throw new NotFoundException(`Topic ${dto.topicId} not found or access denied`);
    }

    const created = await this.repository.createDifficulty({
      userId,
      topicId: dto.topicId,
      sessionId: dto.sessionId || null,
      concept: dto.concept.trim(),
      description: dto.description.trim(),
      source: dto.source || 'user_reported',
      confidence: (dto.confidence ?? 1.0).toFixed(2),
      status: 'active',
    });

    // If topic was marked demonstrated or practiced, optionally mark needs_review
    if (topic.status === 'demonstrated' || topic.status === 'practiced') {
      await this.repository.updateTopic(topic.id, userId, {
        status: 'needs_review',
      });
    }

    await this.eventPublisher.publish({
      userId,
      eventType: 'LearningDifficultyRecorded',
      aggregateType: 'learning_difficulty',
      aggregateId: created.id,
      payload: {
        difficultyId: created.id,
        topicId: created.topicId,
        concept: created.concept,
        source: created.source,
      },
    });

    const full = await this.repository.findDifficultyById(created.id, userId);
    return this.mapDifficultyToDto(full || created as any);
  }

  async updateDifficulty(
    id: string,
    userId: string,
    dto: UpdateLearningDifficultyDto,
  ): Promise<LearningDifficultyDto> {
    const existing = await this.repository.findDifficultyById(id, userId);
    if (!existing) {
      throw new NotFoundException(`Learning difficulty ${id} not found or access denied`);
    }

    const isResolving = dto.status === 'resolved' && existing.status !== 'resolved';

    const updated = await this.repository.updateDifficulty(id, userId, {
      status: dto.status ?? existing.status,
      resolutionNotes:
        dto.resolutionNotes !== undefined
          ? dto.resolutionNotes
          : existing.resolutionNotes,
      resolvedAt: isResolving ? new Date() : existing.resolvedAt,
    });

    const full = await this.repository.findDifficultyById(id, userId);
    return this.mapDifficultyToDto(full || updated as any);
  }

  // ==========================================
  // NEXT-STEP STUDY RECOMMENDATIONS
  // ==========================================

  async getRecommendations(userId: string): Promise<StudyRecommendationDto[]> {
    const [allTopics, allDifficulties, _allSessions, pendingLifeTasks] =
      await Promise.all([
        this.repository.findTopics(userId),
        this.repository.findDifficulties(userId, { status: 'active' }),
        this.repository.findSessions(userId, undefined, 10),
        this.lifeContextRepo.findTasks(userId).catch(() => []),
      ]);

    const topicMap = new Map(allTopics.map((t) => [t.id, t]));
    const openTasks = pendingLifeTasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'cancelled',
    );

    // Map difficulty counts by topic
    const diffCountMap = new Map<string, number>();
    for (const d of allDifficulties) {
      diffCountMap.set(d.topicId, (diffCountMap.get(d.topicId) || 0) + 1);
    }

    const recommendations: StudyRecommendationDto[] = [];

    // Helper to find matching operational Life Tasks
    const findMatchingTasks = (topicTitle: string, subjectName: string) => {
      const words = `${topicTitle} ${subjectName}`
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4);

      return openTasks
        .filter((t) => {
          const tText = `${t.title} ${t.description || ''}`.toLowerCase();
          return words.some((w) => tText.includes(w));
        })
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
        }));
    };

    for (const topic of allTopics) {
      if (topic.status === 'demonstrated') continue; // Skip topics already demonstrated

      const prereqIds = (topic.prerequisiteTopicIds as string[]) || [];
      const unmetPrereqs: string[] = [];
      for (const pid of prereqIds) {
        const pt = topicMap.get(pid);
        if (!pt || (pt.status !== 'demonstrated' && pt.status !== 'practiced')) {
          unmetPrereqs.push(pt?.title || 'Required Foundation Topic');
        }
      }

      const activeDiffCount = diffCountMap.get(topic.id) || 0;
      const requiresReview = topic.status === 'needs_review';

      let priority: StudyRecommendationPriority = 'routine';
      let sessionType: StudySessionType = 'concept_study';
      let what = `Study foundational concepts and core mechanisms in ${topic.title}`;
      let why = `Target topic for ${topic.subjectName}.`;
      let estMinutes = 30;

      // 1. Critical Priority: Active unresolved difficulties
      if (activeDiffCount > 0) {
        priority = 'critical';
        sessionType = 'revision';
        estMinutes = 25;
        what = `Targeted revision addressing ${activeDiffCount} recorded difficulty area(s) in ${topic.title}`;
        why = `Active difficulties require focused conceptual breakdown and recall before moving forward.`;
      }
      // 2. High Priority: Marked needs_review
      else if (requiresReview) {
        priority = 'high';
        sessionType = 'active_recall';
        estMinutes = 20;
        what = `Active recall and retention check for ${topic.title}`;
        why = `Flagged for revision to consolidate memory retention and prevent concept decay.`;
      }
      // 3. High Priority: Linked to career critical skill
      else if (topic.linkedSkillId) {
        priority = 'high';
        sessionType = 'problem_solving';
        estMinutes = 45;
        what = `Practical deep dive on ${topic.title} aligned with career skill benchmarks`;
        why = `Directly supports career target role requirements (${topic.linkedSkillName || 'Career Skill'}).`;
      }
      // 4. Medium Priority: In progress with prerequisites satisfied
      else if (topic.status === 'in_progress' && unmetPrereqs.length === 0) {
        priority = 'medium';
        sessionType = 'exercise';
        estMinutes = 35;
        what = `Continue practical exercises and structured notes for ${topic.title}`;
        why = `Active learning objective with all prerequisites satisfied.`;
      }
      // 5. Blocked: Has unmet prerequisites
      else if (unmetPrereqs.length > 0) {
        priority = 'routine';
        sessionType = 'concept_study';
        what = `Review foundational prerequisite (${unmetPrereqs[0]}) before ${topic.title}`;
        why = `Topic has ${unmetPrereqs.length} unsatisfied prerequisite(s). Complete foundations first.`;
      }

      recommendations.push({
        topicId: topic.id,
        topicTitle: topic.title,
        subjectName: topic.subjectName,
        priority,
        what,
        why,
        recommendedSessionType: sessionType,
        estimatedMinutes: estMinutes,
        hasUnmetPrerequisites: unmetPrereqs.length > 0,
        unmetPrerequisites: unmetPrereqs.length > 0 ? unmetPrereqs : undefined,
        activeDifficultiesCount: activeDiffCount,
        requiresReview,
        linkedCareerSkillName: topic.linkedSkillName,
        linkedLifeTasks: findMatchingTasks(topic.title, topic.subjectName),
      });
    }

    // Sort: critical first, then high, medium, routine. Within same priority, topics without unmet prereqs first.
    const priorityWeight: Record<StudyRecommendationPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      routine: 1,
    };

    recommendations.sort((a, b) => {
      const wDiff = (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
      if (wDiff !== 0) return wDiff;
      if (!a.hasUnmetPrerequisites && b.hasUnmetPrerequisites) return -1;
      if (a.hasUnmetPrerequisites && !b.hasUnmetPrerequisites) return 1;
      return 0;
    });

    return recommendations.slice(0, 10);
  }

  // ==========================================
  // OVERVIEW SUMMARY
  // ==========================================

  async getOverviewSummary(userId: string): Promise<StudyOverviewSummaryDto> {
    const [counts, activeDiffCount, totalMinutes, recentSessions, activeSession] =
      await Promise.all([
        this.repository.countTopics(userId),
        this.repository.countActiveDifficulties(userId),
        this.repository.sumStudyMinutes(userId),
        this.repository.findSessions(userId, undefined, 5),
        this.repository.findActiveSession(userId),
      ]);

    const lastCompleted = recentSessions.find((s) => s.status === 'completed');

    return {
      totalTopics: counts.total,
      topicsInProgress: counts.inProgress,
      topicsDemonstrated: counts.demonstrated,
      topicsNeedingReview: counts.needsReview,
      activeDifficultiesCount: activeDiffCount,
      recentSessionsCount: recentSessions.length,
      totalStudyMinutes: totalMinutes,
      lastStudiedTopic: lastCompleted
        ? {
            id: lastCompleted.topicId,
            title: lastCompleted.topicTitle,
            subjectName: lastCompleted.subjectName,
            studiedAt: (lastCompleted.completedAt || lastCompleted.startedAt).toISOString(),
          }
        : null,
      activeSession: activeSession ? this.mapSessionToDto(activeSession) : null,
    };
  }

  // ==========================================
  // CONTEXT ASSEMBLY INTEGRATION
  // ==========================================

  async assembleStudyContext(userId: string): Promise<StudyContextFrameDto> {
    const [allTopics, activeDifficulties, recentSessions, recommendations] =
      await Promise.all([
        this.repository.findTopics(userId),
        this.repository.findDifficulties(userId, { status: 'active' }),
        this.repository.findSessions(userId, undefined, 3),
        this.getRecommendations(userId),
      ]);

    // Active focus topic is either currently active session topic or highest priority in-progress topic
    const activeSession = recentSessions.find((s) => s.status === 'in_progress');
    let activeFocusTopic = activeSession
      ? allTopics.find((t) => t.id === activeSession.topicId)
      : allTopics.find((t) => t.status === 'in_progress');

    if (!activeFocusTopic && allTopics.length > 0) {
      activeFocusTopic = allTopics[0];
    }

    const topicsNeedingReview = allTopics
      .filter((t) => t.status === 'needs_review')
      .slice(0, 3)
      .map((t) => ({
        id: t.id,
        title: t.title,
        subjectName: t.subjectName,
        lastStudiedAt: t.lastStudiedAt ? t.lastStudiedAt.toISOString() : null,
      }));

    return {
      activeFocusTopic: activeFocusTopic
        ? {
            id: activeFocusTopic.id,
            title: activeFocusTopic.title,
            subjectName: activeFocusTopic.subjectName,
            status: activeFocusTopic.status as TopicProgressStatus,
            targetProficiency: activeFocusTopic.targetProficiency as StudyProficiencyLevel,
            demonstratedProficiency: (activeFocusTopic.demonstratedProficiency as StudyProficiencyLevel) || null,
            learningObjectives: (activeFocusTopic.learningObjectives as string[]) || [],
          }
        : null,
      activeDifficulties: activeDifficulties.slice(0, 4).map((d) => ({
        concept: d.concept,
        topicTitle: d.topicTitle,
        source: d.source as any,
        description: d.description,
      })),
      recentStudySessions: recentSessions
        .filter((s) => s.status === 'completed')
        .slice(0, 3)
        .map((s) => ({
          topicTitle: s.topicTitle,
          sessionType: s.sessionType as any,
          durationMinutes: s.durationMinutes,
          completedAt: s.completedAt ? s.completedAt.toISOString() : null,
          conceptsUnderstood: (s.conceptsUnderstood as string[]) || [],
          difficultiesEncountered: (s.difficultiesEncountered as string[]) || [],
        })),
      topicsNeedingReview,
      topRecommendation:
        recommendations.length > 0 && recommendations[0]
          ? {
              topicTitle: recommendations[0].topicTitle,
              what: recommendations[0].what,
              why: recommendations[0].why,
            }
          : null,
    };
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private toIso(val: any): string {
    if (!val) return new Date().toISOString();
    if (val instanceof Date) return val.toISOString();
    return String(val);
  }

  private toNullableIso(val: any): string | null {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString();
    return String(val);
  }

  private mapTopicToDto(
    topic: any,
    topicMap: Map<string, any>,
  ): StudyTopicDto {
    const prereqIds = (topic.prerequisiteTopicIds as string[]) || [];
    const prerequisites = prereqIds.map((pid) => {
      const pt = topicMap.get(pid);
      return {
        id: pid,
        title: pt?.title || 'Unknown Prerequisite',
        status: (pt?.status as TopicProgressStatus) || 'not_started',
      };
    });

    return {
      id: topic.id,
      userId: topic.userId,
      parentTopicId: topic.parentTopicId,
      subjectName: topic.subjectName,
      title: topic.title,
      description: topic.description,
      status: topic.status as any,
      targetProficiency: topic.targetProficiency as any,
      demonstratedProficiency: topic.demonstratedProficiency as any,
      linkedGoalId: topic.linkedGoalId,
      linkedSkillId: topic.linkedSkillId,
      linkedSkillName: topic.linkedSkillName,
      linkedGoalTitle: topic.linkedGoalTitle,
      learningObjectives: (topic.learningObjectives as string[]) || [],
      prerequisiteTopicIds: prereqIds,
      prerequisites,
      confidenceScore: topic.confidenceScore,
      lastStudiedAt: this.toNullableIso(topic.lastStudiedAt),
      createdAt: this.toIso(topic.createdAt),
      updatedAt: this.toIso(topic.updatedAt),
    };
  }

  private mapSessionToDto(s: any): StudySessionDto {
    return {
      id: s.id,
      userId: s.userId,
      topicId: s.topicId,
      topicTitle: s.topicTitle || undefined,
      subjectName: s.subjectName || undefined,
      sessionType: s.sessionType as any,
      status: s.status as any,
      startedAt: this.toIso(s.startedAt),
      completedAt: this.toNullableIso(s.completedAt),
      durationMinutes: s.durationMinutes,
      userNotes: s.userNotes,
      conceptsUnderstood: (s.conceptsUnderstood as string[]) || [],
      difficultiesEncountered: (s.difficultiesEncountered as string[]) || [],
      followUpActions: (s.followUpActions as string[]) || [],
      evidenceNotes: s.evidenceNotes,
      metadata: s.metadata,
      createdAt: this.toIso(s.createdAt),
      updatedAt: this.toIso(s.updatedAt),
    };
  }

  private mapDifficultyToDto(d: any): LearningDifficultyDto {
    return {
      id: d.id,
      userId: d.userId,
      topicId: d.topicId,
      topicTitle: d.topicTitle || undefined,
      subjectName: d.subjectName || undefined,
      sessionId: d.sessionId,
      concept: d.concept,
      description: d.description,
      source: d.source as any,
      confidence: Number(d.confidence),
      status: d.status as any,
      resolvedAt: this.toNullableIso(d.resolvedAt),
      resolutionNotes: d.resolutionNotes,
      createdAt: this.toIso(d.createdAt),
      updatedAt: this.toIso(d.updatedAt),
    };
  }
}
