import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  StartMockSessionRequestDto,
  SubmitEvaluationAnswerRequestDto,
  MockEvaluationSessionDto,
  MockEvaluationType,
  EvaluationDifficulty,
  EvaluationDimensionRating,
} from '@niva/shared-types';
import { CareerRepository } from './career.repository';
import { CareerIntelligenceService } from './career-intelligence.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { EventPublisherService } from '../events/event-publisher.service';

const RATING_SCORE_MAP: Record<EvaluationDimensionRating, number> = {
  strong: 95,
  adequate: 75,
  developing: 50,
  insufficient: 25,
};

@Injectable()
export class CareerEvaluationService {
  private readonly logger = new Logger(CareerEvaluationService.name);

  constructor(
    private readonly careerRepo: CareerRepository,
    private readonly careerIntelligence: CareerIntelligenceService,
    private readonly aiGateway: AiGatewayService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  /**
   * Starts a new mock evaluation session or recovers an existing active session.
   */
  async startSession(
    userId: string,
    dto: StartMockSessionRequestDto,
  ): Promise<MockEvaluationSessionDto> {
    // 1. Session recovery check: if active session exists, return it to prevent duplicate sessions
    const existingActive = await this.careerRepo.findActiveEvaluationSession(userId);
    if (existingActive) {
      this.logger.log(`[User ${userId}] Active session ${existingActive.id} recovered`);
      return this.getSession(existingActive.id, userId);
    }

    // 2. Resolve Target Role
    const targetRole = dto.targetRoleId
      ? await this.careerRepo.findTargetRoleById(dto.targetRoleId, userId)
      : await this.careerRepo.findPrimaryTargetRole(userId);

    if (!targetRole) {
      throw new BadRequestException('A valid target role is required to conduct a mock evaluation.');
    }

    // 3. Resolve Target Skill
    let targetSkill = dto.skillId
      ? await this.careerRepo.findSkillById(dto.skillId)
      : null;

    if (!targetSkill) {
      // Pick top critical gap skill from gap analysis
      const gapAnalysis = await this.careerIntelligence.evaluateGapAnalysis(userId, targetRole.id);
      if (gapAnalysis.gaps.length > 0) {
        const topGap = gapAnalysis.gaps[0]!;
        targetSkill = await this.careerRepo.findSkillById(topGap.skillId);
      }
    }

    const evaluationType: MockEvaluationType = dto.evaluationType || 'technical';
    const initialDifficulty: EvaluationDifficulty = dto.initialDifficulty || 'intermediate';
    const totalPlanned = Math.min(Math.max(dto.totalPlannedQuestions || 3, 1), 10);

    // 4. Create Evaluation Session in DB
    const session = await this.careerRepo.createEvaluationSession({
      userId,
      targetRoleId: targetRole.id,
      skillId: targetSkill?.id || null,
      evaluationType,
      status: 'in_progress',
      currentDifficulty: initialDifficulty,
      currentQuestionIndex: 1,
      totalPlannedQuestions: totalPlanned,
      startedAt: new Date(),
    });

    // 5. Generate Question 1 via AI Gateway
    const questionResponse = await this.aiGateway.generateInterviewQuestion({
      targetRole: {
        title: targetRole.title,
        seniorityLevel: targetRole.seniorityLevel,
        roleFamily: targetRole.roleFamily,
      },
      skill: {
        name: targetSkill?.name || 'Systems Architecture & Problem Solving',
        category: (targetSkill?.category as string) || 'core_technical',
      },
      sessionType: evaluationType,
      difficulty: initialDifficulty,
      questionNumber: 1,
      totalQuestions: totalPlanned,
      relevantContext: targetRole.description ? [targetRole.description] : [],
    });

    // 6. Persist Question 1
    const savedQuestion = await this.careerRepo.createEvaluationQuestion({
      sessionId: session.id,
      userId,
      sequenceNumber: 1,
      questionText: questionResponse.questionText,
      difficulty: questionResponse.difficulty,
      targetedSkill: questionResponse.targetedSkill,
      contextRationale: questionResponse.contextRationale,
    });

    return {
      id: session.id,
      userId: session.userId,
      targetRoleId: targetRole.id,
      targetRoleTitle: targetRole.title,
      skillId: targetSkill?.id || null,
      skillName: targetSkill?.name || null,
      evaluationType: session.evaluationType as MockEvaluationType,
      status: session.status as any,
      currentDifficulty: session.currentDifficulty as EvaluationDifficulty,
      currentQuestionIndex: session.currentQuestionIndex,
      totalPlannedQuestions: session.totalPlannedQuestions,
      overallRating: null,
      overallScore: null,
      summary: null,
      startedAt: session.startedAt.toISOString(),
      completedAt: null,
      questions: [
        {
          id: savedQuestion.id,
          sessionId: session.id,
          sequenceNumber: savedQuestion.sequenceNumber,
          questionText: savedQuestion.questionText,
          difficulty: savedQuestion.difficulty as EvaluationDifficulty,
          targetedSkill: savedQuestion.targetedSkill,
          contextRationale: savedQuestion.contextRationale,
          answer: null,
          createdAt: savedQuestion.createdAt.toISOString(),
        },
      ],
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves active in-progress session for recovery.
   */
  async getActiveSession(userId: string): Promise<MockEvaluationSessionDto | null> {
    const session = await this.careerRepo.findActiveEvaluationSession(userId);
    if (!session) return null;
    return this.getSession(session.id, userId);
  }

  /**
   * Retrieves full session details by ID.
   */
  async getSession(id: string, userId: string): Promise<MockEvaluationSessionDto> {
    const full = await this.careerRepo.findFullSessionDetails(id, userId);
    if (!full) {
      throw new NotFoundException(`Evaluation session ${id} not found or access denied.`);
    }

    const { session, targetRole, skill, questions } = full;

    return {
      id: session.id,
      userId: session.userId,
      targetRoleId: session.targetRoleId,
      targetRoleTitle: targetRole?.title || 'Target Role',
      skillId: session.skillId || null,
      skillName: skill?.name || null,
      evaluationType: session.evaluationType as MockEvaluationType,
      status: session.status as any,
      currentDifficulty: session.currentDifficulty as EvaluationDifficulty,
      currentQuestionIndex: session.currentQuestionIndex,
      totalPlannedQuestions: session.totalPlannedQuestions,
      overallRating: (session.overallRating as EvaluationDimensionRating) || null,
      overallScore: session.overallScore,
      summary: session.summary,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt ? session.completedAt.toISOString() : null,
      questions: questions.map((q) => ({
        id: q.id,
        sessionId: q.sessionId,
        sequenceNumber: q.sequenceNumber,
        questionText: q.questionText,
        difficulty: q.difficulty as EvaluationDifficulty,
        targetedSkill: q.targetedSkill,
        contextRationale: q.contextRationale,
        answer: q.answer
          ? {
              id: q.answer.id,
              questionId: q.answer.questionId,
              sessionId: q.answer.sessionId,
              userId: q.answer.userId,
              answerText: q.answer.answerText,
              evaluationStatus: q.answer.evaluationStatus as any,
              overallRating: q.answer.overallRating as any,
              evaluation: {
                overallRating: q.answer.overallRating as any,
                dimensions: (q.answer.dimensions as any) || [],
                strengths: (q.answer.strengths as string[]) || [],
                gaps: (q.answer.gaps as string[]) || [],
                followUpNeeded: q.answer.followUpNeeded,
                suggestedNextDifficulty: (q.answer.suggestedNextDifficulty as any) || 'intermediate',
                feedbackNotes: q.answer.feedbackNotes || '',
              },
              evaluatedAt: q.answer.evaluatedAt ? q.answer.evaluatedAt.toISOString() : null,
              createdAt: q.answer.createdAt.toISOString(),
            }
          : null,
        createdAt: q.createdAt.toISOString(),
      })),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  /**
   * Submits an answer for the current question in an evaluation session.
   * Evaluates the answer, persists structured feedback, and adaptively advances question.
   */
  async submitAnswer(
    sessionId: string,
    userId: string,
    dto: SubmitEvaluationAnswerRequestDto,
  ): Promise<MockEvaluationSessionDto> {
    const session = await this.careerRepo.findEvaluationSessionById(sessionId, userId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    if (session.status !== 'in_progress') {
      throw new BadRequestException(`Cannot submit answers to a session with status '${session.status}'`);
    }

    const trimmedAnswer = dto.answerText.trim();
    if (!trimmedAnswer) {
      throw new BadRequestException('Answer text cannot be empty');
    }

    // 1. Find all questions and existing answers
    const questions = await this.careerRepo.findEvaluationQuestions(sessionId);
    const answers = await this.careerRepo.findEvaluationAnswers(sessionId);
    const answeredQuestionIds = new Set(answers.map((a) => a.questionId));

    // Find the current unanswered question
    const currentQuestion = questions.find((q) => !answeredQuestionIds.has(q.id));
    if (!currentQuestion) {
      throw new BadRequestException('All questions for this session have already been answered.');
    }

    // 2. Persist answer record immediately in 'pending' status (Failure-handling invariant)
    const answerRecord = await this.careerRepo.createEvaluationAnswer({
      questionId: currentQuestion.id,
      sessionId,
      userId,
      answerText: trimmedAnswer,
      evaluationStatus: 'pending',
    });

    const targetRole = await this.careerRepo.findTargetRoleById(session.targetRoleId, userId);
    const skill = session.skillId ? await this.careerRepo.findSkillById(session.skillId) : null;

    // 3. Evaluate answer via AI Gateway
    let evalResult;
    try {
      evalResult = await this.aiGateway.evaluateInterviewAnswer({
        targetRole: {
          title: targetRole?.title || 'Software Engineer',
          seniorityLevel: targetRole?.seniorityLevel || 'senior',
        },
        skill: {
          name: currentQuestion.targetedSkill,
        },
        sessionType: session.evaluationType as MockEvaluationType,
        difficulty: currentQuestion.difficulty as EvaluationDifficulty,
        questionText: currentQuestion.questionText,
        userAnswer: trimmedAnswer,
      });

      // Update answer record with structured evaluation
      await this.careerRepo.updateEvaluationAnswer(answerRecord.id, {
        evaluationStatus: 'evaluated',
        overallRating: evalResult.overallRating,
        dimensions: evalResult.dimensions,
        strengths: evalResult.strengths,
        gaps: evalResult.gaps,
        followUpNeeded: evalResult.followUpNeeded,
        suggestedNextDifficulty: evalResult.suggestedNextDifficulty,
        feedbackNotes: evalResult.feedbackNotes,
        evaluatedAt: new Date(),
      });
    } catch (err: any) {
      this.logger.error(`AI answer evaluation failed: ${err.message}`);
      await this.careerRepo.updateEvaluationAnswer(answerRecord.id, {
        evaluationStatus: 'failed',
        feedbackNotes: 'Automated evaluation temporarily unavailable. Answer safely preserved.',
      });
      throw err;
    }

    // 4. Adaptive Progression: determine if more questions needed
    const answeredCount = answers.length + 1;
    if (answeredCount < session.totalPlannedQuestions) {
      // Advance to next question!
      // Adaptive difficulty calculation:
      let nextDifficulty: EvaluationDifficulty = session.currentDifficulty as EvaluationDifficulty;
      if (evalResult.overallRating === 'strong') {
        if (session.currentDifficulty === 'foundation') nextDifficulty = 'intermediate';
        else if (session.currentDifficulty === 'intermediate') nextDifficulty = 'advanced';
      } else if (evalResult.overallRating === 'insufficient') {
        if (session.currentDifficulty === 'advanced') nextDifficulty = 'intermediate';
        else if (session.currentDifficulty === 'intermediate') nextDifficulty = 'foundation';
      }

      // Collect previous turns for context grounding
      const previousTurns = [
        ...answers.map((a) => {
          const q = questions.find((ques) => ques.id === a.questionId);
          return {
            question: q?.questionText || '',
            answer: a.answerText,
            rating: a.overallRating || 'adequate',
          };
        }),
        {
          question: currentQuestion.questionText,
          answer: trimmedAnswer,
          rating: evalResult.overallRating,
        },
      ];

      const nextQuestionIndex = session.currentQuestionIndex + 1;

      // Generate next question via AI Gateway
      const nextQResponse = await this.aiGateway.generateInterviewQuestion({
        targetRole: {
          title: targetRole?.title || 'Software Engineer',
          seniorityLevel: targetRole?.seniorityLevel || 'senior',
          roleFamily: targetRole?.roleFamily || 'software_engineering',
        },
        skill: {
          name: skill?.name || currentQuestion.targetedSkill,
          category: (skill?.category as string) || 'core_technical',
        },
        sessionType: session.evaluationType as MockEvaluationType,
        difficulty: nextDifficulty,
        questionNumber: nextQuestionIndex,
        totalQuestions: session.totalPlannedQuestions,
        previousTurns,
      });

      // Save next question
      await this.careerRepo.createEvaluationQuestion({
        sessionId,
        userId,
        sequenceNumber: nextQuestionIndex,
        questionText: nextQResponse.questionText,
        difficulty: nextDifficulty,
        targetedSkill: nextQResponse.targetedSkill,
        contextRationale: nextQResponse.contextRationale,
      });

      // Update session state
      await this.careerRepo.updateEvaluationSession(sessionId, userId, {
        currentQuestionIndex: nextQuestionIndex,
        currentDifficulty: nextDifficulty,
      });
    } else {
      // 5. Session Complete! Compute final aggregate ratings and summary
      const allAnswers = await this.careerRepo.findEvaluationAnswers(sessionId);
      const ratings = allAnswers.map((a) => (a.overallRating as EvaluationDimensionRating) || 'adequate');

      let totalScore = 0;
      for (const r of ratings) {
        totalScore += RATING_SCORE_MAP[r] || 75;
      }
      const overallScore = Math.round(totalScore / ratings.length);

      let finalRating: EvaluationDimensionRating = 'adequate';
      if (overallScore >= 85) finalRating = 'strong';
      else if (overallScore >= 70) finalRating = 'adequate';
      else if (overallScore >= 45) finalRating = 'developing';
      else finalRating = 'insufficient';

      const summaryText =
        `Completed ${session.totalPlannedQuestions}-question mock evaluation for ${targetRole?.title || 'target role'}. ` +
        `Final demonstrated performance: ${finalRating.toUpperCase()} (${overallScore}/100).`;

      await this.careerRepo.updateEvaluationSession(sessionId, userId, {
        status: 'completed',
        overallRating: finalRating,
        overallScore,
        summary: summaryText,
        completedAt: new Date(),
      });

      // 6. Evidence Update (Requirement 15)
      // When demonstrated competency is strong or adequate, generate verified evidence artifact
      if (finalRating === 'strong' || finalRating === 'adequate') {
        // Ensure user_skills record exists
        let userSkill = await this.careerRepo.findUserSkill(userId, session.skillId || '');
        if (!userSkill && session.skillId) {
          userSkill = await this.careerRepo.createUserSkill({
            userId,
            skillId: session.skillId,
            selfRating: session.currentDifficulty === 'advanced' ? 'advanced' : 'intermediate',
            confidenceScore: overallScore,
          });
        }

        if (userSkill) {
          await this.careerRepo.addSkillEvidence({
            userSkillId: userSkill.id,
            userId,
            evidenceType: 'mock_interview_score',
            title: `Mock Evaluation: ${skill?.name || currentQuestion.targetedSkill}`,
            description: `Validated ${finalRating} competency through ${session.totalPlannedQuestions}-question interactive mock evaluation session (Score: ${overallScore}/100).`,
            url: `evaluation://session/${sessionId}`,
            validationStatus: 'validated_by_niva',
            verifiedAt: new Date(),
          });
        }

        // Log preparation activity
        await this.careerRepo.createPreparationActivity({
          userId,
          targetRoleId: session.targetRoleId,
          skillId: session.skillId || null,
          activityType: 'mock_interview',
          title: `Completed Mock ${session.evaluationType.toUpperCase()} Round`,
          status: 'completed',
          performanceScore: overallScore,
          outcomeNotes: summaryText,
          completedAt: new Date(),
        });

        // Trigger fresh gap analysis evaluation to reflect new evidence immediately
        await this.careerIntelligence.evaluateGapAnalysis(userId, session.targetRoleId);

        // Publish event
        await this.eventPublisher.publish({
          userId,
          eventType: 'PreparationActivityCompleted',
          aggregateType: 'preparation_activity',
          aggregateId: sessionId,
          payload: {
            sessionId,
            activityType: 'mock_interview',
            score: overallScore,
            rating: finalRating,
          },
        });
      }
    }

    return this.getSession(sessionId, userId);
  }

  /**
   * Cancels / abandons an in-progress session.
   */
  async cancelSession(sessionId: string, userId: string): Promise<MockEvaluationSessionDto> {
    const session = await this.careerRepo.findEvaluationSessionById(sessionId, userId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    await this.careerRepo.updateEvaluationSession(sessionId, userId, {
      status: 'abandoned',
      completedAt: new Date(),
    });

    return this.getSession(sessionId, userId);
  }

  /**
   * Lists past evaluation sessions for the user.
   */
  async listSessions(userId: string): Promise<MockEvaluationSessionDto[]> {
    const sessions = await this.careerRepo.listEvaluationSessions(userId);
    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      targetRoleId: s.targetRoleId,
      targetRoleTitle: s.targetRole?.title || 'Target Role',
      skillId: s.skillId || null,
      skillName: s.skill?.name || null,
      evaluationType: s.evaluationType as MockEvaluationType,
      status: s.status as any,
      currentDifficulty: s.currentDifficulty as EvaluationDifficulty,
      currentQuestionIndex: s.currentQuestionIndex,
      totalPlannedQuestions: s.totalPlannedQuestions,
      overallRating: (s.overallRating as EvaluationDimensionRating) || null,
      overallScore: s.overallScore,
      summary: s.summary,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }
}
