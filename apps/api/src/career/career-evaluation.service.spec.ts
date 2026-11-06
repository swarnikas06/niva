import { Test, TestingModule } from '@nestjs/testing';
import { CareerEvaluationService } from './career-evaluation.service';
import { CareerRepository } from './career.repository';
import { CareerIntelligenceService } from './career-intelligence.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { EventPublisherService } from '../events/event-publisher.service';

describe('CareerEvaluationService', () => {
  let service: CareerEvaluationService;
  let mockCareerRepo: jest.Mocked<Partial<CareerRepository>>;
  let mockIntelligence: jest.Mocked<Partial<CareerIntelligenceService>>;
  let mockAiGateway: jest.Mocked<Partial<AiGatewayService>>;
  let mockEventPublisher: jest.Mocked<Partial<EventPublisherService>>;

  const userId = '11111111-1111-1111-1111-111111111111';
  const sessionId = '22222222-2222-2222-2222-222222222222';
  const roleId = '33333333-3333-3333-3333-333333333333';
  const skillId = '44444444-4444-4444-4444-444444444444';
  const questionId = '55555555-5555-5555-5555-555555555555';

  beforeEach(async () => {
    mockCareerRepo = {
      findActiveEvaluationSession: jest.fn(),
      findEvaluationSessionById: jest.fn(),
      findTargetRoleById: jest.fn(),
      findPrimaryTargetRole: jest.fn(),
      findSkillById: jest.fn(),
      createEvaluationSession: jest.fn(),
      createEvaluationQuestion: jest.fn(),
      findEvaluationQuestions: jest.fn(),
      createEvaluationAnswer: jest.fn(),
      findEvaluationAnswers: jest.fn(),
      updateEvaluationAnswer: jest.fn(),
      updateEvaluationSession: jest.fn(),
      findFullSessionDetails: jest.fn(),
      listEvaluationSessions: jest.fn(),
      findUserSkill: jest.fn(),
      createUserSkill: jest.fn(),
      addSkillEvidence: jest.fn(),
      createPreparationActivity: jest.fn(),
    };

    mockIntelligence = {
      evaluateGapAnalysis: jest.fn(),
    };

    mockAiGateway = {
      generateInterviewQuestion: jest.fn(),
      evaluateInterviewAnswer: jest.fn(),
    };

    mockEventPublisher = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CareerEvaluationService,
        { provide: CareerRepository, useValue: mockCareerRepo },
        { provide: CareerIntelligenceService, useValue: mockIntelligence },
        { provide: AiGatewayService, useValue: mockAiGateway },
        { provide: EventPublisherService, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<CareerEvaluationService>(CareerEvaluationService);
  });

  describe('startSession', () => {
    it('creates a new session and generates question 1 when no active session exists', async () => {
      mockCareerRepo.findActiveEvaluationSession!.mockResolvedValue(null);
      mockCareerRepo.findTargetRoleById!.mockResolvedValue({
        id: roleId,
        userId,
        title: 'Distributed Systems Engineer',
        roleFamily: 'systems_infrastructure',
        seniorityLevel: 'senior',
        priority: 'primary',
      } as any);

      mockCareerRepo.findSkillById!.mockResolvedValue({
        id: skillId,
        name: 'Distributed Consensus',
        category: 'systems_architecture',
      } as any);

      mockCareerRepo.createEvaluationSession!.mockResolvedValue({
        id: sessionId,
        userId,
        targetRoleId: roleId,
        skillId,
        evaluationType: 'technical',
        status: 'in_progress',
        currentDifficulty: 'intermediate',
        currentQuestionIndex: 1,
        totalPlannedQuestions: 3,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      mockAiGateway.generateInterviewQuestion!.mockResolvedValue({
        questionText: 'Explain the Raft consensus leader election protocol.',
        difficulty: 'intermediate',
        targetedSkill: 'Distributed Consensus',
        contextRationale: 'Tests distributed coordination mechanics.',
        provider: 'mock',
        model: 'mock-model',
        latencyMs: 15.0,
      });

      mockCareerRepo.createEvaluationQuestion!.mockResolvedValue({
        id: questionId,
        sessionId,
        userId,
        sequenceNumber: 1,
        questionText: 'Explain the Raft consensus leader election protocol.',
        difficulty: 'intermediate',
        targetedSkill: 'Distributed Consensus',
        contextRationale: 'Tests distributed coordination mechanics.',
        createdAt: new Date(),
      } as any);

      const result = await service.startSession(userId, {
        targetRoleId: roleId,
        skillId,
        evaluationType: 'technical',
        initialDifficulty: 'intermediate',
        totalPlannedQuestions: 3,
      });

      expect(result.id).toBe(sessionId);
      expect(result.status).toBe('in_progress');
      expect(result.currentQuestionIndex).toBe(1);
      expect(result.questions).toHaveLength(1);
      expect(result.questions![0].questionText).toContain('Raft consensus');
    });

    it('recovers active session if one already exists to prevent duplicate sessions', async () => {
      mockCareerRepo.findActiveEvaluationSession!.mockResolvedValue({
        id: sessionId,
        userId,
        status: 'in_progress',
      } as any);

      mockCareerRepo.findFullSessionDetails!.mockResolvedValue({
        session: {
          id: sessionId,
          userId,
          targetRoleId: roleId,
          skillId,
          evaluationType: 'technical',
          status: 'in_progress',
          currentDifficulty: 'intermediate',
          currentQuestionIndex: 1,
          totalPlannedQuestions: 3,
          startedAt: new Date(),
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        targetRole: { id: roleId, title: 'Distributed Systems Engineer' },
        skill: { id: skillId, name: 'Distributed Consensus' },
        questions: [],
      } as any);

      const result = await service.startSession(userId, { targetRoleId: roleId });

      expect(result.id).toBe(sessionId);
      expect(mockCareerRepo.createEvaluationSession).not.toHaveBeenCalled();
    });
  });

  describe('submitAnswer', () => {
    it('evaluates answer and completes session with evidence when all questions are answered', async () => {
      mockCareerRepo.findEvaluationSessionById!.mockResolvedValue({
        id: sessionId,
        userId,
        targetRoleId: roleId,
        skillId,
        evaluationType: 'technical',
        status: 'in_progress',
        currentDifficulty: 'intermediate',
        currentQuestionIndex: 1,
        totalPlannedQuestions: 1, // Final question
        startedAt: new Date(),
      } as any);

      mockCareerRepo.findEvaluationQuestions!.mockResolvedValue([
        {
          id: questionId,
          sessionId,
          userId,
          sequenceNumber: 1,
          questionText: 'Explain the Raft consensus leader election protocol.',
          difficulty: 'intermediate',
          targetedSkill: 'Distributed Consensus',
          contextRationale: null,
          createdAt: new Date(),
        } as any,
      ]);

      mockCareerRepo.findEvaluationAnswers!.mockResolvedValue([]); // Currently unanswered

      mockCareerRepo.createEvaluationAnswer!.mockResolvedValue({
        id: 'ans-1',
        questionId,
        sessionId,
        userId,
        answerText: 'Candidates request votes after randomized election timeout...',
        evaluationStatus: 'pending',
      } as any);

      mockAiGateway.evaluateInterviewAnswer!.mockResolvedValue({
        overallRating: 'strong',
        dimensions: [
          { dimension: 'technical_correctness', rating: 'strong', feedback: 'Accurate protocol description.' },
        ],
        strengths: ['Clear grasp of randomized timers'],
        gaps: [],
        followUpNeeded: false,
        suggestedNextDifficulty: 'advanced',
        feedbackNotes: 'Excellent understanding.',
        evidenceSummary: 'Demonstrated advanced command of Raft consensus.',
        provider: 'mock',
        model: 'mock-model',
        latencyMs: 15.0,
      });

      mockCareerRepo.findEvaluationAnswers!.mockResolvedValueOnce([]) // for unanswered check
        .mockResolvedValueOnce([
          {
            id: 'ans-1',
            questionId,
            overallRating: 'strong',
          } as any,
        ]); // for completion calculation

      mockCareerRepo.findUserSkill!.mockResolvedValue({
        id: 'us-1',
        userId,
        skillId,
      } as any);

      mockCareerRepo.findFullSessionDetails!.mockResolvedValue({
        session: {
          id: sessionId,
          userId,
          targetRoleId: roleId,
          skillId,
          evaluationType: 'technical',
          status: 'completed',
          currentDifficulty: 'intermediate',
          currentQuestionIndex: 1,
          totalPlannedQuestions: 1,
          overallRating: 'strong',
          overallScore: 95,
          summary: 'Completed 1-question mock evaluation.',
          startedAt: new Date(),
          completedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        targetRole: { id: roleId, title: 'Distributed Systems Engineer' },
        skill: { id: skillId, name: 'Distributed Consensus' },
        questions: [],
      } as any);

      const result = await service.submitAnswer(sessionId, userId, {
        answerText: 'Candidates request votes after randomized election timeout...',
      });

      expect(mockCareerRepo.createEvaluationAnswer).toHaveBeenCalled();
      expect(mockCareerRepo.addSkillEvidence).toHaveBeenCalled();
      expect(mockCareerRepo.createPreparationActivity).toHaveBeenCalled();
      expect(mockIntelligence.evaluateGapAnalysis).toHaveBeenCalledWith(userId, roleId);
      expect(result.status).toBe('completed');
    });

    it('safely retains answer when AI evaluation fails', async () => {
      mockCareerRepo.findEvaluationSessionById!.mockResolvedValue({
        id: sessionId,
        userId,
        status: 'in_progress',
      } as any);

      mockCareerRepo.findEvaluationQuestions!.mockResolvedValue([
        { id: questionId, sessionId } as any,
      ]);

      mockCareerRepo.findEvaluationAnswers!.mockResolvedValue([]);

      mockCareerRepo.createEvaluationAnswer!.mockResolvedValue({
        id: 'ans-1',
        questionId,
        sessionId,
      } as any);

      mockAiGateway.evaluateInterviewAnswer!.mockRejectedValue(new Error('AI Gateway Timeout'));

      await expect(
        service.submitAnswer(sessionId, userId, { answerText: 'Some answer text' }),
      ).rejects.toThrow('AI Gateway Timeout');

      expect(mockCareerRepo.createEvaluationAnswer).toHaveBeenCalled();
      expect(mockCareerRepo.updateEvaluationAnswer).toHaveBeenCalledWith(
        'ans-1',
        expect.objectContaining({ evaluationStatus: 'failed' }),
      );
    });
  });
});
