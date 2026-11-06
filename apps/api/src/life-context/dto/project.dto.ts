import { IsString, IsOptional, IsUUID, IsIn, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { ProjectStatus, CreateProjectRequestDto, UpdateProjectRequestDto } from '@niva/shared-types';

export class CreateProjectDto implements CreateProjectRequestDto {
  @ApiPropertyOptional({ description: 'Parent goal UUID' })
  @IsOptional()
  @IsUUID()
  goalId?: string | null;

  @ApiProperty({ description: 'Project title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ description: 'Project description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ['planning', 'in_progress', 'on_hold', 'completed', 'archived'],
    description: 'Project status',
    default: 'in_progress',
  })
  @IsOptional()
  @IsIn(['planning', 'in_progress', 'on_hold', 'completed', 'archived'])
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: 'Project color code/label', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string | null;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string | null;

  @ApiPropertyOptional({ description: 'Target date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  targetDate?: string | null;
}

export class UpdateProjectDto implements UpdateProjectRequestDto {
  @ApiPropertyOptional({ description: 'Parent goal UUID' })
  @IsOptional()
  @IsUUID()
  goalId?: string | null;

  @ApiPropertyOptional({ description: 'Project title', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Project description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ['planning', 'in_progress', 'on_hold', 'completed', 'archived'],
    description: 'Project status',
  })
  @IsOptional()
  @IsIn(['planning', 'in_progress', 'on_hold', 'completed', 'archived'])
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: 'Project color code/label', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string | null;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string | null;

  @ApiPropertyOptional({ description: 'Target date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  targetDate?: string | null;
}
