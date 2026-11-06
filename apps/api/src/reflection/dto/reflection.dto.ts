import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsArray,
  MaxLength,
  IsNumber,
  IsBoolean,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  ObservationCategory,
  ObservationConfidenceType,
  EvidenceSourceType,
  SupportingEvidenceRef,
  CreateLongitudinalObservationDto,
  CorrectObservationDto,
} from '@niva/shared-types';

export class SupportingEvidenceRefDto implements SupportingEvidenceRef {
  @ApiProperty({
    enum: [
      'domain_events',
      'study_sessions',
      'learning_difficulties',
      'life_tasks',
      'life_commitments',
      'career_evaluations',
      'conversation_messages',
    ],
  })
  @IsIn([
    'domain_events',
    'study_sessions',
    'learning_difficulties',
    'life_tasks',
    'life_commitments',
    'career_evaluations',
    'conversation_messages',
  ])
  sourceType!: EvidenceSourceType;

  @ApiProperty({ description: 'ID of referenced entity' })
  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @ApiProperty({ description: 'Timestamp when event or evidence occurred' })
  @IsDateString()
  occurredAt!: string;

  @ApiProperty({ description: 'Human readable label or entity description' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  label!: string;

  @ApiPropertyOptional({ description: 'Optional text excerpt or summary' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  snippet?: string;
}

export class CreateLongitudinalObservationRequestDto implements CreateLongitudinalObservationDto {
  @ApiProperty({
    enum: [
      'progress',
      'recurrence',
      'intention_vs_outcome',
      'unresolved_thread',
      'priority_change',
      'learning_development',
      'career_development',
      'decision_follow_up',
      'user_correction',
    ],
  })
  @IsIn([
    'progress',
    'recurrence',
    'intention_vs_outcome',
    'unresolved_thread',
    'priority_change',
    'learning_development',
    'career_development',
    'decision_follow_up',
    'user_correction',
  ])
  category!: ObservationCategory;

  @ApiProperty({ description: 'Descriptive title of the longitudinal observation', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Objective recorded fact with no speculation', maxLength: 3000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  fact!: string;

  @ApiProperty({ description: 'Calibrated interpretation separated from fact', maxLength: 3000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  interpretation!: string;

  @ApiProperty({ type: [SupportingEvidenceRefDto], description: 'Concrete evidence backing this observation' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportingEvidenceRefDto)
  supportingEvidence!: SupportingEvidenceRef[];

  @ApiProperty({ description: 'Start timestamp of analysis window' })
  @IsDateString()
  timeWindowStart!: string;

  @ApiProperty({ description: 'End timestamp of analysis window' })
  @IsDateString()
  timeWindowEnd!: string;

  @ApiProperty({ description: 'Window in days', default: 14 })
  @IsInt()
  @Min(1)
  @Max(90)
  windowDays!: number;

  @ApiProperty({ description: 'Calibrated confidence 0.0 to 1.0', default: 0.8 })
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  confidence!: number;

  @ApiProperty({ enum: ['explicit_statement', 'inferred_pattern'], default: 'inferred_pattern' })
  @IsIn(['explicit_statement', 'inferred_pattern'])
  confidenceType!: ObservationConfidenceType;
}

export class CorrectObservationRequestDto implements CorrectObservationDto {
  @ApiProperty({ description: 'User feedback and correction notes', minLength: 1, maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  correctionNotes!: string;
}

export class GetObservationsQueryDto {
  @ApiPropertyOptional({
    enum: ['active', 'confirmed', 'corrected', 'dismissed', 'superseded', 'all'],
    default: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'confirmed', 'corrected', 'dismissed', 'superseded', 'all'])
  status?: string = 'active';

  @ApiPropertyOptional({
    enum: [
      'progress',
      'recurrence',
      'intention_vs_outcome',
      'unresolved_thread',
      'priority_change',
      'learning_development',
      'career_development',
      'decision_follow_up',
      'user_correction',
    ],
  })
  @IsOptional()
  @IsIn([
    'progress',
    'recurrence',
    'intention_vs_outcome',
    'unresolved_thread',
    'priority_change',
    'learning_development',
    'career_development',
    'decision_follow_up',
    'user_correction',
  ])
  category?: ObservationCategory;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class GenerateReflectionDto {
  @ApiPropertyOptional({ description: 'Window in days for longitudinal pattern analysis', default: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  windowDays?: number = 14;

  @ApiPropertyOptional({ description: 'Force full regeneration instead of using existing active patterns', default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  forceRefresh?: boolean = false;
}

export class GetOverviewQueryDto {
  @ApiPropertyOptional({ description: 'Window in days for longitudinal overview', default: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  windowDays?: number = 14;
}
