import { IsString, IsOptional, MaxLength, IsNotEmpty, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ConversationStatus,
  CreateConversationRequest,
  UpdateConversationRequest,
  ListConversationsQuery,
} from '@niva/shared-types';

export class CreateConversationDto implements CreateConversationRequest {
  @ApiProperty({ description: 'Character Archetype ID', example: 'aria' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  characterId!: string;

  @ApiPropertyOptional({ description: 'Optional conversation title', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Optional arbitrary metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateConversationDto implements UpdateConversationRequest {
  @ApiPropertyOptional({ description: 'Conversation title', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ enum: ['active', 'archived'], description: 'Conversation status' })
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: ConversationStatus;

  @ApiPropertyOptional({ description: 'Character Archetype ID', example: 'atlas' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  characterId?: string;

  @ApiPropertyOptional({ description: 'Optional arbitrary metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class ListConversationsQueryDto implements ListConversationsQuery {
  @ApiPropertyOptional({ enum: ['active', 'archived'], description: 'Filter by status' })
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: ConversationStatus;

  @ApiPropertyOptional({ description: 'Page limit', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Page offset', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
