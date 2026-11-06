/**
 * Phase 4: Event & Proactive Companion Foundation Types
 * Contracts for Domain Events, Outbox Persistence, Proactive Candidates,
 * Deterministic Policy Decisions, Cooldowns, Quiet Hours, and Delivery Abstractions.
 */

export type DomainEventType =
  | 'UserMessageSent'
  | 'TaskCreated'
  | 'TaskCompleted'
  | 'TaskPostponed'
  | 'CommitmentCreated'
  | 'CommitmentUpdated'
  | 'MemoryAccepted'
  | 'MemorySuperseded'
  | 'CareerProfileUpdated'
  | 'TargetRoleCreated'
  | 'SkillEvidenceAdded'
  | 'PreparationActivityCompleted'
  | 'CareerGapEvaluated'
  | 'TopicProgressUpdated'
  | 'StudySessionStarted'
  | 'StudySessionCompleted'
  | 'LearningDifficultyRecorded'
  | 'LongitudinalObservationCreated'
  | 'LongitudinalObservationConfirmed'
  | 'LongitudinalObservationCorrected'
  | 'LongitudinalObservationDismissed';

export type EventProcessingStatus =
  | 'pending'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'dead_letter';

export type AggregateType =
  | 'conversation'
  | 'task'
  | 'commitment'
  | 'memory'
  | 'goal'
  | 'project'
  | 'career_profile'
  | 'target_role'
  | 'career_skill'
  | 'preparation_activity'
  | 'study_topic'
  | 'study_session'
  | 'learning_difficulty'
  | 'longitudinal_observation';

export interface DomainEventDto {
  id: string;
  userId: string;
  eventType: DomainEventType;
  eventVersion: number;
  aggregateType: AggregateType;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  status: EventProcessingStatus;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CandidateUrgency = 'low' | 'medium' | 'high';
export type ProactiveCandidateStatus = 'pending' | 'evaluated' | 'discarded';
export type PolicyDecisionType = 'NO_ACTION' | 'DEFER' | 'ACT';

export interface ProactiveCandidateDto {
  id: string;
  userId: string;
  eventId: string;
  candidateType: string;
  topic: string;
  urgency: CandidateUrgency;
  importance: number;
  contextSnapshot: Record<string, unknown>;
  status: ProactiveCandidateStatus;
  decision: PolicyDecisionType | null;
  decisionReason: string | null;
  createdAt: string;
  evaluatedAt: string | null;
}

export type ProactiveActionType = 'IN_APP_MESSAGE' | 'IN_APP_PROMPT';
export type ProactiveActionStatus = 'pending_delivery' | 'delivered' | 'dismissed' | 'acted_upon';

export interface ProactiveActionDto {
  id: string;
  userId: string;
  candidateId: string | null;
  actionType: ProactiveActionType;
  channel: string;
  title: string;
  content: string;
  status: ProactiveActionStatus;
  deliveredAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProactivePreferencesDto {
  id?: string;
  userId: string;
  proactiveEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm format, e.g. "22:00"
  quietHoursEnd: string;   // HH:mm format, e.g. "08:00"
  timezone: string;        // IANA timezone identifier, e.g. "Asia/Kolkata", "America/New_York"
  maxDailyInteractions: number;
  allowHighUrgencyInQuietHours: boolean;
  inAppEnabled?: boolean;
  browserEnabled?: boolean;
  emailEnabled?: boolean;
  advanceReminderDays?: number;
  progressCheckHours?: number;
  finalReminderHours?: number;
  morningCheckinEnabled?: boolean;
  morningCheckinTime?: string;
  eveningCheckinEnabled?: boolean;
  eveningCheckinTime?: string;
  weeklyReflectionEnabled?: boolean;
  enabledCategories?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserProactivePreferencesDto {
  proactiveEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  maxDailyInteractions?: number;
  allowHighUrgencyInQuietHours?: boolean;
  inAppEnabled?: boolean;
  browserEnabled?: boolean;
  emailEnabled?: boolean;
  advanceReminderDays?: number;
  progressCheckHours?: number;
  finalReminderHours?: number;
  morningCheckinEnabled?: boolean;
  morningCheckinTime?: string;
  eveningCheckinEnabled?: boolean;
  eveningCheckinTime?: string;
  weeklyReflectionEnabled?: boolean;
  enabledCategories?: string[];
}

export type ScheduledJobType =
  | 'REMINDER'
  | 'PROGRESS_CHECK'
  | 'FINAL_WARNING'
  | 'PROACTIVE_CHECKIN'
  | 'STUDY_RETENTION_CHECK'
  | 'FOLLOW_UP';

export type ScheduledJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'rescheduled';

export interface ScheduledJobDto {
  id: string;
  userId: string;
  jobType: ScheduledJobType;
  targetType: string;
  targetId: string;
  scheduledAt: string;
  status: ScheduledJobStatus;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NotificationChannel = 'in_app' | 'browser' | 'email';
export type NotificationDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'suppressed';

export interface NotificationRecordDto {
  id: string;
  userId: string;
  jobId: string | null;
  channel: NotificationChannel;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  readAt: string | null;
  deliveryStatus: NotificationDeliveryStatus;
  deliveryAttempts: number;
  deliveryResult: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSubscriptionDto {
  id: string;
  userId: string;
  endpoint: string;
  browser?: string;
  createdAt: string;
}

export interface ProcessEventsResultDto {
  eventsClaimed: number;
  eventsProcessed: number;
  eventsFailed: number;
  candidatesGenerated: number;
  actionsDelivered: number;
  details?: Array<{
    eventId: string;
    eventType: DomainEventType;
    status: EventProcessingStatus;
    decision?: PolicyDecisionType;
    actionId?: string;
    error?: string;
  }>;
}
