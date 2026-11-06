/**
 * Phase 1F Context & Companion State Shared Types
 * Deterministic cognitive context assembly and companion operational state.
 */

export type CompanionPresenceStatus = 'active' | 'idle' | 'focused' | 'reflecting';
export type InteractionMode = 'chat' | 'study' | 'planning' | 'review' | 'silent';

export interface CompanionStateDto {
  id: string;
  userId: string;
  characterId: string;
  presenceStatus: CompanionPresenceStatus;
  interactionMode: InteractionMode;
  activeFocusGoalId: string | null;
  activeFocusProjectId: string | null;
  continuityStreakDays: number;
  totalInteractions: number;
  lastInteractionAt: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Resolved relations when requested
  character?: {
    id: string;
    name: string;
    tagline?: string;
  };
  activeFocusGoal?: {
    id: string;
    title: string;
    progressPercentage: number;
    status: string;
  } | null;
  activeFocusProject?: {
    id: string;
    title: string;
    status: string;
    color?: string | null;
  } | null;
}

export interface UpdateCompanionStateDto {
  presenceStatus?: CompanionPresenceStatus;
  interactionMode?: InteractionMode;
  activeFocusGoalId?: string | null;
  activeFocusProjectId?: string | null;
  metadata?: Record<string, unknown>;
}

import { RelevantMemoryDto } from './memory';

export interface TokenBudgetBreakdown {
  identityAndPersona: number;
  lifeGroundTruth: number;
  dialogueHistory: number;
  companionState: number;
  relevantMemories?: number;
  careerContext?: number;
  studyContext?: number;
  longitudinalContext?: number;
  totalEstimatedTokens: number;
  allocatedMaxTokens: number;
  charactersCount: number;
  estimationMethod: 'deterministic_heuristic_4chars_per_token';
}

export interface ContextFrameIdentity {
  userId: string;
  displayName: string;
  preferredName: string | null;
  occupationRole: string | null;
  primaryFocus: string | null;
  timezone: string;
}

export interface ContextFrameCompanion {
  archetypeId: string;
  name: string;
  tagline: string;
  description: string;
  defaultTraits: {
    warmth: number;
    directness: number;
    humor: number;
    challengeLevel: number;
    proactivity: string;
    responseLength: string;
  };
  avatarSymbol: string;
  colorAccent: string;
  presenceStatus: CompanionPresenceStatus;
  interactionMode: InteractionMode;
  continuityStreakDays: number;
  totalInteractions: number;
  lastInteractionAt: string;
  activeFocusGoalTitle: string | null;
  activeFocusProjectTitle: string | null;
}

export interface ContextFramePreferences {
  warmth: number;
  directness: number;
  humor: number;
  challengeLevel: number;
  proactivity: string;
  responseLength: string;
}

export interface ContextFrameLifeState {
  activeGoals: Array<{
    id: string;
    title: string;
    category: string;
    priority: string;
    progressPercentage: number;
    targetDate: string | null;
  }>;
  activeProjects: Array<{
    id: string;
    title: string;
    goalId: string | null;
    status: string;
    color: string | null;
    targetDate: string | null;
  }>;
  completedProjects?: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt?: string | null;
  }>;
  relevantTasks: Array<{
    id: string;
    title: string;
    projectId: string | null;
    priority: string;
    status: string;
    dueDate: string | null;
    isOverdue: boolean;
  }>;
  recentCompletedTasks?: Array<{
    id: string;
    title: string;
    completedAt?: string | null;
  }>;
  upcomingCommitments: Array<{
    id: string;
    title: string;
    commitmentType: string;
    importance: string;
    dueAt: string;
    hoursUntilDue: number;
  }>;
  fulfilledCommitments?: Array<{
    id: string;
    title: string;
    commitmentType: string;
  }>;
  recentIdeas: Array<{
    id: string;
    title: string;
    tags: string[];
    status: string;
  }>;
  counts: {
    totalGoals: number;
    totalProjects: number;
    totalOpenTasks: number;
    totalUpcomingCommitments: number;
    totalIdeas: number;
  };
}

export interface ContextFrameDialogue {
  conversationId: string | null;
  title: string | null;
  status: string | null;
  messageCount: number;
  messages: Array<{
    sequenceNumber: number;
    senderRole: string;
    content: string;
    createdAt: string;
  }>;
}

export interface ContextFrameTemporal {
  utcTimestamp: string;
  userLocalTime: string;
  timezone: string;
  dayOfWeek: string;
  timeOfDayGreeting: string;
  minutesSinceLastInteraction: number;
}

export interface ExecutedActionOutcomeDto {
  actionType:
    | 'task_completed'
    | 'task_created'
    | 'commitment_created'
    | 'commitment_fulfilled'
    | 'commitment_rescheduled'
    | 'task_progress_updated'
    | 'reminder_scheduled'
    | 'multiple_commitments_created'
    | 'clarification_needed';
  status: 'success' | 'failed';
  title: string;
  details?: Record<string, unknown>;
  message: string;
}

export interface ContextFrameDto {
  assembledAt: string;
  tokenBudget: TokenBudgetBreakdown;
  identity: ContextFrameIdentity;
  companion: ContextFrameCompanion;
  communicationPreferences: ContextFramePreferences;
  lifeGroundTruth: ContextFrameLifeState;
  dialogueContext: ContextFrameDialogue;
  temporalGrounding: ContextFrameTemporal;
  relevantMemories?: RelevantMemoryDto[];
  companionDecision?: import('./orchestration.js').CompanionDecisionDto;
  careerContext?: import('./career.js').CareerContextFrameDto;
  studyContext?: import('./study.js').StudyContextFrameDto;
  longitudinalContext?: import('./reflection.js').LongitudinalContextFrameDto;
  personalUnderstanding?: Record<string, unknown>;
  recentProactiveIntervention?: {
    id: string;
    title: string;
    body: string;
    channel: string;
    createdAt: string;
  } | null;
  executedActions?: ExecutedActionOutcomeDto[];
  snapshotId?: string | null;
}

export interface ContextSnapshotDto {
  id: string;
  userId: string;
  conversationId: string | null;
  triggerReason: string;
  tokenBudgetAllocated: number;
  tokenCountEstimated: number;
  assembledFrame: ContextFrameDto;
  createdAt: string;
}

export interface AssembleContextQueryDto {
  conversationId?: string;
  maxTokens?: number;
  persistSnapshot?: boolean;
  triggerReason?: string;
  currentMessage?: string;
  memoryTokenBudget?: number;
}
