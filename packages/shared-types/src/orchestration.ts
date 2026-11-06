// Canonical Companion Orchestration & Adaptive Behavior types and DTOs

export type CompanionTriggerSource = 'conversation' | 'event' | 'proactive_evaluation';

export interface CompanionTrigger {
  source: CompanionTriggerSource;
  userId: string;
  conversationId?: string;
  eventId?: string;
  message?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export type AdaptiveResponseMode =
  | 'acknowledge'
  | 'encourage'
  | 'challenge'
  | 'clarify'
  | 'coach'
  | 'study'
  | 'reflect'
  | 'silent'
  | 'greeting'
  | 'emotional_support'
  | 'deadline_triage';

export type CompanionDecisionType =
  | 'respond'
  | 'ask'
  | 'encourage'
  | 'challenge'
  | 'acknowledge'
  | 'defer'
  | 'proactive'
  | 'no_action';

export type BehavioralSignalType =
  | 'repeated_postponement'
  | 'overdue_commitments'
  | 'high_urgency_due'
  | 'high_momentum'
  | 'interaction_gap'
  | 'proactive_fatigue';

export interface BehavioralSignal {
  type: BehavioralSignalType;
  count: number;
  windowDays: number;
  summary: string;
  details?: Record<string, unknown>;
}

export interface CompanionDecisionDto {
  decision: CompanionDecisionType;
  mode: AdaptiveResponseMode;
  priority: 'low' | 'normal' | 'high';
  rationale: string;
  interventionWarranted: boolean;
  behavioralSignals?: BehavioralSignal[];
  actionId?: string;
  messageContent?: string;
  metadata?: Record<string, unknown>;
}

export interface CompanionOrchestrationTurnResult {
  decision: CompanionDecisionDto;
  userMessage?: any;
  assistantMessage?: any;
  metadata?: Record<string, unknown>;
}
