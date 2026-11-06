import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import {
  CompanionTrigger,
  CompanionDecisionDto,
  AdaptiveResponseMode,
  BehavioralSignal,
  ConversationTurnResultDto,
  ConversationMessageDto,
  CompanionAiResponseDto,
  ContextFrameDto,
  ExecutedActionOutcomeDto,
} from '@niva/shared-types';
import {
  ConversationMessage,
  ProactiveCandidate,
  UserProactivePreferences,
} from '../database/schema';
import { ConversationRepository } from '../conversation/conversation.repository';
import { ContextAssemblyService } from '../context/context-assembly.service';
import { BehavioralSignalsService } from './behavioral-signals.service';
import { ConversationActionService } from './conversation-action.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { CompanionStateRepository } from '../context/companion-state.repository';
import { EventPublisherService } from '../events/event-publisher.service';
import { EventRepository } from '../events/event.repository';
import { ProactivePolicyService } from '../events/proactive/proactive-policy.service';
import { ProactiveMessageService } from '../events/proactive/proactive-message.service';
import { ProactiveDeliveryService } from '../events/proactive/proactive-delivery.service';
import { MemoryService } from '../memory/memory.service';
import { PersonalUnderstandingService } from '../personalization/personal-understanding.service';

@Injectable()
export class CompanionOrchestratorService {
  private readonly logger = new Logger(CompanionOrchestratorService.name);

  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly contextAssemblyService: ContextAssemblyService,
    private readonly behavioralSignalsService: BehavioralSignalsService,
    private readonly aiGatewayService: AiGatewayService,
    private readonly companionStateRepo: CompanionStateRepository,
    private readonly eventPublisher: EventPublisherService,
    private readonly eventRepository: EventRepository,
    private readonly proactivePolicyService: ProactivePolicyService,
    private readonly proactiveMessageService: ProactiveMessageService,
    private readonly proactiveDeliveryService: ProactiveDeliveryService,
    @Optional() private readonly memoryService?: MemoryService,
    @Optional() private readonly conversationActionService?: ConversationActionService,
    @Optional() private readonly personalUnderstandingService?: PersonalUnderstandingService,
  ) {}

  /**
   * Central entry point for conversational turns.
   * Unifies user input, life context, durable memories, behavioral signals,
   * adaptive mode selection, AI generation, and structured audit persistence.
   */
  async orchestrateConversationTurn(
    trigger: CompanionTrigger,
  ): Promise<ConversationTurnResultDto> {
    const { userId, conversationId, message } = trigger;

    if (!conversationId) {
      throw new BadRequestException('conversationId is required for conversation turn');
    }

    // 1. Verify conversation ownership and active status
    const conv = await this.conversationRepository.findConversationById(
      conversationId,
      userId,
    );
    if (!conv) {
      throw new NotFoundException('Conversation not found or access denied');
    }
    if (conv.status === 'archived') {
      throw new BadRequestException('Cannot send messages to an archived conversation');
    }

    const trimmedContent = (message || '').trim();
    if (!trimmedContent) {
      throw new BadRequestException('Message content cannot be empty or whitespace only');
    }
    if (trimmedContent.length > 8000) {
      throw new BadRequestException('Message content must not exceed 8,000 characters');
    }

    // 2. Persist user message deterministically (user utterance safely saved)
    const userMessage = await this.conversationRepository.createMessage(conversationId, {
      senderRole: 'user',
      content: trimmedContent,
      metadata: trigger.metadata,
    });

    // Publish UserMessageSent domain event
    await this.eventPublisher.publish({
      userId,
      eventType: 'UserMessageSent',
      aggregateType: 'conversation',
      aggregateId: conversationId,
      payload: {
        conversationId,
        messageId: userMessage.id,
        content: trimmedContent.slice(0, 500),
      },
    });

    // 3. Detect factual behavioral signals (deterministic SQL queries, no psychological profiling)
    const signals = await this.behavioralSignalsService.detectSignals(userId);

    // 3b. Detect and execute conversation-driven actions (Task completion, Task creation, Reminders)
    let executedActions: ExecutedActionOutcomeDto[] = [];
    if (this.conversationActionService) {
      try {
        executedActions = await this.conversationActionService.detectAndExecuteActions(
          userId,
          trimmedContent,
        );
      } catch (actionErr: any) {
        this.logger.warn(`Failed executing conversation action: ${actionErr.message}`);
      }
    }

    // 4. Assemble Cognitive ContextFrame (Identity, Persona, Life Context, Memories)
    const contextFrame = await this.contextAssemblyService.assembleContext(userId, {
      conversationId,
      currentMessage: trimmedContent,
      triggerReason: 'conversation_turn',
    });

    if (executedActions.length > 0) {
      contextFrame.executedActions = executedActions;
    }

    // 5. Determine Companion Decision and Adaptive Response Mode
    const decision = this.determineConversationalDecision(
      trimmedContent,
      signals,
      contextFrame,
    );

    // Attach decision and signals to contextFrame for prompt synthesis
    contextFrame.companionDecision = decision;

    // 6. Generate context-grounded reply via AI Gateway
    let aiResponse: CompanionAiResponseDto;
    try {
      aiResponse = await this.aiGatewayService.generateCompanionReply({
        conversationId,
        userMessage: trimmedContent,
        contextFrame,
      });
    } catch (err: any) {
      this.logger.error(
        `AI generation failed for conversation ${conversationId}: ${err.message}`,
      );
      // Invariant: Do NOT persist a fake/empty assistant message when AI fails.
      // Throwing normalized error allows the client to retry while user message is safely retained.
      throw err;
    }

    // 7. Persist assistant message with structured decision audit (NO chain-of-thought)
    const assistantMessage = await this.conversationRepository.createMessage(
      conversationId,
      {
        senderRole: 'assistant',
        content: aiResponse.content,
        metadata: {
          provider: aiResponse.provider,
          model: aiResponse.model,
          latencyMs: aiResponse.latencyMs,
          usage: aiResponse.usage,
          requestId: aiResponse.requestId,
          promptSynthesisVersion: '2.0.0',
          orchestration: {
            decision: decision.decision,
            mode: decision.mode,
            priority: decision.priority,
            rationale: decision.rationale,
            signalsDetected: signals.map((s) => ({ type: s.type, count: s.count })),
          },
          contextFrameSnapshot: {
            assembledAt: contextFrame?.assembledAt ?? new Date().toISOString(),
            companion: contextFrame?.companion ?? null,
            lifeGroundTruth: {
              activeGoalsCount: contextFrame?.lifeGroundTruth?.activeGoals?.length ?? 0,
              activeProjectsCount: contextFrame?.lifeGroundTruth?.activeProjects?.length ?? 0,
              relevantTasksCount: contextFrame?.lifeGroundTruth?.relevantTasks?.length ?? 0,
            },
          },
          fallbackUsed: aiResponse.provider === 'mock',
        },
      },
    );

    // 8. Increment companion interaction counters
    await this.companionStateRepo.incrementInteractions(userId).catch((err) => {
      this.logger.warn(
        `Failed to increment companion interactions for user ${userId}: ${err.message}`,
      );
    });

    // 8.5 Auto-generate concise 2-5 word topic title if conversation has generic/default title
    let updatedConversationTitle: string | undefined = undefined;
    const currentTitle = conv.title || '';
    const isGenericTitle =
      !currentTitle ||
      currentTitle === 'New Conversation' ||
      currentTitle.startsWith('Dialogue with') ||
      currentTitle.startsWith('Chat with') ||
      currentTitle === 'General Dialogue' ||
      currentTitle === 'Discussion';

    if (isGenericTitle && typeof this.aiGatewayService?.generateConversationTitle === 'function') {
      try {
        const generatedTitle = await this.aiGatewayService.generateConversationTitle(trimmedContent);
        if (generatedTitle && generatedTitle !== currentTitle) {
          await this.conversationRepository.updateConversation(conversationId, userId, {
            title: generatedTitle,
          });
          updatedConversationTitle = generatedTitle;
        }
      } catch (err: any) {
        this.logger.debug(`Could not auto-generate topic title: ${err.message}`);
      }
    }

    // 9. Non-blocking asynchronous memory extraction job enqueueing
    if (this.memoryService) {
      this.memoryService
        .createExtractionJob(userId, {
          conversationId,
          messageId: userMessage.id,
          turnContext: {
            userMessage: trimmedContent,
            assistantResponse: aiResponse.content,
          },
        })
        .catch((err) => {
          this.logger.warn(
            `Failed to enqueue memory extraction job for user ${userId}: ${err.message}`,
          );
        });
    }

    // 9.5 Naturally evolve personal understanding profile
    if (this.personalUnderstandingService) {
      this.personalUnderstandingService
        .learnFromConversation(userId, trimmedContent)
        .catch((err) => {
          this.logger.warn(
            `Failed to update personal understanding for user ${userId}: ${err.message}`,
          );
        });
    }

    return {
      userMessage: this.mapMessageToDto(userMessage),
      assistantMessage: this.mapMessageToDto(assistantMessage),
      metadata: {
        provider: aiResponse.provider,
        model: aiResponse.model,
        tokensUsed: aiResponse.usage.totalTokens,
        latencyMs: aiResponse.latencyMs,
      },
      decision,
      conversationTitle: updatedConversationTitle,
      executedActions: executedActions || [],
    };
  }

  /**
   * Evaluates and orchestrates a proactive companion intervention.
   * Enforces active dialogue suppression, policy checks, fatigue prevention,
   * message synthesis, and delivery.
   */
  async orchestrateProactiveIntervention(
    trigger: CompanionTrigger,
    candidate: ProactiveCandidate,
    preferences: UserProactivePreferences,
  ): Promise<CompanionDecisionDto> {
    const userId = trigger.userId;

    // 1. ACTIVE DIALOGUE SUPPRESSION
    // If the user has talked within the last 15 minutes, suppress proactive intervention.
    const hasActiveDialogue = await this.eventRepository.hasRecentDialogue(userId, 15);
    if (hasActiveDialogue) {
      this.logger.log(
        `[Orchestration] Proactive intervention suppressed for user ${userId}: Active dialogue in last 15 minutes`,
      );
      return {
        decision: 'no_action',
        mode: 'silent',
        priority: 'low',
        rationale:
          'Suppressed: User has active dialogue within the last 15 minutes. Proactive nudges never interrupt active conversational flow.',
        interventionWarranted: false,
      };
    }

    // 2. DETERMINISTIC POLICY EVALUATION (Quiet Hours, Master Switch, Daily Cap, Topic Cooldown)
    const evaluation = await this.proactivePolicyService.evaluate(candidate, preferences);
    if (evaluation.decision !== 'ACT') {
      this.logger.log(
        `[Orchestration] Proactive policy denied candidate ${candidate.id} (${candidate.topic}): ${evaluation.decision} - ${evaluation.reason}`,
      );
      return {
        decision: evaluation.decision === 'DEFER' ? 'defer' : 'no_action',
        mode: 'silent',
        priority: (candidate.urgency as any) || 'normal',
        rationale: evaluation.reason,
        interventionWarranted: false,
      };
    }

    // 3. BEHAVIORAL SIGNALS & PROACTIVE FATIGUE CHECK
    const signals = await this.behavioralSignalsService.detectSignals(userId);
    const fatigueSignal = signals.find((s) => s.type === 'proactive_fatigue');
    if (fatigueSignal && candidate.urgency !== 'high') {
      this.logger.log(
        `[Orchestration] Proactive intervention suppressed for user ${userId} due to detected proactive fatigue`,
      );
      return {
        decision: 'no_action',
        mode: 'silent',
        priority: 'low',
        rationale:
          'Suppressed: Proactive fatigue detected (multiple unengaged nudges in last 24h).',
        interventionWarranted: false,
        behavioralSignals: signals,
      };
    }

    // 4. DETERMINE ADAPTIVE MODE FOR INTERVENTION
    let mode: AdaptiveResponseMode = 'acknowledge';
    if (candidate.candidateType === 'task_postponed' || candidate.urgency === 'high') {
      mode = 'challenge';
    } else if (candidate.candidateType === 'task_completed') {
      mode = 'encourage';
    } else if (candidate.candidateType === 'commitment_due') {
      mode = 'coach';
    }

    // 5. SYNTHESIZE AND DELIVER
    const message = await this.proactiveMessageService.synthesizeMessage(candidate);
    await this.proactiveDeliveryService.deliverInAppAction(
      candidate,
      message,
      evaluation.cooldownMinutes || 720,
    );

    this.logger.log(
      `[Orchestration] Proactive intervention DELIVERED for candidate ${candidate.id} (${candidate.topic}) with mode ${mode}`,
    );

    return {
      decision: 'proactive',
      mode,
      priority: (candidate.urgency as any) || 'normal',
      rationale: `Proactive intervention approved for topic "${candidate.topic}": ${evaluation.reason}`,
      interventionWarranted: true,
      behavioralSignals: signals,
      actionId: candidate.id,
      messageContent: message.content,
    };
  }

  /**
   * Deterministically determines the Companion Decision and Adaptive Response Mode.
   * Priority Hierarchy:
   * 1. Immediate User Utterance Intent (PARAMOUNT OVERRIDE)
   * 2. Detected Behavioral Patterns (Accountability/Momentum)
   * 3. Companion Persona & Archetype Default
   */
  determineConversationalDecision(
    message: string,
    signals: BehavioralSignal[],
    contextFrame: ContextFrameDto,
  ): CompanionDecisionDto {
    const text = message.toLowerCase().trim();

    // =========================================================================
    // LEVEL 1: IMMEDIATE USER UTTERANCE OVERRIDE (HIGHEST PRIORITY)
    // The user's active intent always overrides background signals or stale goals.
    // =========================================================================

    // 0. Executed Backend Actions Override
    if (contextFrame.executedActions && contextFrame.executedActions.length > 0) {
      const hasCompletedTask = contextFrame.executedActions.some(
        (a: any) => a.actionType === 'task_completed',
      );
      if (hasCompletedTask) {
        return {
          decision: 'encourage',
          mode: 'encourage',
          priority: 'normal',
          rationale:
            'User completed an active task. Confirming completion and reinforcing execution momentum.',
          interventionWarranted: true,
          behavioralSignals: signals,
        };
      }
      return {
        decision: 'respond',
        mode: 'acknowledge',
        priority: 'normal',
        rationale:
          'Conversational action executed (task or reminder created). Confirming details cleanly.',
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // 1. Casual / Everyday Greeting (No unsolicited task pressure)
    const isGreetingMatch = (t: string): boolean => {
      const trimmed = t.trim().toLowerCase().replace(/[!.,?]+$/, '');
      if (/^(?:hey+|hi+|hello+|howdy|yo|sup|what'?s\s+up|greetings)\b/i.test(trimmed)) {
        const remaining = trimmed
          .replace(/^(?:hey+|hi+|hello+|howdy|yo|sup|what'?s\s+up|greetings)[,\s!.]*/i, '')
          .replace(/^(?:niva|there)[,\s!.]*/i, '')
          .trim();
        if (!remaining) return true;
        if (
          /^(?:how\s+are\s+you(?:\s+doing)?|how\s+is\s+it\s+going|how's\s+it\s+going|how\s+are\s+things|what's\s+up|how\s+have\s+you\s+been|good\s+to\s+see\s+you|hope\s+you're\s+well)[?!.]*$/i.test(
            remaining,
          )
        ) {
          return true;
        }
      }
      if (
        /^(?:good\s+(?:morning|afternoon|evening|day))(?:\s+niva)?(?:[,\s!.]*(?:how\s+are\s+you|how's\s+it\s+going|hope\s+you're\s+well)?)?[?!.]*$/i.test(
          trimmed,
        )
      ) {
        return true;
      }
      return false;
    };

    if (isGreetingMatch(text)) {
      return {
        decision: 'respond',
        mode: 'greeting',
        priority: 'normal',
        rationale:
          'Casual conversational greeting. Greet warmly and naturally (1-2 sentences) without unsolicited task pressure, productivity lecturing, or personal priorities.',
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // 1b. Explicit Boundary: Pure conversation, zero unsolicited advice or problem-solving
    const noAdvicePatterns = [
      /don'?t\s+want\s+advice/i,
      /no\s+advice/i,
      /just\s+want\s+to\s+talk/i,
      /just\s+listen/i,
      /don'?t\s+give\s+me\s+advice/i,
      /not\s+looking\s+for\s+solutions/i,
      /just\s+hear\s+me\s+out/i,
      /let\s+me\s+vent/i,
    ];
    if (noAdvicePatterns.some((p) => p.test(text))) {
      return {
        decision: 'respond',
        mode: 'acknowledge',
        priority: 'high',
        rationale:
          'User explicitly requested open conversation without advice or problem-solving. Maintain pure attentive, warm listening.',
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // 2. Emotional Fatigue / Overwhelm / Imposter Feelings
    const emotionalSupportPhrases = [
      'exhausted',
      'so tired',
      'burnt out',
      'burnout',
      'feeling overwhelmed',
      'overwhelmed',
      'rough day',
      'hard day',
      'bad day',
      'drained',
      'no energy',
      "can't do this today",
      'cant do this today',
      'need a break',
      'too much pressure',
      'feeling down',
      'falling behind',
      'everyone is moving ahead',
      'everyone is ahead',
      'left behind',
      'feeling inadequate',
      'imposter',
      'not good enough',
      'doubt myself',
      'losing confidence',
      'feeling stuck',
      'feel like giving up',
      "can't keep up",
      'cant keep up',
    ];
    if (emotionalSupportPhrases.some((phrase) => text.toLowerCase().includes(phrase))) {
      return {
        decision: 'respond',
        mode: 'emotional_support',
        priority: 'high',
        rationale:
          'User expresses emotional fatigue or feeling left behind. Prioritize calm, genuine empathy without generic motivational speeches, unsolicited advice, or forced task planning.',
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // 2b. Project & Work Continuity Recall
    const workRecallPatterns = [
      /what\s+was\s+i\s+working\s+on/i,
      /what\s+am\s+i\s+working\s+on/i,
      /what\s+was\s+my\s+project/i,
      /remember\s+what\s+project/i,
      /working\s+on\s+recently/i,
      /recent\s+work/i,
      /what\s+did\s+i\s+work\s+on/i,
    ];
    if (workRecallPatterns.some((p) => p.test(text))) {
      return {
        decision: 'respond',
        mode: 'acknowledge',
        priority: 'normal',
        rationale:
          'User asked for recall of active projects and recent work. Ground reply directly in active projects and tasks.',
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // 3. Sudden Urgent Deadline / Academic Panic (Immediate triage, calm minimum-viable plan)
    const deadlineTriagePhrases = [
      'exam is on monday',
      'exam tomorrow',
      'test tomorrow',
      'deadline tomorrow',
      'due tomorrow',
      'due tonight',
      "haven't started studying",
      'havent started studying',
      "haven't started",
      'havent started',
      'panicking about my deadline',
      'behind on my submission',
      'running out of time',
      "haven't prepared",
    ];
    if (deadlineTriagePhrases.some((phrase) => text.includes(phrase))) {
      return {
        decision: 'respond',
        mode: 'deadline_triage',
        priority: 'high',
        rationale:
          'Urgent deadline pressure detected. Immediate pragmatic triage to de-escalate panic and establish a calm minimum-viable path.',
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // A. Explicit Study / Concept / Recall intent
    const studyKeywords = [
      'quiz me',
      'test me',
      'study',
      'test my knowledge',
      'explain how',
      'what is the concept',
      'flashcard',
      'help me understand',
      'active recall',
    ];
    if (studyKeywords.some((k) => text.includes(k))) {
      return {
        decision: 'respond',
        mode: 'study',
        priority: 'normal',
        rationale: 'User explicitly requested study guidance or active recall testing.',
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // B. Coaching / Strategic Breakdown intent
    const coachKeywords = [
      'coach me',
      'how do i start',
      'plan this',
      'step by step',
      'break this down',
      'break down',
      'give me a strategy',
      'action plan',
      'guide me',
    ];
    if (coachKeywords.some((k) => text.includes(k))) {
      return {
        decision: 'respond',
        mode: 'coach',
        priority: 'normal',
        rationale: 'User requested actionable coaching or strategic breakdown.',
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // C. Ambiguous / Underspecified intent requiring clarification
    const clarifyPhrases = [
      'what should i do?',
      'what should i do',
      'help me with that',
      'not sure what to do',
      'can you help me?',
      'i need advice',
      'what now?',
      'what next?',
    ];
    if (clarifyPhrases.some((p) => text === p || text.startsWith(p))) {
      return {
        decision: 'ask',
        mode: 'clarify',
        priority: 'normal',
        rationale:
          'User request is underspecified or broad. Seeking clarifying focus before proceeding.',
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // D. Celebration of Win / Completed Action
    const winKeywords = [
      'i finished',
      'i completed',
      'completed my project',
      'finished my project',
      'i did it',
      'done with',
      'just completed',
      'shipped',
      'wrapped up',
      'finally finished',
      'accomplished',
    ];
    if (winKeywords.some((k) => text.toLowerCase().includes(k))) {
      return {
        decision: 'encourage',
        mode: 'encourage',
        priority: 'normal',
        rationale:
          'User achieved a milestone or completed an action. Celebrate the win warmly without immediately burdening them with new work.',
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // E. Retrospective / Reflection intent
    const reflectKeywords = [
      "let's reflect",
      'review my progress',
      'how did i do',
      'weekly review',
      'retrospective',
      'reflect on',
    ];
    if (reflectKeywords.some((k) => text.includes(k))) {
      return {
        decision: 'respond',
        mode: 'reflect',
        priority: 'normal',
        rationale: 'User initiated reflective review.',
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // F. Silent Mode check
    if (contextFrame.companion?.interactionMode === 'silent') {
      return {
        decision: 'respond',
        mode: 'silent',
        priority: 'low',
        rationale:
          'Companion state configured for silent mode. Minimizing conversational output.',
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // =========================================================================
    // LEVEL 1B: CAREER INTELLIGENCE & MOCK EVALUATION ADAPTATION (PHASE 6A/6B)
    // Grounding in career trajectory when user asks about interview/role readiness
    // =========================================================================
    const careerContext = contextFrame.careerContext;
    if (careerContext) {
      const mockPracticeKeywords = [
        'mock interview',
        'practice interview',
        'technical round',
        'mock session',
        'evaluate my dsa',
        'evaluate my python',
        'interview practice',
        'run a mock',
        'test my skills',
      ];
      if (mockPracticeKeywords.some((k) => text.includes(k))) {
        return {
          decision: 'respond',
          mode: 'coach',
          priority: 'high',
          rationale: `User requested mock evaluation practice for ${careerContext.primaryTargetRole?.title || 'target role'}. Activating technical interview guidance.`,
          interventionWarranted: true,
          behavioralSignals: signals,
        };
      }

      const careerKeywords = [
        'interview',
        'readiness',
        'ready for',
        'target role',
        'career',
        'skill gap',
        'placement',
        'hiring',
        'job prep',
      ];
      if (careerKeywords.some((k) => text.includes(k))) {
        if (careerContext.readinessDiscrepancy === 'overconfident') {
          return {
            decision: 'challenge',
            mode: 'challenge',
            priority: 'high',
            rationale: `Career intelligence indicates an overconfidence discrepancy: stated readiness is '${careerContext.statedReadiness}' but evidence alignment is ${careerContext.evidenceAlignmentScore}/100 with critical skill gaps. Proposing a focused mock evaluation round.`,
            interventionWarranted: true,
            behavioralSignals: signals,
          };
        }
        if (careerContext.readinessDiscrepancy === 'underconfident') {
          return {
            decision: 'encourage',
            mode: 'encourage',
            priority: 'normal',
            rationale: `Career intelligence indicates an underconfidence discrepancy: stated readiness is '${careerContext.statedReadiness}' but calculated readiness is ${careerContext.readinessScore}/100 with verified strengths.`,
            interventionWarranted: true,
            behavioralSignals: signals,
          };
        }
        return {
          decision: 'respond',
          mode: 'coach',
          priority: 'normal',
          rationale: `User discussing career preparation for ${careerContext.primaryTargetRole?.title || 'target role'}. Providing structured coaching on next priorities.`,
          interventionWarranted: true,
          behavioralSignals: signals,
        };
      }
    }

    // =========================================================================
    // LEVEL 2: DETECTED BEHAVIORAL PATTERNS
    // Only applied when user message doesn't have an explicit mode override.
    // =========================================================================

    // Repeated Postponement -> Constructive Challenge
    const postponeSignal = signals.find((s) => s.type === 'repeated_postponement');
    if (postponeSignal && postponeSignal.count >= 2) {
      return {
        decision: 'challenge',
        mode: 'challenge',
        priority: 'high',
        rationale: `Repeated postponement detected: ${postponeSignal.count} occurrences within 7 days. Adopting constructive, empathetic accountability posture.`,
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // High Momentum -> Encouragement
    const momentumSignal = signals.find((s) => s.type === 'high_momentum');
    if (momentumSignal && momentumSignal.count >= 3) {
      return {
        decision: 'encourage',
        mode: 'encourage',
        priority: 'normal',
        rationale: `High momentum detected: ${momentumSignal.count} tasks completed in 3 days. Reinforcing consistency.`,
        interventionWarranted: true,
        behavioralSignals: signals,
      };
    }

    // =========================================================================
    // LEVEL 3: DEFAULT CONVERSATIONAL FALLBACK
    // =========================================================================
    return {
      decision: 'respond',
      mode: 'acknowledge',
      priority: 'normal',
      rationale: 'Standard conversational dialogue turn.',
      interventionWarranted: true,
      behavioralSignals: signals,
    };
  }

  private mapMessageToDto(m: ConversationMessage): ConversationMessageDto {
    return {
      id: m.id,
      conversationId: m.conversationId,
      userId: '',
      senderRole: m.senderRole as any,
      content: m.content,
      sequenceNumber: m.sequenceNumber,
      status: m.status as any,
      metadata: m.metadata as any,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }
}
