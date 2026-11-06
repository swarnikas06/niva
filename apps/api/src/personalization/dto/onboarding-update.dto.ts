import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  PrimaryFocus,
  ProactivityLevel,
  ResponseLength,
  OnboardingStep,
  OnboardingUpdateRequestDto,
} from '@niva/shared-types';

export class OnboardingUpdateDto implements OnboardingUpdateRequestDto {
  @ApiProperty({
    enum: ['identity', 'focus', 'archetype', 'tone', 'completed', 'skipped'],
    description: 'Current or target onboarding step',
  })
  @IsIn(['identity', 'focus', 'archetype', 'tone', 'completed', 'skipped'])
  step!: OnboardingStep;

  @ApiPropertyOptional({ description: 'Preferred name for companion to use' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredName?: string;

  @ApiPropertyOptional({ description: 'Occupation or current role/stage' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupationRole?: string;

  @ApiPropertyOptional({
    enum: ['technical_placement', 'deep_work', 'academic_learning', 'general_growth'],
    description: 'Primary focus area for companion assistance',
  })
  @IsOptional()
  @IsIn(['technical_placement', 'deep_work', 'academic_learning', 'general_growth'])
  primaryFocus?: PrimaryFocus;

  @ApiPropertyOptional({ description: 'Selected character archetype ID' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  selectedArchetypeId?: string;

  @ApiPropertyOptional({ description: 'Warmth score (1-100)', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  warmth?: number;

  @ApiPropertyOptional({ description: 'Directness score (1-100)', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  directness?: number;

  @ApiPropertyOptional({ description: 'Humor score (1-100)', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  humor?: number;

  @ApiPropertyOptional({ description: 'Challenge level score (1-100)', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  challengeLevel?: number;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  proactivity?: ProactivityLevel;

  @ApiPropertyOptional({ enum: ['concise', 'balanced', 'thorough'] })
  @IsOptional()
  @IsIn(['concise', 'balanced', 'thorough'])
  responseLength?: ResponseLength;

  @ApiPropertyOptional({ description: 'Mark onboarding as completed' })
  @IsOptional()
  @IsBoolean()
  complete?: boolean;

  @ApiPropertyOptional({ description: 'Skip onboarding with defaults' })
  @IsOptional()
  @IsBoolean()
  skip?: boolean;
}
