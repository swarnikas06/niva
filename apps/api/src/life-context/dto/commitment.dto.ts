import { IsString, IsOptional, IsUUID, IsIn, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  CommitmentType,
  CommitmentStatus,
  CommitmentImportance,
  CreateCommitmentRequestDto,
  UpdateCommitmentRequestDto,
} from '@niva/shared-types';

export class CreateCommitmentDto implements CreateCommitmentRequestDto {
  @ApiProperty({ description: 'Commitment title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ description: 'Commitment description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiProperty({
    enum: ['interview', 'exam', 'deadline', 'meeting', 'habit_routine'],
    description: 'Commitment type',
  })
  @IsIn(['interview', 'exam', 'deadline', 'meeting', 'habit_routine'])
  commitmentType!: CommitmentType;

  @ApiProperty({ description: 'Due timestamp (ISO 8601)' })
  @IsString()
  @IsNotEmpty()
  dueAt!: string;

  @ApiPropertyOptional({
    enum: ['critical', 'high', 'standard'],
    description: 'Commitment importance',
    default: 'standard',
  })
  @IsOptional()
  @IsIn(['critical', 'high', 'standard'])
  importance?: CommitmentImportance;

  @ApiPropertyOptional({ description: 'Related goal UUID' })
  @IsOptional()
  @IsUUID()
  relatedGoalId?: string | null;

  @ApiPropertyOptional({ description: 'Related project UUID' })
  @IsOptional()
  @IsUUID()
  relatedProjectId?: string | null;
}

export class UpdateCommitmentDto implements UpdateCommitmentRequestDto {
  @ApiPropertyOptional({ description: 'Commitment title', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Commitment description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ['interview', 'exam', 'deadline', 'meeting', 'habit_routine'],
    description: 'Commitment type',
  })
  @IsOptional()
  @IsIn(['interview', 'exam', 'deadline', 'meeting', 'habit_routine'])
  commitmentType?: CommitmentType;

  @ApiPropertyOptional({ description: 'Due timestamp (ISO 8601)' })
  @IsOptional()
  @IsString()
  dueAt?: string;

  @ApiPropertyOptional({
    enum: ['upcoming', 'fulfilled', 'missed', 'rescheduled'],
    description: 'Commitment status',
  })
  @IsOptional()
  @IsIn(['upcoming', 'fulfilled', 'missed', 'rescheduled'])
  status?: CommitmentStatus;

  @ApiPropertyOptional({
    enum: ['critical', 'high', 'standard'],
    description: 'Commitment importance',
  })
  @IsOptional()
  @IsIn(['critical', 'high', 'standard'])
  importance?: CommitmentImportance;

  @ApiPropertyOptional({ description: 'Related goal UUID' })
  @IsOptional()
  @IsUUID()
  relatedGoalId?: string | null;

  @ApiPropertyOptional({ description: 'Related project UUID' })
  @IsOptional()
  @IsUUID()
  relatedProjectId?: string | null;
}
