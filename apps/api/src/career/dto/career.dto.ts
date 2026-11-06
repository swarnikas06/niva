import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  MaxLength,
  IsNotEmpty,
  IsArray,
  IsBoolean,
  IsObject,
  IsUUID,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CareerLevel,
  CareerStatus,
  StatedReadiness,
  RoleFamily,
  SeniorityLevel,
  TargetRolePriority,
  SkillCategory,
  SkillImportance,
  SkillProficiency,
  EvidenceType,
  EvidenceValidationStatus,
  ActivityType,
  ActivityStatus,
  CreateCareerProfileDto,
  UpdateCareerProfileDto,
  CreateTargetRoleDto,
  UpdateTargetRoleDto,
  CreateSkillDto,
  LinkRoleSkillDto,
  CreateUserSkillDto,
  UpdateUserSkillDto,
  CreateSkillEvidenceDto,
  CreatePreparationActivityDto,
  UpdatePreparationActivityDto,
  EvaluateGapAnalysisDto,
  CareerCompensationRange,
} from '@niva/shared-types';

export class CreateCareerProfileRequestDto implements CreateCareerProfileDto {
  @ApiProperty({ description: 'Career headline', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  headline!: string;

  @ApiProperty({
    enum: ['student', 'entry_level', 'mid_level', 'senior', 'staff_plus', 'career_switcher'],
  })
  @IsIn(['student', 'entry_level', 'mid_level', 'senior', 'staff_plus', 'career_switcher'])
  currentLevel!: CareerLevel;

  @ApiPropertyOptional({ default: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  targetTimelineMonths?: number;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  targetCompanyTiers?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  targetLocations?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  targetCompensationRange?: CareerCompensationRange | null;

  @ApiPropertyOptional({
    enum: ['exploring', 'early_preparation', 'moderate_confidence', 'interview_ready'],
  })
  @IsOptional()
  @IsIn(['exploring', 'early_preparation', 'moderate_confidence', 'interview_ready'])
  statedReadiness?: StatedReadiness;

  @ApiPropertyOptional({
    enum: ['exploring', 'active_preparation', 'interviewing', 'offer_stage', 'accepted', 'paused'],
  })
  @IsOptional()
  @IsIn(['exploring', 'active_preparation', 'interviewing', 'offer_stage', 'accepted', 'paused'])
  status?: CareerStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCareerProfileRequestDto implements UpdateCareerProfileDto {
  @ApiPropertyOptional({ description: 'Career headline', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  headline?: string;

  @ApiPropertyOptional({
    enum: ['student', 'entry_level', 'mid_level', 'senior', 'staff_plus', 'career_switcher'],
  })
  @IsOptional()
  @IsIn(['student', 'entry_level', 'mid_level', 'senior', 'staff_plus', 'career_switcher'])
  currentLevel?: CareerLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  targetTimelineMonths?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  targetCompanyTiers?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  targetLocations?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  targetCompensationRange?: CareerCompensationRange | null;

  @ApiPropertyOptional({
    enum: ['exploring', 'early_preparation', 'moderate_confidence', 'interview_ready'],
  })
  @IsOptional()
  @IsIn(['exploring', 'early_preparation', 'moderate_confidence', 'interview_ready'])
  statedReadiness?: StatedReadiness;

  @ApiPropertyOptional({
    enum: ['exploring', 'active_preparation', 'interviewing', 'offer_stage', 'accepted', 'paused'],
  })
  @IsOptional()
  @IsIn(['exploring', 'active_preparation', 'interviewing', 'offer_stage', 'accepted', 'paused'])
  status?: CareerStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateTargetRoleRequestDto implements CreateTargetRoleDto {
  @ApiProperty({ description: 'Role title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    enum: [
      'software_engineering',
      'systems_infrastructure',
      'data_ai_ml',
      'security',
      'engineering_management',
      'product_management',
      'other',
    ],
  })
  @IsIn([
    'software_engineering',
    'systems_infrastructure',
    'data_ai_ml',
    'security',
    'engineering_management',
    'product_management',
    'other',
  ])
  roleFamily!: RoleFamily;

  @ApiProperty({ enum: ['intern', 'junior', 'mid', 'senior', 'staff', 'principal'] })
  @IsIn(['intern', 'junior', 'mid', 'senior', 'staff', 'principal'])
  seniorityLevel!: SeniorityLevel;

  @ApiPropertyOptional({ enum: ['primary', 'secondary', 'exploratory'], default: 'primary' })
  @IsOptional()
  @IsIn(['primary', 'secondary', 'exploratory'])
  priority?: TargetRolePriority;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  targetCompanyTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTargetRoleRequestDto implements UpdateTargetRoleDto {
  @ApiPropertyOptional({ description: 'Role title', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    enum: [
      'software_engineering',
      'systems_infrastructure',
      'data_ai_ml',
      'security',
      'engineering_management',
      'product_management',
      'other',
    ],
  })
  @IsOptional()
  @IsIn([
    'software_engineering',
    'systems_infrastructure',
    'data_ai_ml',
    'security',
    'engineering_management',
    'product_management',
    'other',
  ])
  roleFamily?: RoleFamily;

  @ApiPropertyOptional({ enum: ['intern', 'junior', 'mid', 'senior', 'staff', 'principal'] })
  @IsOptional()
  @IsIn(['intern', 'junior', 'mid', 'senior', 'staff', 'principal'])
  seniorityLevel?: SeniorityLevel;

  @ApiPropertyOptional({ enum: ['primary', 'secondary', 'exploratory'] })
  @IsOptional()
  @IsIn(['primary', 'secondary', 'exploratory'])
  priority?: TargetRolePriority;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  targetCompanyTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSkillRequestDto implements CreateSkillDto {
  @ApiProperty({ description: 'Skill name', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    enum: [
      'core_technical',
      'systems_architecture',
      'problem_solving',
      'data_infrastructure',
      'leadership_collaboration',
      'communication',
    ],
  })
  @IsIn([
    'core_technical',
    'systems_architecture',
    'problem_solving',
    'data_infrastructure',
    'leadership_collaboration',
    'communication',
  ])
  category!: SkillCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class LinkRoleSkillRequestDto implements LinkRoleSkillDto {
  @ApiProperty({ description: 'Skill UUID' })
  @IsUUID()
  skillId!: string;

  @ApiPropertyOptional({ enum: ['mandatory', 'high_priority', 'nice_to_have'], default: 'high_priority' })
  @IsOptional()
  @IsIn(['mandatory', 'high_priority', 'nice_to_have'])
  importance!: SkillImportance;

  @ApiPropertyOptional({ enum: ['beginner', 'intermediate', 'advanced', 'expert'], default: 'intermediate' })
  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  minimumProficiency!: SkillProficiency;
}

export class CreateUserSkillRequestDto implements CreateUserSkillDto {
  @ApiProperty({ description: 'Skill UUID' })
  @IsUUID()
  skillId!: string;

  @ApiProperty({ enum: ['beginner', 'intermediate', 'advanced', 'expert'] })
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  selfRating!: SkillProficiency;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  confidenceScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastPracticedAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateUserSkillRequestDto implements UpdateUserSkillDto {
  @ApiPropertyOptional({ enum: ['beginner', 'intermediate', 'advanced', 'expert'] })
  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  selfRating?: SkillProficiency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  confidenceScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastPracticedAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class CreateSkillEvidenceRequestDto implements CreateSkillEvidenceDto {
  @ApiProperty({
    enum: [
      'project_artifact',
      'production_experience',
      'open_source_pr',
      'code_review_demo',
      'system_design_doc',
      'mock_interview_score',
      'certification',
      'verbal_explanation',
    ],
  })
  @IsIn([
    'project_artifact',
    'production_experience',
    'open_source_pr',
    'code_review_demo',
    'system_design_doc',
    'mock_interview_score',
    'certification',
    'verbal_explanation',
  ])
  evidenceType!: EvidenceType;

  @ApiProperty({ description: 'Evidence title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Detailed description of artifact/evidence', maxLength: 3000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  description!: string;

  @ApiPropertyOptional({ description: 'URL link to pull request, repository, or document' })
  @IsOptional()
  @IsUrl()
  @MaxLength(1000)
  url?: string | null;

  @ApiPropertyOptional({
    enum: ['unverified', 'demonstrated', 'validated_by_niva', 'stale'],
    default: 'unverified',
  })
  @IsOptional()
  @IsIn(['unverified', 'demonstrated', 'validated_by_niva', 'stale'])
  validationStatus?: EvidenceValidationStatus;
}

export class CreatePreparationActivityRequestDto implements CreatePreparationActivityDto {
  @ApiPropertyOptional({ description: 'Target role UUID' })
  @IsOptional()
  @IsUUID()
  targetRoleId?: string | null;

  @ApiPropertyOptional({ description: 'Skill UUID' })
  @IsOptional()
  @IsUUID()
  skillId?: string | null;

  @ApiProperty({
    enum: [
      'mock_interview',
      'system_design_practice',
      'coding_challenge',
      'rfc_writing',
      'concept_study',
      'behavioral_story_prep',
      'portfolio_project',
    ],
  })
  @IsIn([
    'mock_interview',
    'system_design_practice',
    'coding_challenge',
    'rfc_writing',
    'concept_study',
    'behavioral_story_prep',
    'portfolio_project',
  ])
  activityType!: ActivityType;

  @ApiProperty({ description: 'Activity title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ enum: ['planned', 'in_progress', 'completed', 'abandoned'], default: 'planned' })
  @IsOptional()
  @IsIn(['planned', 'in_progress', 'completed', 'abandoned'])
  status?: ActivityStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  outcomeNotes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  performanceScore?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  completedAt?: string | null;
}

export class UpdatePreparationActivityRequestDto implements UpdatePreparationActivityDto {
  @ApiPropertyOptional({ description: 'Activity title', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ enum: ['planned', 'in_progress', 'completed', 'abandoned'] })
  @IsOptional()
  @IsIn(['planned', 'in_progress', 'completed', 'abandoned'])
  status?: ActivityStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  outcomeNotes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  performanceScore?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  completedAt?: string | null;
}

export class EvaluateGapAnalysisRequestDto implements EvaluateGapAnalysisDto {
  @ApiPropertyOptional({ description: 'Specific target role UUID to evaluate' })
  @IsOptional()
  @IsUUID()
  targetRoleId?: string;
}

export class StartMockSessionRequestDto {
  @ApiPropertyOptional({ description: 'Target role UUID' })
  @IsOptional()
  @IsUUID()
  targetRoleId?: string;

  @ApiPropertyOptional({ description: 'Target skill UUID' })
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @ApiPropertyOptional({
    enum: ['technical', 'behavioral', 'system_design', 'skill_assessment'],
    default: 'technical',
  })
  @IsOptional()
  @IsIn(['technical', 'behavioral', 'system_design', 'skill_assessment'])
  evaluationType?: 'technical' | 'behavioral' | 'system_design' | 'skill_assessment';

  @ApiPropertyOptional({
    enum: ['foundation', 'intermediate', 'advanced'],
    default: 'intermediate',
  })
  @IsOptional()
  @IsIn(['foundation', 'intermediate', 'advanced'])
  initialDifficulty?: 'foundation' | 'intermediate' | 'advanced';

  @ApiPropertyOptional({ default: 3, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  totalPlannedQuestions?: number;
}

export class SubmitEvaluationAnswerRequestDto {
  @ApiProperty({ description: 'User answer to current question', minLength: 1, maxLength: 8000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  answerText!: string;
}

