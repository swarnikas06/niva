import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompanionOrchestratorService } from './companion-orchestrator.service';
import { ConversationRepository } from '../conversation/conversation.repository';
import { ContextAssemblyService } from '../context/context-assembly.service';
import { BehavioralSignalsService } from './behavioral-signals.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { CompanionStateRepository } from '../context/companion-state.repository';
import { EventPublisherService } from '../events/event-publisher.service';
import { EventRepository } from '../events/event.repository';
import { ProactivePolicyService } from '../events/proactive/proactive-policy.service';
import { ProactiveMessageService } from '../events/proactive/proactive-message.service';
import { ProactiveDeliveryService } from '../events/proactive/proactive-delivery.service';

describe('CompanionOrchestratorService', () => {
  let service: CompanionOrchestratorService;
  let convRepo: Record<string, jest.Mock>;
  let contextAssemblyService: Record<string, jest.Mock>;
  let behavioralSignalsService: Record<string, jest.Mock>;
  let aiGatewayService: Record<string, jest.Mock>;
  let companionStateRepo: Record<string, jest.Mock>;
  let eventPublisher: Record<string, jest.Mock>;
  let eventRepo: Record<string, jest.Mock>;
  let proactivePolicyService: Record<string, jest.Mock>;
  let proactiveMessageService: Record<string, jest.Mock>;
  let proactiveDeliveryService: Record<string, jest.Mock>;

  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const mockConvId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    convRepo = {
      findConversationById: jest.fn(),
      createMessage: jest.fn(),
    };

    contextAssemblyService = {
      assembleContext: jest.fn(),
    };

    behavioralSignalsService = {
      detectSignals: jest.fn().mockResolvedValue([]),
    };

    aiGatewayService = {
      generateCompanionReply: jest.fn(),
    };

    companionStateRepo = {
      incrementInteractions: jest.fn().mockResolvedValue(undefined),
    };

    eventPublisher = {
      publish: jest.fn().mockResolvedValue({ id: 'mock-event-id' }),
    };

    eventRepo = {
      hasRecentDialogue: jest.fn().mockResolvedValue(false),
    };

    proactivePolicyService = {
      evaluate: jest.fn(),
    };

    proactiveMessageService = {
      synthesizeMessage: jest.fn(),
    };

    proactiveDeliveryService = {
      deliverInAppAction: jest.fn().mockResolvedValue({ id: 'action-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanionOrchestratorService,
        { provide: ConversationRepository, useValue: convRepo },
        { provide: ContextAssemblyService, useValue: contextAssemblyService },
        { provide: BehavioralSignalsService, useValue: behavioralSignalsService },
        { provide: AiGatewayService, useValue: aiGatewayService },
        { provide: CompanionStateRepository, useValue: companionStateRepo },
        { provide: EventPublisherService, useValue: eventPublisher },
        { provide: EventRepository, useValue: eventRepo },
        { provide: ProactivePolicyService, useValue: proactivePolicyService },
        { provide: ProactiveMessageService, useValue: proactiveMessageService },
        { provide: ProactiveDeliveryService, useValue: proactiveDeliveryService },
      ],
    }).compile();

    service = module.get<CompanionOrchestratorService>(CompanionOrchestratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // 1. CONVERSATION TURNS
  // =========================================================================
  describe('orchestrateConversationTurn', () => {
    const now = new Date();

    beforeEach(() => {
      convRepo.findConversationById.mockResolvedValue({
        id: mockConvId,
        userId: mockUserId,
        status: 'active',
      });

      convRepo.createMessage
        .mockResolvedValueOnce({
          id: 'user-msg-1',
          conversationId: mockConvId,
          senderRole: 'user',
          content: 'Hello NIVA',
          sequenceNumber: 1,
          status: 'complete',
          createdAt: now,
          updatedAt: now,
        })
        .mockResolvedValueOnce({
          id: 'asst-msg-1',
          conversationId: mockConvId,
          senderRole: 'assistant',
          content: 'Hello! How can I support you today?',
          sequenceNumber: 2,
          status: 'complete',
          createdAt: now,
          updatedAt: now,
        });

      contextAssemblyService.assembleContext.mockResolvedValue({
        assembledAt: now.toISOString(),
        identity: { displayName: 'User' },
        companion: { name: 'NIVA', interactionMode: 'chat' },
      });

      aiGatewayService.generateCompanionReply.mockResolvedValue({
        content: 'Hello! How can I support you today?',
        provider: 'mock',
        model: 'niva-mock-v1',
        usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
        latencyMs: 40,
        requestId: 'req-1',
      });
    });

    it('should orchestrate conversation turn with default acknowledge mode', async () => {
      const result = await service.orchestrateConversationTurn({
        source: 'conversation',
        userId: mockUserId,
        conversationId: mockConvId,
        message: 'Thinking about our system architecture today',
      });

      expect(result.userMessage.id).toBe('user-msg-1');
      expect(result.assistantMessage.id).toBe('asst-msg-1');
      expect(result.decision?.mode).toBe('acknowledge');
      expect(result.decision?.decision).toBe('respond');
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'UserMessageSent' }),
      );
      expect(companionStateRepo.incrementInteractions).toHaveBeenCalledWith(mockUserId);
    });

    it('should prioritize immediate user utterance intent: study mode', async () => {
      const result = await service.orchestrateConversationTurn({
        source: 'conversation',
        userId: mockUserId,
        conversationId: mockConvId,
        message: 'Can you quiz me on distributed consensus algorithms?',
      });

      expect(result.decision?.mode).toBe('study');
      expect(result.decision?.decision).toBe('respond');
      expect(result.decision?.rationale).toContain('study guidance');
    });

    it('should prioritize immediate user utterance intent: coach mode', async () => {
      const result = await service.orchestrateConversationTurn({
        source: 'conversation',
        userId: mockUserId,
        conversationId: mockConvId,
        message: 'How do I start planning my quarterly milestones? Give me a strategy.',
      });

      expect(result.decision?.mode).toBe('coach');
      expect(result.decision?.decision).toBe('respond');
    });

    it('should prioritize immediate user utterance intent: clarify mode when vague', async () => {
      const result = await service.orchestrateConversationTurn({
        source: 'conversation',
        userId: mockUserId,
        conversationId: mockConvId,
        message: 'what should I do?',
      });

      expect(result.decision?.mode).toBe('clarify');
      expect(result.decision?.decision).toBe('ask');
    });

    it('should trigger constructive challenge mode when repeated postponement is detected', async () => {
      behavioralSignalsService.detectSignals.mockResolvedValue([
        {
          type: 'repeated_postponement',
          count: 3,
          windowDays: 7,
          summary: 'Postponed tasks 3 times within the past 7 days',
        },
      ]);

      const result = await service.orchestrateConversationTurn({
        source: 'conversation',
        userId: mockUserId,
        conversationId: mockConvId,
        message: 'I am thinking of deferring the slide deck again.',
      });

      expect(result.decision?.mode).toBe('challenge');
      expect(result.decision?.decision).toBe('challenge');
      expect(result.decision?.priority).toBe('high');
      expect(result.decision?.rationale).toContain('Repeated postponement detected');
    });

    it('should reject archived conversations', async () => {
      convRepo.findConversationById.mockResolvedValue({
        id: mockConvId,
        userId: mockUserId,
        status: 'archived',
      });

      await expect(
        service.orchestrateConversationTurn({
          source: 'conversation',
          userId: mockUserId,
          conversationId: mockConvId,
          message: 'Hello',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty or whitespace messages', async () => {
      await expect(
        service.orchestrateConversationTurn({
          source: 'conversation',
          userId: mockUserId,
          conversationId: mockConvId,
          message: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should safely retain user message but re-throw if AI generation fails', async () => {
      aiGatewayService.generateCompanionReply.mockRejectedValue(
        new Error('FastAPI Gateway Timeout'),
      );

      await expect(
        service.orchestrateConversationTurn({
          source: 'conversation',
          userId: mockUserId,
          conversationId: mockConvId,
          message: 'Hello NIVA',
        }),
      ).rejects.toThrow('FastAPI Gateway Timeout');

      expect(convRepo.createMessage).toHaveBeenCalledTimes(1); // User message only
    });

    it('should enqueue memory extraction job non-blockingly when memoryService is provided', async () => {
      const mockMemoryService = {
        createExtractionJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
      };

      const orchestratorWithMemory = new CompanionOrchestratorService(
        convRepo as any,
        contextAssemblyService as any,
        behavioralSignalsService as any,
        aiGatewayService as any,
        companionStateRepo as any,
        eventPublisher as any,
        eventRepo as any,
        proactivePolicyService as any,
        proactiveMessageService as any,
        proactiveDeliveryService as any,
        mockMemoryService as any,
      );

      const result = await orchestratorWithMemory.orchestrateConversationTurn({
        source: 'conversation',
        userId: mockUserId,
        conversationId: mockConvId,
        message: 'I really love studying distributed systems in TypeScript.',
      });

      expect(result.assistantMessage).toBeDefined();
      expect(mockMemoryService.createExtractionJob).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          conversationId: mockConvId,
          messageId: 'user-msg-1',
          turnContext: expect.objectContaining({
            userMessage: 'I really love studying distributed systems in TypeScript.',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // 1B. CONVERSATIONAL INTENT & DECISION ENGINE
  // =========================================================================
  describe('determineConversationalDecision', () => {
    const mockContextFrame: any = {
      companion: { interactionMode: 'chat' },
    };

    it('should select greeting mode for casual greetings without unsolicited task pressure', () => {
      const greetings = ['Heyy', 'hi niva', 'Hello', 'Good morning', 'what\'s up'];
      for (const g of greetings) {
        const decision = service.determineConversationalDecision(g, [], mockContextFrame);
        expect(decision.mode).toBe('greeting');
        expect(decision.decision).toBe('respond');
        expect(decision.rationale).toContain('Casual conversational greeting');
      }
    });

    it('should prioritize emotional_support mode for fatigue and overwhelm', () => {
      const fatigueMessages = [
        "I'm exhausted today",
        'feeling burnt out with everything',
        'I am overwhelmed',
        'rough day today',
      ];
      for (const m of fatigueMessages) {
        const decision = service.determineConversationalDecision(m, [], mockContextFrame);
        expect(decision.mode).toBe('emotional_support');
        expect(decision.priority).toBe('high');
        expect(decision.rationale).toContain('emotional fatigue');
      }
    });

    it('should prioritize deadline_triage mode for urgent deadlines and panic', () => {
      const deadlineMessages = [
        'My exam is on monday and I haven\'t started studying',
        'deadline tomorrow and I have so much left',
        'panicking about my deadline tonight',
      ];
      for (const m of deadlineMessages) {
        const decision = service.determineConversationalDecision(m, [], mockContextFrame);
        expect(decision.mode).toBe('deadline_triage');
        expect(decision.priority).toBe('high');
        expect(decision.rationale).toContain('Urgent deadline pressure');
      }
    });

    it('should prioritize encourage mode when a task completion action was executed', () => {
      const frameWithCompletedAction: any = {
        companion: { interactionMode: 'chat' },
        executedActions: [
          {
            actionType: 'task_completed',
            status: 'success',
            title: 'Complete Assignment',
            message: 'Marked Complete Assignment as completed.',
          },
        ],
      };

      const decision = service.determineConversationalDecision(
        'I finished the assignment',
        [],
        frameWithCompletedAction,
      );

      expect(decision.mode).toBe('encourage');
      expect(decision.decision).toBe('encourage');
      expect(decision.rationale).toContain('completed an active task');
    });

    it('should prioritize acknowledge mode when a task creation action was executed', () => {
      const frameWithCreatedAction: any = {
        companion: { interactionMode: 'chat' },
        executedActions: [
          {
            actionType: 'task_created',
            status: 'success',
            title: 'Prepare presentation',
            message: 'Created task Prepare presentation.',
          },
        ],
      };

      const decision = service.determineConversationalDecision(
        'Add task: Prepare presentation',
        [],
        frameWithCreatedAction,
      );

      expect(decision.mode).toBe('acknowledge');
      expect(decision.decision).toBe('respond');
      expect(decision.rationale).toContain('Conversational action executed');
    });
  });

  // =========================================================================
  // 2. PROACTIVE INTERVENTIONS
  // =========================================================================
  describe('orchestrateProactiveIntervention', () => {
    const mockCandidate: any = {
      id: 'candidate-1',
      userId: mockUserId,
      candidateType: 'task_postponed',
      topic: 'Submit Tax Forms',
      urgency: 'high',
      importance: 8,
    };

    const mockPrefs: any = {
      userId: mockUserId,
      proactiveEnabled: true,
      quietHoursEnabled: false,
      maxDailyInteractions: 3,
      timezone: 'UTC',
    };

    it('should suppress proactive intervention if user has active dialogue in last 15 minutes', async () => {
      eventRepo.hasRecentDialogue.mockResolvedValue(true);

      const decision = await service.orchestrateProactiveIntervention(
        { source: 'proactive_evaluation', userId: mockUserId },
        mockCandidate,
        mockPrefs,
      );

      expect(decision.decision).toBe('no_action');
      expect(decision.mode).toBe('silent');
      expect(decision.interventionWarranted).toBe(false);
      expect(decision.rationale.toLowerCase()).toContain('active dialogue');
      expect(proactiveDeliveryService.deliverInAppAction).not.toHaveBeenCalled();
    });

    it('should defer or reject when proactive policy denies intervention', async () => {
      eventRepo.hasRecentDialogue.mockResolvedValue(false);
      proactivePolicyService.evaluate.mockResolvedValue({
        decision: 'DEFER',
        reason: 'Within user quiet hours',
      });

      const decision = await service.orchestrateProactiveIntervention(
        { source: 'proactive_evaluation', userId: mockUserId },
        mockCandidate,
        mockPrefs,
      );

      expect(decision.decision).toBe('defer');
      expect(decision.interventionWarranted).toBe(false);
      expect(proactiveDeliveryService.deliverInAppAction).not.toHaveBeenCalled();
    });

    it('should deliver proactive intervention when dialogue is quiet and policy approves', async () => {
      eventRepo.hasRecentDialogue.mockResolvedValue(false);
      proactivePolicyService.evaluate.mockResolvedValue({
        decision: 'ACT',
        reason: 'High urgency item requires companion nudge',
        cooldownMinutes: 720,
      });

      proactiveMessageService.synthesizeMessage.mockResolvedValue({
        title: 'Action Item',
        content: 'Notice you postponed this twice. Can I help break it down?',
      });

      const decision = await service.orchestrateProactiveIntervention(
        { source: 'proactive_evaluation', userId: mockUserId },
        mockCandidate,
        mockPrefs,
      );

      expect(decision.decision).toBe('proactive');
      expect(decision.mode).toBe('challenge');
      expect(decision.interventionWarranted).toBe(true);
      expect(proactiveDeliveryService.deliverInAppAction).toHaveBeenCalledWith(
        mockCandidate,
        expect.objectContaining({ title: 'Action Item' }),
        720,
      );
    });
  });
});
