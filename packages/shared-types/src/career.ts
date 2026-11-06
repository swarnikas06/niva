/**
 * Phase 6A: Career & Placement Intelligence Foundation Types
 * Contracts for Career Profile, Target Roles, Required Skills, User Skills,
 * Tangible Evidence, Gap Analysis, Preparation Activities, and Context Integration.
 */

export type CareerLevel =
  | 'student'
  | 'entry_level'
  | 'mid_level'
  | 'senior'
  | 'staff_plus'
  | 'career_switcher';

export type CareerStatus =
  | 'exploring'
  | 'active_preparation'
  | 'interviewing'
  | 'offer_stage'
  | 'accepted'
  | 'paused';

export type StatedReadiness =
  | 'exploring'
  | 'early_preparation'
  | 'moderate_confidence'
  | 'interview_ready';

export type RoleFamily =
  | 'software_engineering'
  | 'systems_infrastructure'
  | 'data_ai_ml'
  | 'security'
  | 'engineering_management'
  | 'product_management'
  | 'other';

export type SeniorityLevel =
  | 'intern'
  | 'junior'
  | 'mid'
  | 'senior'
  | 'staff'
  | 'principal';

export type TargetRolePriority = 'primary' | 'secondary' | 'exploratory';

export type SkillCategory =
  | 'core_technical'
  | 'systems_architecture'
  | 'problem_solving'
  | 'data_infrastructure'
  | 'leadership_collaboration'
  | 'communication';

export type SkillImportance = 'mandatory' | 'high_priority' | 'nice_to_have';

export type SkillProficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type EvidenceType =
  | 'project_artifact'
  | 'production_experience'
  | 'open_source_pr'
  | 'code_review_demo'
  | 'system_design_doc'
  | 'mock_interview_score'
  | 'certification'
  | 'verbal_explanation';

export type EvidenceValidationStatus =
  | 'unverified'
  | 'demonstrated'
  | 'validated_by_niva'
  | 'stale';

export type ActivityType =
  | 'mock_interview'
  | 'system_design_practice'
  | 'coding_challenge'
  | 'rfc_writing'
  | 'concept_study'
  | 'behavioral_story_prep'
  | 'portfolio_project';

export type ActivityStatus = 'planned' | 'in_progress' | 'completed' | 'abandoned';

export type ReadinessDiscrepancy =
  | 'aligned'
  | 'overconfident'
  | 'underconfident'
  | 'unassessed';

// --- Career Profile ---

export interface CareerCompensationRange {
  currency: string;
  min: number;
  max: number;
}

export interface CareerProfileDto {
  id: string;
  userId: string;
  headline: string;
  currentLevel: CareerLevel;
  targetTimelineMonths: number;
  targetCompanyTiers: string[];
  targetLocations: string[];
  targetCompensationRange: CareerCompensationRange | null;
  statedReadiness: StatedReadiness;
  status: CareerStatus;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCareerProfileDto {
  headline: string;
  currentLevel: CareerLevel;
  targetTimelineMonths?: number;
  targetCompanyTiers?: string[];
  targetLocations?: string[];
  targetCompensationRange?: CareerCompensationRange | null;
  statedReadiness?: StatedReadiness;
  status?: CareerStatus;
  metadata?: Record<string, unknown>;
}

export interface UpdateCareerProfileDto {
  headline?: string;
  currentLevel?: CareerLevel;
  targetTimelineMonths?: number;
  targetCompanyTiers?: string[];
  targetLocations?: string[];
  targetCompensationRange?: CareerCompensationRange | null;
  statedReadiness?: StatedReadiness;
  status?: CareerStatus;
  metadata?: Record<string, unknown>;
}

// --- Target Roles ---

export interface CareerTargetRoleDto {
  id: string;
  userId: string;
  title: string;
  roleFamily: RoleFamily;
  seniorityLevel: SeniorityLevel;
  priority: TargetRolePriority;
  targetCompanyTypes: string[];
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  requiredSkillsCount?: number;
}

export interface CreateTargetRoleDto {
  title: string;
  roleFamily: RoleFamily;
  seniorityLevel: SeniorityLevel;
  priority?: TargetRolePriority;
  targetCompanyTypes?: string[];
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateTargetRoleDto {
  title?: string;
  roleFamily?: RoleFamily;
  seniorityLevel?: SeniorityLevel;
  priority?: TargetRolePriority;
  targetCompanyTypes?: string[];
  description?: string | null;
  isActive?: boolean;
}

// --- Career Skills & Taxonomy ---

export interface CareerSkillDto {
  id: string;
  name: string;
  category: SkillCategory;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSkillDto {
  name: string;
  category: SkillCategory;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TargetRoleSkillDto {
  id: string;
  targetRoleId: string;
  skillId: string;
  skillName?: string;
  skillCategory?: SkillCategory;
  importance: SkillImportance;
  minimumProficiency: SkillProficiency;
  createdAt: string;
}

export interface LinkRoleSkillDto {
  skillId: string;
  importance: SkillImportance;
  minimumProficiency: SkillProficiency;
}

// --- User Skills & Tangible Evidence ---

export interface SkillEvidenceDto {
  id: string;
  userSkillId: string;
  userId: string;
  evidenceType: EvidenceType;
  title: string;
  description: string;
  url: string | null;
  validationStatus: EvidenceValidationStatus;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSkillEvidenceDto {
  evidenceType: EvidenceType;
  title: string;
  description: string;
  url?: string | null;
  validationStatus?: EvidenceValidationStatus;
}

export interface UserSkillDto {
  id: string;
  userId: string;
  skillId: string;
  skillName?: string;
  skillCategory?: SkillCategory;
  selfRating: SkillProficiency;
  verifiedLevel: SkillProficiency | null;
  confidenceScore: number;
  lastPracticedAt: string | null;
  notes: string | null;
  evidenceCount?: number;
  evidence?: SkillEvidenceDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserSkillDto {
  skillId: string;
  selfRating: SkillProficiency;
  confidenceScore?: number;
  lastPracticedAt?: string | null;
  notes?: string | null;
}

export interface UpdateUserSkillDto {
  selfRating?: SkillProficiency;
  confidenceScore?: number;
  lastPracticedAt?: string | null;
  notes?: string | null;
}

// --- Preparation Activities ---

export interface CareerPreparationActivityDto {
  id: string;
  userId: string;
  targetRoleId: string | null;
  skillId: string | null;
  skillName?: string;
  activityType: ActivityType;
  title: string;
  status: ActivityStatus;
  durationMinutes: number | null;
  outcomeNotes: string | null;
  performanceScore: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePreparationActivityDto {
  targetRoleId?: string | null;
  skillId?: string | null;
  activityType: ActivityType;
  title: string;
  status?: ActivityStatus;
  durationMinutes?: number | null;
  outcomeNotes?: string | null;
  performanceScore?: number | null;
  completedAt?: string | null;
}

export interface UpdatePreparationActivityDto {
  title?: string;
  status?: ActivityStatus;
  durationMinutes?: number | null;
  outcomeNotes?: string | null;
  performanceScore?: number | null;
  completedAt?: string | null;
}

// --- Gap Analysis & Career Intelligence ---

export interface SkillGapDto {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  importance: SkillImportance;
  requiredProficiency: SkillProficiency;
  currentProficiency: SkillProficiency | 'none';
  hasEvidence: boolean;
  evidenceCount: number;
  gapSeverity: 'critical' | 'moderate' | 'minor';
  reason: string;
}

export interface SkillStrengthDto {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  proficiency: SkillProficiency;
  evidenceCount: number;
  summary: string;
}

export interface NextCareerPriorityDto {
  rank: number;
  skillId?: string;
  skillName?: string;
  title: string;
  action: string;
  urgency: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface CareerGapAnalysisDto {
  id: string;
  userId: string;
  targetRoleId: string;
  targetRoleTitle?: string;
  readinessScore: number;
  statedReadiness: StatedReadiness;
  evidenceAlignmentScore: number;
  readinessDiscrepancy: ReadinessDiscrepancy;
  gaps: SkillGapDto[];
  strengths: SkillStrengthDto[];
  priorities: NextCareerPriorityDto[];
  computedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface EvaluateGapAnalysisDto {
  targetRoleId?: string;
}

// --- Career Context Frame (for Context Assembly & LLM Grounding) ---

export interface CareerContextFrameDto {
  profile?: {
    headline: string;
    currentLevel: CareerLevel;
    targetTimelineMonths: number;
    targetCompanyTiers: string[];
    status: CareerStatus;
  };
  primaryTargetRole?: {
    id: string;
    title: string;
    roleFamily: RoleFamily;
    seniorityLevel: SeniorityLevel;
    priority: TargetRolePriority;
  };
  readinessScore: number;
  statedReadiness: StatedReadiness;
  evidenceAlignmentScore: number;
  readinessDiscrepancy: ReadinessDiscrepancy;
  criticalGaps: Array<{
    skillName: string;
    importance: SkillImportance;
    requiredProficiency: SkillProficiency;
    currentProficiency: SkillProficiency | 'none';
    hasEvidence: boolean;
  }>;
  keyStrengths: Array<{
    skillName: string;
    evidenceCount: number;
  }>;
  recentActivities: Array<{
    title: string;
    activityType: ActivityType;
    status: ActivityStatus;
    completedAt: string | null;
  }>;
  nextPriorities: string[];
}

// ==========================================
// PHASE 6B: PLACEMENT STRATEGY & MOCK EVALUATIONS
// ==========================================

export type PlacementPriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface PlacementStrategyItemDto {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  priority: PlacementPriorityLevel;
  reason: string; // WHY: Insufficient demonstrated evidence for target role
  action: string; // WHAT: Focus area
  recommendedActivity: ActivityType; // NEXT: e.g. mock_interview or system_design_practice
  currentProficiency: SkillProficiency | 'none';
  requiredProficiency: SkillProficiency;
  hasEvidence: boolean;
  linkedLifeTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
  }>;
}

export interface CareerPlacementStrategyDto {
  userId: string;
  targetRole: {
    id: string;
    title: string;
    roleFamily: RoleFamily;
    seniorityLevel: SeniorityLevel;
  } | null;
  currentFocus: string;
  rationale: string;
  priorities: PlacementStrategyItemDto[];
  activeLifeContextPreparation: Array<{
    id: string;
    title: string;
    type: 'task' | 'project' | 'goal';
    status: string;
  }>;
  suggestedMockSession: {
    targetRoleId: string;
    skillId?: string;
    skillName?: string;
    evaluationType: MockEvaluationType;
    suggestedDifficulty: EvaluationDifficulty;
    reason: string;
  } | null;
  readinessDiscrepancy: ReadinessDiscrepancy;
  generatedAt: string;
}

// Mock Evaluation Enums and Types
export type MockEvaluationType =
  | 'technical'
  | 'behavioral'
  | 'system_design'
  | 'skill_assessment';

export type EvaluationDifficulty = 'foundation' | 'intermediate' | 'advanced';

export type EvaluationSessionStatus =
  | 'started'
  | 'in_progress'
  | 'completed'
  | 'abandoned';

export type EvaluationDimensionRating =
  | 'strong'
  | 'adequate'
  | 'developing'
  | 'insufficient';

export interface EvaluationStructuredDimension {
  dimension: 'technical_correctness' | 'reasoning' | 'communication' | 'depth' | 'completeness';
  rating: EvaluationDimensionRating;
  feedback: string;
}

export interface AnswerEvaluationResult {
  overallRating: EvaluationDimensionRating;
  dimensions: EvaluationStructuredDimension[];
  strengths: string[];
  gaps: string[];
  followUpNeeded: boolean;
  suggestedNextDifficulty: EvaluationDifficulty;
  feedbackNotes: string;
  evidenceSummary?: string | null;
}

export interface MockEvaluationAnswerDto {
  id: string;
  questionId: string;
  sessionId: string;
  userId: string;
  answerText: string;
  evaluationStatus: 'pending' | 'evaluated' | 'failed';
  overallRating: EvaluationDimensionRating | null;
  evaluation: AnswerEvaluationResult | null;
  evaluatedAt: string | null;
  createdAt: string;
}

export interface MockEvaluationQuestionDto {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  questionText: string;
  difficulty: EvaluationDifficulty;
  targetedSkill: string;
  contextRationale: string | null;
  answer?: MockEvaluationAnswerDto | null;
  createdAt: string;
}

export interface MockEvaluationSessionDto {
  id: string;
  userId: string;
  targetRoleId: string;
  targetRoleTitle: string;
  skillId: string | null;
  skillName: string | null;
  evaluationType: MockEvaluationType;
  status: EvaluationSessionStatus;
  currentDifficulty: EvaluationDifficulty;
  currentQuestionIndex: number;
  totalPlannedQuestions: number;
  overallRating: EvaluationDimensionRating | null;
  overallScore: number | null;
  summary: string | null;
  startedAt: string;
  completedAt: string | null;
  questions?: MockEvaluationQuestionDto[];
  evidenceGenerated?: SkillEvidenceDto | null;
  createdAt: string;
  updatedAt: string;
}

// Request & Response DTOs
export interface StartMockSessionRequestDto {
  targetRoleId?: string;
  skillId?: string;
  evaluationType?: MockEvaluationType;
  initialDifficulty?: EvaluationDifficulty;
  totalPlannedQuestions?: number;
}

export interface SubmitEvaluationAnswerRequestDto {
  answerText: string;
}

// AI Gateway contracts for interview generation & answer evaluation
export interface GenerateInterviewQuestionRequestDto {
  targetRole: {
    title: string;
    seniorityLevel: string;
    roleFamily: string;
  };
  skill: {
    name: string;
    category?: string;
    requiredProficiency?: string;
    currentProficiency?: string;
  };
  sessionType: MockEvaluationType;
  difficulty: EvaluationDifficulty;
  questionNumber: number;
  totalQuestions: number;
  previousTurns?: Array<{
    question: string;
    answer: string;
    rating: string;
  }>;
  relevantContext?: string[];
  requestId?: string;
}

export interface GenerateInterviewQuestionResponseDto {
  questionText: string;
  difficulty: EvaluationDifficulty;
  targetedSkill: string;
  contextRationale: string;
  provider: string;
  model: string;
  latencyMs: number;
}

export interface EvaluateInterviewAnswerRequestDto {
  targetRole: {
    title: string;
    seniorityLevel: string;
  };
  skill: {
    name: string;
    requiredProficiency?: string;
  };
  sessionType: MockEvaluationType;
  difficulty: EvaluationDifficulty;
  questionText: string;
  userAnswer: string;
  requestId?: string;
}

export interface EvaluateInterviewAnswerResponseDto {
  overallRating: EvaluationDimensionRating;
  dimensions: EvaluationStructuredDimension[];
  strengths: string[];
  gaps: string[];
  followUpNeeded: boolean;
  suggestedNextDifficulty: EvaluationDifficulty;
  feedbackNotes: string;
  evidenceSummary?: string | null;
  provider: string;
  model: string;
  latencyMs: number;
}
