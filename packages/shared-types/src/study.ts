/**
 * Phase 7: Study Intelligence Foundation Types
 * Contracts for Study Topics, Hierarchies, Learning Objectives, Topic Progress,
 * Study Sessions, Provenance-Aware Learning Difficulties, Next-Step Recommendations,
 * and ContextFrame Integration.
 */

export type TopicProgressStatus =
  | 'not_started'
  | 'in_progress'
  | 'practiced'
  | 'demonstrated'
  | 'needs_review';

export type StudyProficiencyLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

export type StudySessionType =
  | 'concept_study'
  | 'active_recall'
  | 'problem_solving'
  | 'revision'
  | 'exercise';

export type StudySessionStatus =
  | 'in_progress'
  | 'completed'
  | 'abandoned';

export type DifficultySource =
  | 'user_reported'
  | 'ai_inferred'
  | 'practice_evaluation';

export type DifficultyStatus =
  | 'active'
  | 'reviewing'
  | 'resolved';

export type StudyRecommendationPriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'routine';

// ==========================================
// STUDY TOPIC DTOs
// ==========================================

export interface StudyTopicDto {
  id: string;
  userId: string;
  parentTopicId: string | null;
  subjectName: string;
  title: string;
  description: string | null;
  status: TopicProgressStatus;
  targetProficiency: StudyProficiencyLevel;
  demonstratedProficiency: StudyProficiencyLevel | null;
  linkedGoalId: string | null;
  linkedSkillId: string | null;
  linkedSkillName?: string | null;
  linkedGoalTitle?: string | null;
  learningObjectives: string[];
  prerequisiteTopicIds: string[];
  prerequisites?: Array<{ id: string; title: string; status: TopicProgressStatus }>;
  confidenceScore: number;
  lastStudiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudyTopicDto {
  parentTopicId?: string | null;
  subjectName: string;
  title: string;
  description?: string | null;
  targetProficiency?: StudyProficiencyLevel;
  linkedGoalId?: string | null;
  linkedSkillId?: string | null;
  learningObjectives?: string[];
  prerequisiteTopicIds?: string[];
}

export interface UpdateStudyTopicDto {
  parentTopicId?: string | null;
  subjectName?: string;
  title?: string;
  description?: string | null;
  status?: TopicProgressStatus;
  targetProficiency?: StudyProficiencyLevel;
  demonstratedProficiency?: StudyProficiencyLevel | null;
  linkedGoalId?: string | null;
  linkedSkillId?: string | null;
  learningObjectives?: string[];
  prerequisiteTopicIds?: string[];
  confidenceScore?: number;
}

// ==========================================
// STUDY SESSION DTOs
// ==========================================

export interface StudySessionDto {
  id: string;
  userId: string;
  topicId: string;
  topicTitle?: string;
  subjectName?: string;
  sessionType: StudySessionType;
  status: StudySessionStatus;
  startedAt: string;
  completedAt: string | null;
  durationMinutes: number | null;
  userNotes: string | null;
  conceptsUnderstood: string[];
  difficultiesEncountered: string[];
  followUpActions: string[];
  evidenceNotes: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartStudySessionDto {
  topicId: string;
  sessionType?: StudySessionType;
  userNotes?: string | null;
}

export interface CompleteStudySessionDto {
  durationMinutes?: number;
  userNotes?: string | null;
  conceptsUnderstood?: string[];
  difficultiesEncountered?: string[];
  followUpActions?: string[];
  evidenceNotes?: string | null;
  updateTopicStatus?: TopicProgressStatus;
  demonstratedProficiency?: StudyProficiencyLevel;
}

// ==========================================
// LEARNING DIFFICULTIES DTOs
// ==========================================

export interface LearningDifficultyDto {
  id: string;
  userId: string;
  topicId: string;
  topicTitle?: string;
  subjectName?: string;
  sessionId: string | null;
  concept: string;
  description: string;
  source: DifficultySource;
  confidence: number;
  status: DifficultyStatus;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLearningDifficultyDto {
  topicId: string;
  sessionId?: string | null;
  concept: string;
  description: string;
  source?: DifficultySource;
  confidence?: number;
}

export interface UpdateLearningDifficultyDto {
  status?: DifficultyStatus;
  resolutionNotes?: string | null;
}

// ==========================================
// NEXT-STEP STUDY RECOMMENDATIONS
// ==========================================

export interface StudyRecommendationDto {
  topicId: string;
  topicTitle: string;
  subjectName: string;
  priority: StudyRecommendationPriority;
  what: string;
  why: string;
  recommendedSessionType: StudySessionType;
  estimatedMinutes: number;
  hasUnmetPrerequisites: boolean;
  unmetPrerequisites?: string[];
  activeDifficultiesCount: number;
  requiresReview: boolean;
  linkedCareerSkillName?: string | null;
  linkedLifeTasks?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
  }>;
}

export interface StudyOverviewSummaryDto {
  totalTopics: number;
  topicsInProgress: number;
  topicsDemonstrated: number;
  topicsNeedingReview: number;
  activeDifficultiesCount: number;
  recentSessionsCount: number;
  totalStudyMinutes: number;
  lastStudiedTopic?: {
    id: string;
    title: string;
    subjectName: string;
    studiedAt: string;
  } | null;
  activeSession?: StudySessionDto | null;
}

// ==========================================
// STUDY CONTEXT FRAME (for Context Assembly & LLM Grounding)
// ==========================================

export interface StudyContextFrameDto {
  activeFocusTopic?: {
    id: string;
    title: string;
    subjectName: string;
    status: TopicProgressStatus;
    targetProficiency: StudyProficiencyLevel;
    demonstratedProficiency: StudyProficiencyLevel | null;
    learningObjectives: string[];
  } | null;
  activeDifficulties: Array<{
    concept: string;
    topicTitle: string;
    source: DifficultySource;
    description: string;
  }>;
  recentStudySessions: Array<{
    topicTitle: string;
    sessionType: StudySessionType;
    durationMinutes: number | null;
    completedAt: string | null;
    conceptsUnderstood: string[];
    difficultiesEncountered: string[];
  }>;
  topicsNeedingReview: Array<{
    id: string;
    title: string;
    subjectName: string;
    lastStudiedAt: string | null;
  }>;
  topRecommendation?: {
    topicTitle: string;
    what: string;
    why: string;
  } | null;
}
