/**
 * Phase 8: Reflection & Longitudinal Intelligence Types
 * Contracts for longitudinal observations, evidence provenance, intention vs. outcome tracking,
 * user corrections, and ContextFrame temporal grounding.
 */

export type ObservationCategory =
  | 'progress'
  | 'recurrence'
  | 'intention_vs_outcome'
  | 'unresolved_thread'
  | 'priority_change'
  | 'learning_development'
  | 'career_development'
  | 'decision_follow_up'
  | 'user_correction';

export type ObservationStatus =
  | 'active'
  | 'confirmed'
  | 'corrected'
  | 'dismissed'
  | 'superseded';

export type ObservationConfidenceType =
  | 'explicit_statement'
  | 'inferred_pattern';

export type EvidenceSourceType =
  | 'domain_events'
  | 'study_sessions'
  | 'learning_difficulties'
  | 'life_tasks'
  | 'life_commitments'
  | 'career_evaluations'
  | 'conversation_messages';

export interface SupportingEvidenceRef {
  sourceType: EvidenceSourceType;
  entityId: string;
  occurredAt: string;
  label: string;
  snippet?: string;
}

export interface LongitudinalObservationDto {
  id: string;
  userId: string;
  category: ObservationCategory;
  title: string;
  fact: string;
  interpretation: string;
  supportingEvidence: SupportingEvidenceRef[];
  timeWindowStart: string;
  timeWindowEnd: string;
  windowDays: number;
  confidence: number;
  confidenceType: ObservationConfidenceType;
  status: ObservationStatus;
  userCorrectionNotes: string | null;
  confirmedAt: string | null;
  correctedAt: string | null;
  dismissedAt: string | null;
  surfacedCount: number;
  lastSurfacedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLongitudinalObservationDto {
  category: ObservationCategory;
  title: string;
  fact: string;
  interpretation: string;
  supportingEvidence: SupportingEvidenceRef[];
  timeWindowStart: string;
  timeWindowEnd: string;
  windowDays: number;
  confidence: number;
  confidenceType: ObservationConfidenceType;
}

export interface CorrectObservationDto {
  correctionNotes: string;
}

export interface IntentionOutcomeComparisonDto {
  id: string;
  intention: string;
  sourceEntity: 'life_task' | 'life_commitment';
  entityId: string;
  statedAt: string;
  outcome: 'completed' | 'postponed' | 'missed' | 'unresolved';
  recordedAt: string | null;
  evidenceSnippet: string;
}

export interface ReflectionOverviewDto {
  windowDays: number;
  totalObservations: number;
  activeObservationsCount: number;
  confirmedObservationsCount: number;
  correctedObservationsCount: number;
  dismissedObservationsCount: number;
  recentProgress: string[];
  unresolvedThreads: string[];
  intentionsAndOutcomes: IntentionOutcomeComparisonDto[];
  topObservations: LongitudinalObservationDto[];
}

/**
 * Longitudinal Context for ContextFrame & LLM Grounding
 */
export interface LongitudinalContextFrameDto {
  confirmedInsights: string[];
  activeObservations: Array<{
    category: ObservationCategory;
    fact: string;
    interpretation: string;
    confidence: number;
  }>;
  recentUserCorrections: Array<{
    observationTitle: string;
    correctionNotes: string;
  }>;
  unresolvedThreads: string[];
  adviceToAvoid: string[];
}
