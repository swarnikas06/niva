import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
  IsArray,
  MaxLength,
  IsNumber,
} from 'class-validator';
import {
  CreateStudyTopicDto,
  UpdateStudyTopicDto,
  StartStudySessionDto,
  CompleteStudySessionDto,
  CreateLearningDifficultyDto,
  UpdateLearningDifficultyDto,
  TopicProgressStatus,
  StudyProficiencyLevel,
  StudySessionType,
  DifficultySource,
  DifficultyStatus,
} from '@niva/shared-types';

export class CreateStudyTopicRequestDto implements CreateStudyTopicDto {
  @ApiPropertyOptional({ description: 'Parent topic UUID for subtopics' })
  @IsOptional()
  @IsUUID()
  parentTopicId?: string | null;

  @ApiProperty({ description: 'Subject or domain name', maxLength: 150, example: 'Distributed Systems' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  subjectName!: string;

  @ApiProperty({ description: 'Topic title', maxLength: 255, example: 'Raft Consensus Algorithm' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ description: 'Topic description', maxLength: 3000 })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'intermediate',
  })
  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  targetProficiency?: StudyProficiencyLevel;

  @ApiPropertyOptional({ description: 'Linked Life Context goal UUID' })
  @IsOptional()
  @IsUUID()
  linkedGoalId?: string | null;

  @ApiPropertyOptional({ description: 'Linked Career skill UUID' })
  @IsOptional()
  @IsUUID()
  linkedSkillId?: string | null;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  learningObjectives?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  prerequisiteTopicIds?: string[];
}

export class UpdateStudyTopicRequestDto implements UpdateStudyTopicDto {
  @ApiPropertyOptional({ description: 'Parent topic UUID' })
  @IsOptional()
  @IsUUID()
  parentTopicId?: string | null;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  subjectName?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ maxLength: 3000 })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ['not_started', 'in_progress', 'practiced', 'demonstrated', 'needs_review'],
  })
  @IsOptional()
  @IsIn(['not_started', 'in_progress', 'practiced', 'demonstrated', 'needs_review'])
  status?: TopicProgressStatus;

  @ApiPropertyOptional({
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
  })
  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  targetProficiency?: StudyProficiencyLevel;

  @ApiPropertyOptional({
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
  })
  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  demonstratedProficiency?: StudyProficiencyLevel | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  linkedGoalId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  linkedSkillId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  learningObjectives?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  prerequisiteTopicIds?: string[];

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  confidenceScore?: number;
}

export class StartStudySessionRequestDto implements StartStudySessionDto {
  @ApiProperty({ description: 'Topic UUID being studied' })
  @IsUUID()
  topicId!: string;

  @ApiPropertyOptional({
    enum: ['concept_study', 'active_recall', 'problem_solving', 'revision', 'exercise'],
    default: 'concept_study',
  })
  @IsOptional()
  @IsIn(['concept_study', 'active_recall', 'problem_solving', 'revision', 'exercise'])
  sessionType?: StudySessionType;

  @ApiPropertyOptional({ maxLength: 3000 })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  userNotes?: string | null;
}

export class CompleteStudySessionRequestDto implements CompleteStudySessionDto {
  @ApiPropertyOptional({ description: 'Actual study duration in minutes', minimum: 1, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: 'Candidate notes and reflections', maxLength: 3000 })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  userNotes?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'List of concepts clearly understood' })
  @IsOptional()
  @IsArray()
  conceptsUnderstood?: string[];

  @ApiPropertyOptional({ type: [String], description: 'List of difficulties or confusing areas' })
  @IsOptional()
  @IsArray()
  difficultiesEncountered?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Actionable follow-up steps' })
  @IsOptional()
  @IsArray()
  followUpActions?: string[];

  @ApiPropertyOptional({ description: 'Evidence of practical mastery or tangible notes', maxLength: 3000 })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  evidenceNotes?: string | null;

  @ApiPropertyOptional({
    enum: ['not_started', 'in_progress', 'practiced', 'demonstrated', 'needs_review'],
  })
  @IsOptional()
  @IsIn(['not_started', 'in_progress', 'practiced', 'demonstrated', 'needs_review'])
  updateTopicStatus?: TopicProgressStatus;

  @ApiPropertyOptional({
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
  })
  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  demonstratedProficiency?: StudyProficiencyLevel;
}

export class UpdateStudySessionRequestDto {
  @ApiPropertyOptional({ maxLength: 10000, description: 'Live scratchpad notes during session' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  userNotes?: string | null;
}

export class CreateLearningDifficultyRequestDto implements CreateLearningDifficultyDto {
  @ApiProperty({ description: 'Topic UUID' })
  @IsUUID()
  topicId!: string;

  @ApiPropertyOptional({ description: 'Associated session UUID' })
  @IsOptional()
  @IsUUID()
  sessionId?: string | null;

  @ApiProperty({ description: 'Specific concept causing confusion', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  concept!: string;

  @ApiProperty({ description: 'Detailed description of the difficulty', maxLength: 3000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  description!: string;

  @ApiPropertyOptional({
    enum: ['user_reported', 'ai_inferred', 'practice_evaluation'],
    default: 'user_reported',
  })
  @IsOptional()
  @IsIn(['user_reported', 'ai_inferred', 'practice_evaluation'])
  source?: DifficultySource;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}

export class UpdateLearningDifficultyRequestDto implements UpdateLearningDifficultyDto {
  @ApiPropertyOptional({ enum: ['active', 'reviewing', 'resolved'] })
  @IsOptional()
  @IsIn(['active', 'reviewing', 'resolved'])
  status?: DifficultyStatus;

  @ApiPropertyOptional({ description: 'Resolution explanation or key breakthrough notes', maxLength: 3000 })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  resolutionNotes?: string | null;
}
