import { IsString, IsOptional, IsUUID, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  MemoryCategory,
  MemoryCandidateStatus,
  MemoryExtractionJobStatus,
} from '@niva/shared-types';

export class CreateExtractionJobDto {
  @ApiProperty({ description: 'Conversation ID to extract from', format: 'uuid' })
  @IsUUID()
  conversationId!: string;

  @ApiPropertyOptional({ description: 'Optional turn message ID', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  messageId?: string;

  @ApiPropertyOptional({ description: 'Optional turn context snapshot' })
  @IsOptional()
  turnContext?: Record<string, unknown>;
}

export class ListMemoryJobsQueryDto {
  @ApiPropertyOptional({
    enum: ['pending', 'processing', 'completed', 'failed'],
    description: 'Filter by job status',
  })
  @IsOptional()
  @IsIn(['pending', 'processing', 'completed', 'failed'])
  status?: MemoryExtractionJobStatus;

  @ApiPropertyOptional({ description: 'Number of jobs to return', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ListMemoryCandidatesQueryDto {
  @ApiPropertyOptional({
    enum: ['pending', 'accepted', 'rejected', 'failed', 'deferred'],
    description: 'Filter by candidate status',
  })
  @IsOptional()
  @IsIn(['pending', 'accepted', 'rejected', 'failed', 'deferred'])
  status?: MemoryCandidateStatus;

  @ApiPropertyOptional({
    enum: ['semantic_fact', 'user_preference', 'episodic_event', 'open_loop'],
    description: 'Filter by memory category',
  })
  @IsOptional()
  @IsIn(['semantic_fact', 'user_preference', 'episodic_event', 'open_loop'])
  category?: MemoryCategory;

  @ApiPropertyOptional({ description: 'Number of candidates to return', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class ListMemoriesQueryDto {
  @ApiPropertyOptional({
    enum: ['active', 'superseded', 'archived', 'deleted'],
    description: 'Filter by memory status',
    default: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'superseded', 'archived', 'deleted'])
  status?: string = 'active';

  @ApiPropertyOptional({
    enum: ['semantic_fact', 'user_preference', 'episodic_event', 'open_loop'],
    description: 'Filter by memory category',
  })
  @IsOptional()
  @IsIn(['semantic_fact', 'user_preference', 'episodic_event', 'open_loop'])
  category?: MemoryCategory;

  @ApiPropertyOptional({ description: 'Search term to match against memory content' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Number of memories to return', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Offset for pagination', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class GenerateMemoryEmbeddingDto {
  @ApiPropertyOptional({
    description: 'Explicit text to embed; defaults to the durable memory content if omitted',
  })
  @IsOptional()
  @IsString()
  text?: string;
}
