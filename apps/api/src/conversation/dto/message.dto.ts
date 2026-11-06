import { IsString, IsNotEmpty, MaxLength, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateMessageRequest, ListMessagesQuery } from '@niva/shared-types';

export class CreateMessageDto implements CreateMessageRequest {
  @ApiProperty({ description: 'Message content text', maxLength: 8000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  content!: string;

  @ApiPropertyOptional({ description: 'Optional arbitrary metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class ListMessagesQueryDto implements ListMessagesQuery {
  @ApiPropertyOptional({ description: 'Number of messages to retrieve', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Sequence number cursor for pagination' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cursor?: number;

  @ApiPropertyOptional({
    enum: ['forward', 'backward'],
    description: 'Pagination direction',
    default: 'forward',
  })
  @IsOptional()
  @IsIn(['forward', 'backward'])
  direction?: 'forward' | 'backward' = 'forward';
}
