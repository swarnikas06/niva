import { IsString, IsOptional, IsInt, Min, Max, IsIn, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { GoalCategory, GoalStatus, CreateGoalRequestDto, UpdateGoalRequestDto } from '@niva/shared-types';

export class CreateGoalDto implements CreateGoalRequestDto {
  @ApiProperty({ description: 'Goal title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ description: 'Goal detailed description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiProperty({
    enum: ['career', 'technical', 'academic', 'personal', 'health'],
    description: 'Goal category',
  })
  @IsIn(['career', 'technical', 'academic', 'personal', 'health'])
  category!: GoalCategory;

  @ApiPropertyOptional({ description: 'Target completion date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  targetDate?: string | null;

  @ApiPropertyOptional({
    enum: ['high', 'medium', 'low'],
    description: 'Goal priority',
    default: 'medium',
  })
  @IsOptional()
  @IsIn(['high', 'medium', 'low'])
  priority?: 'high' | 'medium' | 'low';

  @ApiPropertyOptional({ description: 'Progress percentage (0-100)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercentage?: number;
}

export class UpdateGoalDto implements UpdateGoalRequestDto {
  @ApiPropertyOptional({ description: 'Goal title', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Goal detailed description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ['career', 'technical', 'academic', 'personal', 'health'],
    description: 'Goal category',
  })
  @IsOptional()
  @IsIn(['career', 'technical', 'academic', 'personal', 'health'])
  category?: GoalCategory;

  @ApiPropertyOptional({ description: 'Target completion date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  targetDate?: string | null;

  @ApiPropertyOptional({
    enum: ['active', 'completed', 'paused', 'abandoned'],
    description: 'Goal status',
  })
  @IsOptional()
  @IsIn(['active', 'completed', 'paused', 'abandoned'])
  status?: GoalStatus;

  @ApiPropertyOptional({
    enum: ['high', 'medium', 'low'],
    description: 'Goal priority',
  })
  @IsOptional()
  @IsIn(['high', 'medium', 'low'])
  priority?: 'high' | 'medium' | 'low';

  @ApiPropertyOptional({ description: 'Progress percentage (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercentage?: number;
}
