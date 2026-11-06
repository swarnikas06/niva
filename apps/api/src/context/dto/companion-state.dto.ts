import { IsOptional, IsIn, IsUUID, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CompanionPresenceStatus,
  InteractionMode,
  UpdateCompanionStateDto as IUpdateCompanionStateDto,
} from '@niva/shared-types';

export class UpdateCompanionStateDto implements IUpdateCompanionStateDto {
  @ApiPropertyOptional({
    enum: ['active', 'idle', 'focused', 'reflecting'],
    description: 'Operational presence status of the companion',
  })
  @IsOptional()
  @IsIn(['active', 'idle', 'focused', 'reflecting'])
  presenceStatus?: CompanionPresenceStatus;

  @ApiPropertyOptional({
    enum: ['chat', 'study', 'planning', 'review'],
    description: 'Current interaction mode with the companion',
  })
  @IsOptional()
  @IsIn(['chat', 'study', 'planning', 'review'])
  interactionMode?: InteractionMode;

  @ApiPropertyOptional({
    description: 'UUID of the active focus goal (or null to clear)',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  activeFocusGoalId?: string | null;

  @ApiPropertyOptional({
    description: 'UUID of the active focus project (or null to clear)',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  activeFocusProjectId?: string | null;

  @ApiPropertyOptional({
    description: 'Arbitrary operational metadata',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
