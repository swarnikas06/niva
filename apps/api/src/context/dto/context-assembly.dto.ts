import { IsOptional, IsUUID, IsInt, Min, Max, IsBoolean, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { AssembleContextQueryDto as IAssembleContextQueryDto } from '@niva/shared-types';

export class AssembleContextQueryDto implements IAssembleContextQueryDto {
  @ApiPropertyOptional({
    description: 'Specific conversation ID to assemble dialogue context from. If omitted, uses the most recent active conversation.',
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Estimated token budget for context assembly',
    default: 4000,
    minimum: 500,
    maximum: 32000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  @Max(32000)
  maxTokens?: number = 4000;

  @ApiPropertyOptional({
    description: 'Whether to persist an auditable snapshot of the assembled context frame',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  persistSnapshot?: boolean = false;

  @ApiPropertyOptional({
    description: 'Reason for triggering context assembly (e.g. conversation_turn, life_update, manual_query)',
    default: 'manual_query',
  })
  @IsOptional()
  @IsString()
  triggerReason?: string = 'manual_query';

  @ApiPropertyOptional({
    description: 'Current turn user message text used for relevant memory retrieval and vector search',
  })
  @IsOptional()
  @IsString()
  currentMessage?: string;

  @ApiPropertyOptional({
    description: 'Token budget allocated specifically to relevant persistent memories',
    default: 400,
    minimum: 50,
    maximum: 2000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(2000)
  memoryTokenBudget?: number = 400;
}
