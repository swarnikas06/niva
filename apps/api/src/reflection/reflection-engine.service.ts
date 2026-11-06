import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import {
  LongitudinalObservationDto,
  ReflectionOverviewDto,
  IntentionOutcomeComparisonDto,
  LongitudinalContextFrameDto,
  SupportingEvidenceRef,
  ObservationCategory,
  CreateLongitudinalObservationDto,
} from '@niva/shared-types';
import { ReflectionRepository } from './reflection.repository';
import { LifeContextRepository } from '../life-context/life-context.repository';
import { StudyRepository } from '../study/study.repository';
import { CareerRepository } from '../career/career.repository';
import { EventPublisherService } from '../events/event-publisher.service';
import {
  GetObservationsQueryDto,
  CorrectObservationRequestDto,
} from './dto/reflection.dto';
import { LongitudinalObservation } from '../database/schema';

@Injectable()
export class ReflectionEngineService {
  private readonly logger = new Logger(ReflectionEngineService.name);

  constructor(
    private readonly reflectionRepo: ReflectionRepository,
    private readonly lifeContextRepo: LifeContextRepository,
    private readonly studyRepo: StudyRepository,
    private readonly eventPublisher: EventPublisherService,
    @Optional()
    private readonly careerRepo?: CareerRepository,
  ) {}

  // ==========================================
  // QUERY & OVERVIEW
  // ==========================================

  async getOverview(
    userId: string,
    windowDays = 14,
  ): Promise<ReflectionOverviewDto> {
    const counts = await this.reflectionRepo.countObservationsByStatus(userId);
    const activeAndConfirmed =
      await this.reflectionRepo.findActiveAndConfirmedObservations(userId, 10);

    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // 1. Gather recent progress items
    const recentProgress = await this.gatherRecentProgress(userId, windowStart);

    // 2. Gather unresolved threads
    const unresolvedThreads = await this.gatherUnresolvedThreads(userId);

    // 3. Gather intention vs outcome comparisons
    const intentionsAndOutcomes = await this.gatherIntentionsAndOutcomes(
      userId,
      windowStart,
    );

    return {
      windowDays,
      totalObservations: counts.total,
      activeObservationsCount: counts.active,
      confirmedObservationsCount: counts.confirmed,
      correctedObservationsCount: counts.corrected,
      dismissedObservationsCount: counts.dismissed,
      recentProgress,
      unresolvedThreads,
      intentionsAndOutcomes,
      topObservations: activeAndConfirmed.map((obs) => this.mapToDto(obs)),
    };
  }

  async getObservations(
    userId: string,
    query: GetObservationsQueryDto,
  ): Promise<LongitudinalObservationDto[]> {
    const rows = await this.reflectionRepo.findObservations(userId, {
      status: query.status,
      category: query.category,
      limit: query.limit,
      offset: query.offset,
    });

    return rows.map((obs) => this.mapToDto(obs));
  }

  async getObservationById(
    userId: string,
    id: string,
  ): Promise<LongitudinalObservationDto> {
    const obs = await this.reflectionRepo.findObservationById(userId, id);
    if (!obs) {
      throw new NotFoundException(`Longitudinal observation ${id} not found`);
    }
    return this.mapToDto(obs);
  }

  // ==========================================
  // MANUAL OBSERVATION CREATION
  // ==========================================

  async createObservation(
    userId: string,
    dto: CreateLongitudinalObservationDto,
  ): Promise<LongitudinalObservationDto> {
    const obs = await this.reflectionRepo.createObservation({
      userId,
      category: dto.category,
      title: dto.title,
      fact: dto.fact,
      interpretation: dto.interpretation,
      supportingEvidence: dto.supportingEvidence as unknown as any,
      timeWindowStart: new Date(dto.timeWindowStart),
      timeWindowEnd: new Date(dto.timeWindowEnd),
      windowDays: dto.windowDays,
      confidence: dto.confidence,
      confidenceType: dto.confidenceType,
      status: 'active',
      surfacedCount: 0,
    });

    await this.eventPublisher.publish({
      userId,
      eventType: 'LongitudinalObservationCreated',
      aggregateType: 'longitudinal_observation',
      aggregateId: obs.id,
      payload: {
        category: obs.category,
        title: obs.title,
        fact: obs.fact,
        interpretation: obs.interpretation,
      },
    });

    return this.mapToDto(obs);
  }

  // ==========================================
  // FEEDBACK LIFECYCLE (Confirm, Correct, Dismiss)
  // ==========================================

  async confirmObservation(
    userId: string,
    id: string,
  ): Promise<LongitudinalObservationDto> {
    const existing = await this.reflectionRepo.findObservationById(userId, id);
    if (!existing) {
      throw new NotFoundException(`Longitudinal observation ${id} not found`);
    }

    const updated = await this.reflectionRepo.updateObservation(userId, id, {
      status: 'confirmed',
      confirmedAt: new Date(),
    });

    if (!updated) {
      throw new NotFoundException(`Observation ${id} could not be updated`);
    }

    await this.eventPublisher.publish({
      userId,
      eventType: 'LongitudinalObservationConfirmed',
      aggregateType: 'longitudinal_observation',
      aggregateId: id,
      payload: {
        title: updated.title,
        category: updated.category,
      },
    });

    return this.mapToDto(updated);
  }

  async correctObservation(
    userId: string,
    id: string,
    dto: CorrectObservationRequestDto,
  ): Promise<LongitudinalObservationDto> {
    const existing = await this.reflectionRepo.findObservationById(userId, id);
    if (!existing) {
      throw new NotFoundException(`Longitudinal observation ${id} not found`);
    }

    if (!dto.correctionNotes || !dto.correctionNotes.trim()) {
      throw new BadRequestException('Correction notes are required');
    }

    const updated = await this.reflectionRepo.updateObservation(userId, id, {
      status: 'corrected',
      correctedAt: new Date(),
      userCorrectionNotes: dto.correctionNotes.trim(),
    });

    if (!updated) {
      throw new NotFoundException(`Observation ${id} could not be updated`);
    }

    await this.eventPublisher.publish({
      userId,
      eventType: 'LongitudinalObservationCorrected',
      aggregateType: 'longitudinal_observation',
      aggregateId: id,
      payload: {
        title: updated.title,
        category: updated.category,
        correctionNotes: dto.correctionNotes.trim(),
      },
    });

    return this.mapToDto(updated);
  }

  async dismissObservation(
    userId: string,
    id: string,
  ): Promise<LongitudinalObservationDto> {
    const existing = await this.reflectionRepo.findObservationById(userId, id);
    if (!existing) {
      throw new NotFoundException(`Longitudinal observation ${id} not found`);
    }

    const updated = await this.reflectionRepo.updateObservation(userId, id, {
      status: 'dismissed',
      dismissedAt: new Date(),
    });

    if (!updated) {
      throw new NotFoundException(`Observation ${id} could not be updated`);
    }

    await this.eventPublisher.publish({
      userId,
      eventType: 'LongitudinalObservationDismissed',
      aggregateType: 'longitudinal_observation',
      aggregateId: id,
      payload: {
        title: updated.title,
        category: updated.category,
      },
    });

    return this.mapToDto(updated);
  }

  // ==========================================
  // PATTERN GENERATION & SYNTHESIS ENGINE
  // ==========================================

  async generateLongitudinalReflection(
    userId: string,
    windowDays = 14,
    forceRefresh = false,
  ): Promise<ReflectionOverviewDto> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

    // Fetch existing active or confirmed observations to avoid exact duplications
    const existingObs = await this.reflectionRepo.findObservations(userId, {
      status: 'all',
      limit: 100,
    });
    const existingTitles = new Set(
      existingObs
        .filter((o) => o.status === 'active' || o.status === 'confirmed')
        .map((o) => o.title.toLowerCase()),
    );

    const generatedObservations: CreateLongitudinalObservationDto[] = [];

    // -------------------------------------------------------------------------
    // 1. Analyze Study Patterns & Persistence
    // -------------------------------------------------------------------------
    const studySessions = await this.studyRepo.findSessions(userId, undefined, 50);
    const windowSessions = studySessions.filter(
      (s) => s.startedAt && new Date(s.startedAt) >= windowStart,
    );
    const completedSessions = windowSessions.filter((s) => s.status === 'completed');

    if (completedSessions.length >= 2) {
      const totalMinutes = completedSessions.reduce(
        (sum, s) => sum + (s.durationMinutes || 0),
        0,
      );
      const subjectSet = new Set(completedSessions.map((s) => s.subjectName));
      const subjectsStr = Array.from(subjectSet).join(', ');

      const title = `Consistent Study Momentum across ${subjectSet.size} Subject(s)`;
      if (forceRefresh || !existingTitles.has(title.toLowerCase())) {
        const evidence: SupportingEvidenceRef[] = completedSessions.slice(0, 5).map((s) => ({
          sourceType: 'study_sessions',
          entityId: s.id,
          occurredAt: (s.completedAt || s.startedAt || now).toISOString(),
          label: `Study Session: ${s.topicTitle} (${s.durationMinutes || 0} mins)`,
          snippet: s.evidenceNotes || undefined,
        }));

        generatedObservations.push({
          category: 'learning_development',
          title,
          fact: `Completed ${completedSessions.length} study session(s) totaling ${totalMinutes} minute(s) across ${subjectsStr} in the last ${windowDays} days.`,
          interpretation: `Demonstrated focused momentum in learning routines. Deep-work intervals are actively supporting subject retention.`,
          supportingEvidence: evidence,
          timeWindowStart: windowStart.toISOString(),
          timeWindowEnd: now.toISOString(),
          windowDays,
          confidence: 0.88,
          confidenceType: 'inferred_pattern',
        });
      }
    }

    // -------------------------------------------------------------------------
    // 2. Analyze Unresolved Learning Difficulties
    // -------------------------------------------------------------------------
    const difficulties = await this.studyRepo.findDifficulties(userId);
    const activeDifficulties = difficulties.filter(
      (d) => d.status === 'active' || d.status === 'persisting',
    );

    if (activeDifficulties.length > 0 && activeDifficulties[0]) {
      const topDiff = activeDifficulties[0];
      const title = `Persistent Difficulty in ${topDiff.subjectName}: ${topDiff.topicTitle}`;
      if (forceRefresh || !existingTitles.has(title.toLowerCase())) {
        const evidence: SupportingEvidenceRef[] = [
          {
            sourceType: 'learning_difficulties',
            entityId: topDiff.id,
            occurredAt: (topDiff.createdAt || now).toISOString(),
            label: `Difficulty: ${topDiff.description.slice(0, 80)}`,
            snippet: topDiff.description,
          },
        ];

        generatedObservations.push({
          category: 'unresolved_thread',
          title,
          fact: `An active learning difficulty in "${topDiff.topicTitle}" (${topDiff.subjectName}) has remained open since ${new Date(topDiff.createdAt).toLocaleDateString()}.`,
          interpretation: `This concept may require alternative pedagogical angles, architectural diagramming, or a focused review session rather than standard repetition.`,
          supportingEvidence: evidence,
          timeWindowStart: new Date(topDiff.createdAt).toISOString(),
          timeWindowEnd: now.toISOString(),
          windowDays,
          confidence: 0.85,
          confidenceType: 'inferred_pattern',
        });
      }
    }

    // -------------------------------------------------------------------------
    // 3. Analyze Life Tasks & Intentions vs. Outcomes
    // -------------------------------------------------------------------------
    const tasks = await this.lifeContextRepo.findTasks(userId);
    const completedTasks = tasks.filter(
      (t) => t.status === 'completed' && t.updatedAt && new Date(t.updatedAt) >= windowStart,
    );
    const pendingTasks = tasks.filter(
      (t) => t.status === 'todo' || t.status === 'pending' || t.status === 'in_progress',
    );
    const overdueTasks = pendingTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now,
    );

    if (completedTasks.length >= 3) {
      const title = `Task Execution Velocity: ${completedTasks.length} Tasks Completed`;
      if (forceRefresh || !existingTitles.has(title.toLowerCase())) {
        const evidence: SupportingEvidenceRef[] = completedTasks.slice(0, 5).map((t) => ({
          sourceType: 'life_tasks',
          entityId: t.id,
          occurredAt: (t.updatedAt || now).toISOString(),
          label: `Task completed: ${t.title}`,
          snippet: t.description || undefined,
        }));

        generatedObservations.push({
          category: 'progress',
          title,
          fact: `${completedTasks.length} task(s) were successfully resolved and marked complete within the last ${windowDays} days.`,
          interpretation: `High operational execution across day-to-day work items without signs of task abandonment.`,
          supportingEvidence: evidence,
          timeWindowStart: windowStart.toISOString(),
          timeWindowEnd: now.toISOString(),
          windowDays,
          confidence: 0.92,
          confidenceType: 'explicit_statement',
        });
      }
    }

    if (overdueTasks.length >= 2) {
      const title = `Pending Commitments Awaiting Follow-through`;
      if (forceRefresh || !existingTitles.has(title.toLowerCase())) {
        const evidence: SupportingEvidenceRef[] = overdueTasks.slice(0, 5).map((t) => ({
          sourceType: 'life_tasks',
          entityId: t.id,
          occurredAt: (t.dueDate || now).toISOString(),
          label: `Overdue task: ${t.title}`,
          snippet: t.description || undefined,
        }));

        generatedObservations.push({
          category: 'intention_vs_outcome',
          title,
          fact: `${overdueTasks.length} task(s) have passed their scheduled target date and remain incomplete.`,
          interpretation: `Workload capacity or unexpected competing priorities may have displaced these scheduled items. Reviewing scope or re-prioritizing deadlines may be warranted.`,
          supportingEvidence: evidence,
          timeWindowStart: windowStart.toISOString(),
          timeWindowEnd: now.toISOString(),
          windowDays,
          confidence: 0.86,
          confidenceType: 'inferred_pattern',
        });
      }
    }

    // -------------------------------------------------------------------------
    // 4. Analyze Commitments
    // -------------------------------------------------------------------------
    const commitments = await this.lifeContextRepo.findCommitments(userId);
    const fulfilledCommitments = commitments.filter((c) => c.status === 'fulfilled');

    if (fulfilledCommitments.length >= 1) {
      const title = `Fulfillment of High-Priority Commitments`;
      if (forceRefresh || !existingTitles.has(title.toLowerCase())) {
        const evidence: SupportingEvidenceRef[] = fulfilledCommitments.slice(0, 3).map((c) => ({
          sourceType: 'life_commitments',
          entityId: c.id,
          occurredAt: (c.updatedAt || now).toISOString(),
          label: `Commitment fulfilled: ${c.title}`,
        }));

        generatedObservations.push({
          category: 'decision_follow_up',
          title,
          fact: `${fulfilledCommitments.length} key personal/professional commitment(s) were recorded as fulfilled.`,
          interpretation: `Direct alignment between stated intent and recorded follow-through on explicit obligations.`,
          supportingEvidence: evidence,
          timeWindowStart: windowStart.toISOString(),
          timeWindowEnd: now.toISOString(),
          windowDays,
          confidence: 0.9,
          confidenceType: 'explicit_statement',
        });
      }
    }

    // -------------------------------------------------------------------------
    // 5. Analyze Career Mock Evaluations (if career module is active)
    // -------------------------------------------------------------------------
    if (this.careerRepo) {
      const evaluations = await this.careerRepo.listEvaluationSessions(userId, 10);
      const windowEvals = evaluations.filter(
        (e) => e.status === 'completed' && e.createdAt && new Date(e.createdAt) >= windowStart,
      );

      if (windowEvals.length >= 1) {
        const title = `Career Interview Readiness Validation`;
        if (forceRefresh || !existingTitles.has(title.toLowerCase())) {
          const evidence: SupportingEvidenceRef[] = windowEvals.slice(0, 3).map((e) => ({
            sourceType: 'career_evaluations',
            entityId: e.id,
            occurredAt: (e.createdAt || now).toISOString(),
            label: `Mock Interview: ${e.targetRole?.title || 'Target Role'} (${e.overallScore || 'N/A'}/100)`,
            snippet: e.summary || undefined,
          }));

          generatedObservations.push({
            category: 'career_development',
            title,
            fact: `Completed ${windowEvals.length} technical mock evaluation session(s) in the last ${windowDays} days.`,
            interpretation: `Proactive engagement with interview simulation validates technical communication under realistic conditions.`,
            supportingEvidence: evidence,
            timeWindowStart: windowStart.toISOString(),
            timeWindowEnd: now.toISOString(),
            windowDays,
            confidence: 0.89,
            confidenceType: 'explicit_statement',
          });
        }
      }
    }

    // Persist newly generated observations
    for (const newObs of generatedObservations) {
      await this.createObservation(userId, newObs);
    }

    // Persist snapshot record
    const progressList = await this.gatherRecentProgress(userId, windowStart);
    const unresolvedList = await this.gatherUnresolvedThreads(userId);
    const intentionsList = await this.gatherIntentionsAndOutcomes(userId, windowStart);

    await this.reflectionRepo.createSnapshot({
      userId,
      windowDays,
      summary: `Longitudinal analysis over ${windowDays} days: ${generatedObservations.length} new observation(s) identified, ${progressList.length} progress item(s), ${unresolvedList.length} unresolved thread(s).`,
      progressItems: progressList as any,
      unresolvedItems: unresolvedList as any,
      intentionsAndOutcomes: intentionsList as any,
    });

    return this.getOverview(userId, windowDays);
  }

  // ==========================================
  // CONTEXT ASSEMBLY INTEGRATION
  // ==========================================

  async getAssembledLongitudinalContext(
    userId: string,
  ): Promise<LongitudinalContextFrameDto> {
    try {
      const activeAndConfirmed =
        await this.reflectionRepo.findActiveAndConfirmedObservations(userId, 8);
      const recentCorrections =
        await this.reflectionRepo.findRecentCorrections(userId, 5);
      const unresolvedThreads = await this.gatherUnresolvedThreads(userId);

      // Separate confirmed insights from active provisional observations
      const confirmedInsights = activeAndConfirmed
        .filter((o) => o.status === 'confirmed')
        .map((o) => `${o.title}: ${o.fact}`);

      const activeObservations = activeAndConfirmed
        .filter((o) => o.status === 'active')
        .map((o) => ({
          category: o.category as ObservationCategory,
          fact: o.fact,
          interpretation: o.interpretation,
          confidence: o.confidence,
        }));

      // Gather user corrections & advice to avoid
      const userCorrectionsDto = recentCorrections.map((o) => ({
        observationTitle: o.title,
        correctionNotes: o.userCorrectionNotes || 'User noted this was inaccurate',
      }));

      const adviceToAvoid = recentCorrections
        .filter((o) => o.userCorrectionNotes)
        .map(
          (o) =>
            `Do NOT assume: "${o.title}". User explicit correction: "${o.userCorrectionNotes}"`,
        );

      // Touch surfaced counts for retrieved observations
      if (activeAndConfirmed.length > 0) {
        await this.reflectionRepo.touchObservationsSurfaced(
          userId,
          activeAndConfirmed.map((o) => o.id),
        );
      }

      return {
        confirmedInsights,
        activeObservations,
        recentUserCorrections: userCorrectionsDto,
        unresolvedThreads: unresolvedThreads.slice(0, 5),
        adviceToAvoid,
      };
    } catch (err) {
      this.logger.error(
        `Failed to assemble longitudinal context for user ${userId}: ${(err as Error).message}`,
      );
      // Graceful fallback
      return {
        confirmedInsights: [],
        activeObservations: [],
        recentUserCorrections: [],
        unresolvedThreads: [],
        adviceToAvoid: [],
      };
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private async gatherRecentProgress(
    userId: string,
    windowStart: Date,
  ): Promise<string[]> {
    const progress: string[] = [];

    // Study sessions
    const sessions = await this.studyRepo.findSessions(userId, undefined, 20);
    const completedSessions = sessions.filter(
      (s) => s.status === 'completed' && s.startedAt && new Date(s.startedAt) >= windowStart,
    );
    if (completedSessions.length > 0) {
      const totalMinutes = completedSessions.reduce(
        (sum, s) => sum + (s.durationMinutes || 0),
        0,
      );
      progress.push(
        `Completed ${completedSessions.length} study session(s) (${totalMinutes} mins total) since ${windowStart.toLocaleDateString()}`,
      );
    }

    // Tasks completed
    const tasks = await this.lifeContextRepo.findTasks(userId);
    const completedTasks = tasks.filter(
      (t) => t.status === 'completed' && t.updatedAt && new Date(t.updatedAt) >= windowStart,
    );
    if (completedTasks.length > 0 && completedTasks[0]) {
      progress.push(
        `Completed ${completedTasks.length} task(s) including "${completedTasks[0].title}"`,
      );
    }

    // Commitments fulfilled
    const commitments = await this.lifeContextRepo.findCommitments(userId);
    const fulfilledCommitments = commitments.filter(
      (c) => c.status === 'fulfilled' && c.updatedAt && new Date(c.updatedAt) >= windowStart,
    );
    if (fulfilledCommitments.length > 0) {
      progress.push(
        `Fulfilled ${fulfilledCommitments.length} personal commitment(s)`,
      );
    }

    return progress;
  }

  private async gatherUnresolvedThreads(userId: string): Promise<string[]> {
    const threads: string[] = [];

    // Learning difficulties
    const difficulties = await this.studyRepo.findDifficulties(userId);
    const activeDiffs = difficulties.filter(
      (d) => d.status === 'active' || d.status === 'persisting',
    );
    for (const d of activeDiffs.slice(0, 3)) {
      threads.push(
        `Learning difficulty in ${d.subjectName}: "${d.topicTitle}" - ${(d.description || '').slice(0, 60)}...`,
      );
    }

    // Overdue tasks
    const tasks = await this.lifeContextRepo.findTasks(userId);
    const overdue = tasks.filter(
      (t) =>
        (t.status === 'todo' || t.status === 'pending' || t.status === 'in_progress') &&
        t.dueDate &&
        new Date(t.dueDate) < new Date(),
    );
    for (const t of overdue.slice(0, 3)) {
      threads.push(
        `Overdue task: "${t.title}" (target was ${new Date(t.dueDate!).toLocaleDateString()})`,
      );
    }

    return threads;
  }

  private async gatherIntentionsAndOutcomes(
    userId: string,
    windowStart: Date,
  ): Promise<IntentionOutcomeComparisonDto[]> {
    const comparisons: IntentionOutcomeComparisonDto[] = [];
    const now = new Date();

    // Life Tasks comparisons
    const tasks = await this.lifeContextRepo.findTasks(userId);
    const relevantTasks = tasks.filter(
      (t) => t.createdAt && new Date(t.createdAt) >= windowStart,
    );

    for (const t of relevantTasks.slice(0, 10)) {
      let outcome: 'completed' | 'postponed' | 'missed' | 'unresolved' = 'unresolved';
      if (t.status === 'completed') {
        outcome = 'completed';
      } else if (t.dueDate && new Date(t.dueDate) < now) {
        outcome = 'missed';
      } else if (t.status === 'cancelled') {
        outcome = 'missed';
      } else {
        outcome = 'unresolved';
      }

      comparisons.push({
        id: `task-${t.id}`,
        intention: t.title,
        sourceEntity: 'life_task',
        entityId: t.id,
        statedAt: (t.createdAt || now).toISOString(),
        outcome,
        recordedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
        evidenceSnippet: t.description || `Task status: ${t.status}`,
      });
    }

    // Life Commitments comparisons
    const commitments = await this.lifeContextRepo.findCommitments(userId);
    for (const c of commitments.slice(0, 5)) {
      let outcome: 'completed' | 'postponed' | 'missed' | 'unresolved' = 'unresolved';
      if (c.status === 'fulfilled') {
        outcome = 'completed';
      } else if (c.status === 'missed' || (c as any).status === 'broken') {
        outcome = 'missed';
      } else if (c.status === 'rescheduled') {
        outcome = 'postponed';
      } else if (c.dueAt && new Date(c.dueAt) < now) {
        outcome = 'postponed';
      }

      comparisons.push({
        id: `commitment-${c.id}`,
        intention: c.title,
        sourceEntity: 'life_commitment',
        entityId: c.id,
        statedAt: (c.createdAt || now).toISOString(),
        outcome,
        recordedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
        evidenceSnippet: `Commitment status: ${c.status}`,
      });
    }

    return comparisons;
  }

  private mapToDto(obs: LongitudinalObservation): LongitudinalObservationDto {
    return {
      id: obs.id,
      userId: obs.userId,
      category: obs.category as ObservationCategory,
      title: obs.title,
      fact: obs.fact,
      interpretation: obs.interpretation,
      supportingEvidence: (obs.supportingEvidence as SupportingEvidenceRef[]) || [],
      timeWindowStart: new Date(obs.timeWindowStart).toISOString(),
      timeWindowEnd: new Date(obs.timeWindowEnd).toISOString(),
      windowDays: obs.windowDays,
      confidence: obs.confidence,
      confidenceType: obs.confidenceType as any,
      status: obs.status as any,
      userCorrectionNotes: obs.userCorrectionNotes,
      confirmedAt: obs.confirmedAt ? new Date(obs.confirmedAt).toISOString() : null,
      correctedAt: obs.correctedAt ? new Date(obs.correctedAt).toISOString() : null,
      dismissedAt: obs.dismissedAt ? new Date(obs.dismissedAt).toISOString() : null,
      surfacedCount: obs.surfacedCount,
      lastSurfacedAt: obs.lastSurfacedAt
        ? new Date(obs.lastSurfacedAt).toISOString()
        : null,
      createdAt: new Date(obs.createdAt).toISOString(),
      updatedAt: new Date(obs.updatedAt).toISOString(),
    };
  }
}
