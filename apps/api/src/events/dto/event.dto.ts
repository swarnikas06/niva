import { IsString, IsOptional, IsIn, IsInt, IsBoolean, Min, Max, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  DomainEventType,
  EventProcessingStatus,
  ProactiveActionStatus,
} from '@niva/shared-types';

export class ListEventsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by event status' })
  @IsOptional()
  @IsIn(['pending', 'processing', 'processed', 'failed', 'dead_letter'])
  status?: EventProcessingStatus;

  @ApiPropertyOptional({ description: 'Filter by event type' })
  @IsOptional()
  @IsString()
  eventType?: DomainEventType;

  @ApiPropertyOptional({ description: 'Number of events to return', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Pagination offset', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class ListProactiveActionsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by action status', default: 'delivered' })
  @IsOptional()
  @IsIn(['pending_delivery', 'delivered', 'dismissed', 'acted_upon'])
  status?: ProactiveActionStatus;

  @ApiPropertyOptional({ description: 'Number of actions to return', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Pagination offset', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class UpdateUserProactivePreferencesDto {
  @ApiPropertyOptional({ description: 'Master toggle for proactive companion behavior' })
  @IsOptional()
  @IsBoolean()
  proactiveEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable quiet hours suppression' })
  @IsOptional()
  @IsBoolean()
  quietHoursEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Quiet hours start time (HH:mm)', example: '22:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'quietHoursStart must be in HH:mm format' })
  quietHoursStart?: string;

  @ApiPropertyOptional({ description: 'Quiet hours end time (HH:mm)', example: '08:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'quietHoursEnd must be in HH:mm format' })
  quietHoursEnd?: string;

  @ApiPropertyOptional({ description: 'User IANA timezone identifier', example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Maximum daily proactive interventions', default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxDailyInteractions?: number;

  @ApiPropertyOptional({ description: 'Allow high urgency actions during quiet hours', default: false })
  @IsOptional()
  @IsBoolean()
  allowHighUrgencyInQuietHours?: boolean;

  @ApiPropertyOptional({ description: 'Enable in-app notifications', default: true })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable browser push notifications', default: true })
  @IsOptional()
  @IsBoolean()
  browserEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable email notifications', default: false })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Advance reminder notice in days', default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  advanceReminderDays?: number;

  @ApiPropertyOptional({ description: 'Progress check lead time in hours', default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(72)
  progressCheckHours?: number;

  @ApiPropertyOptional({ description: 'Final alert lead time in hours', default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  finalReminderHours?: number;

  @ApiPropertyOptional({ description: 'Enable morning check-in companion moment', default: true })
  @IsOptional()
  @IsBoolean()
  morningCheckinEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Morning check-in time (HH:mm)', example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'morningCheckinTime must be in HH:mm format' })
  morningCheckinTime?: string;

  @ApiPropertyOptional({ description: 'Enable evening check-in companion moment', default: true })
  @IsOptional()
  @IsBoolean()
  eveningCheckinEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Evening check-in time (HH:mm)', example: '18:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'eveningCheckinTime must be in HH:mm format' })
  eveningCheckinTime?: string;

  @ApiPropertyOptional({ description: 'Enable weekly reflection companion moment', default: true })
  @IsOptional()
  @IsBoolean()
  weeklyReflectionEnabled?: boolean;

  @ApiPropertyOptional({ description: 'List of enabled notification categories' })
  @IsOptional()
  enabledCategories?: string[];
}

export class ProcessEventsQueryDto {
  @ApiPropertyOptional({ description: 'Batch size limit for event processing', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
