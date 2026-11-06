import { Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../event.repository';
import {
  UserProactivePreferencesDto,
  ProactiveActionDto,
  DomainEventDto,
} from '@niva/shared-types';

export interface PaginatedEventsResult {
  data: DomainEventDto[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
import {
  ListProactiveActionsQueryDto,
  UpdateUserProactivePreferencesDto,
  ListEventsQueryDto,
} from '../dto/event.dto';
import { ProactiveAction, UserProactivePreferences, DomainEvent } from '../../database/schema';

@Injectable()
export class ProactiveService {
  constructor(private readonly repository: EventRepository) {}

  /**
   * Retrieves user's proactive preferences or defaults if not yet customized.
   */
  async getPreferences(userId: string): Promise<UserProactivePreferencesDto> {
    let prefs = await this.repository.getUserPreferences(userId);
    if (!prefs) {
      prefs = await this.repository.upsertUserPreferences(userId, {
        proactiveEnabled: true,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        timezone: 'UTC',
        maxDailyInteractions: 3,
        allowHighUrgencyInQuietHours: false,
      });
    }

    return this.mapPreferencesToDto(prefs);
  }

  /**
   * Updates user proactive companion preferences.
   */
  async updatePreferences(
    userId: string,
    dto: UpdateUserProactivePreferencesDto,
  ): Promise<UserProactivePreferencesDto> {
    const updated = await this.repository.upsertUserPreferences(userId, {
      ...(dto.proactiveEnabled !== undefined && { proactiveEnabled: dto.proactiveEnabled }),
      ...(dto.quietHoursEnabled !== undefined && { quietHoursEnabled: dto.quietHoursEnabled }),
      ...(dto.quietHoursStart !== undefined && { quietHoursStart: dto.quietHoursStart }),
      ...(dto.quietHoursEnd !== undefined && { quietHoursEnd: dto.quietHoursEnd }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      ...(dto.maxDailyInteractions !== undefined && { maxDailyInteractions: dto.maxDailyInteractions }),
      ...(dto.allowHighUrgencyInQuietHours !== undefined && {
        allowHighUrgencyInQuietHours: dto.allowHighUrgencyInQuietHours,
      }),
      ...(dto.inAppEnabled !== undefined && { inAppEnabled: dto.inAppEnabled }),
      ...(dto.browserEnabled !== undefined && { browserEnabled: dto.browserEnabled }),
      ...(dto.emailEnabled !== undefined && { emailEnabled: dto.emailEnabled }),
      ...(dto.advanceReminderDays !== undefined && { advanceReminderDays: dto.advanceReminderDays }),
      ...(dto.progressCheckHours !== undefined && { progressCheckHours: dto.progressCheckHours }),
      ...(dto.finalReminderHours !== undefined && { finalReminderHours: dto.finalReminderHours }),
      ...(dto.morningCheckinEnabled !== undefined && { morningCheckinEnabled: dto.morningCheckinEnabled }),
      ...(dto.morningCheckinTime !== undefined && { morningCheckinTime: dto.morningCheckinTime }),
      ...(dto.eveningCheckinEnabled !== undefined && { eveningCheckinEnabled: dto.eveningCheckinEnabled }),
      ...(dto.eveningCheckinTime !== undefined && { eveningCheckinTime: dto.eveningCheckinTime }),
      ...(dto.weeklyReflectionEnabled !== undefined && { weeklyReflectionEnabled: dto.weeklyReflectionEnabled }),
      ...(dto.enabledCategories !== undefined && { enabledCategories: dto.enabledCategories as any }),
    });

    return this.mapPreferencesToDto(updated);
  }

  /**
   * Lists delivered proactive actions for the authenticated user.
   */
  async listActions(
    userId: string,
    query: ListProactiveActionsQueryDto,
  ): Promise<ProactiveActionDto[]> {
    const actions = await this.repository.findActionsByUser(userId, {
      status: query.status || 'delivered',
      limit: query.limit || 20,
      offset: query.offset || 0,
    });

    return actions.map((a) => this.mapActionToDto(a));
  }

  /**
   * Dismisses an in-app proactive action for the authenticated user.
   */
  async dismissAction(actionId: string, userId: string): Promise<ProactiveActionDto> {
    const action = await this.repository.dismissAction(actionId, userId);
    if (!action) {
      throw new NotFoundException(`Proactive action '${actionId}' not found or not owned by user`);
    }

    return this.mapActionToDto(action);
  }

  /**
   * Lists audit events for the authenticated user.
   */
  async listEvents(
    userId: string,
    query: ListEventsQueryDto,
  ): Promise<PaginatedEventsResult> {
    const [events, total] = await Promise.all([
      this.repository.findEventsByUser(userId, {
        status: query.status,
        eventType: query.eventType,
        limit: query.limit || 20,
        offset: query.offset || 0,
      }),
      this.repository.countEventsByUser(userId, {
        status: query.status,
        eventType: query.eventType,
      }),
    ]);

    return {
      data: events.map((e) => this.mapEventToDto(e)),
      total,
      limit: query.limit || 20,
      offset: query.offset || 0,
      hasMore: (query.offset || 0) + events.length < total,
    };
  }

  private mapPreferencesToDto(prefs: UserProactivePreferences): UserProactivePreferencesDto {
    return {
      id: prefs.id,
      userId: prefs.userId,
      proactiveEnabled: prefs.proactiveEnabled,
      quietHoursEnabled: prefs.quietHoursEnabled,
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
      timezone: prefs.timezone,
      maxDailyInteractions: prefs.maxDailyInteractions,
      allowHighUrgencyInQuietHours: prefs.allowHighUrgencyInQuietHours,
      inAppEnabled: prefs.inAppEnabled ?? true,
      browserEnabled: prefs.browserEnabled ?? true,
      emailEnabled: prefs.emailEnabled ?? false,
      advanceReminderDays: prefs.advanceReminderDays ?? 2,
      progressCheckHours: prefs.progressCheckHours ?? 24,
      finalReminderHours: prefs.finalReminderHours ?? 2,
      morningCheckinEnabled: (prefs as any).morningCheckinEnabled ?? true,
      morningCheckinTime: (prefs as any).morningCheckinTime || '09:00',
      eveningCheckinEnabled: (prefs as any).eveningCheckinEnabled ?? true,
      eveningCheckinTime: (prefs as any).eveningCheckinTime || '18:00',
      weeklyReflectionEnabled: (prefs as any).weeklyReflectionEnabled ?? true,
      enabledCategories: (prefs as any).enabledCategories || [
        'deadline_reminders',
        'study_checkins',
        'project_followups',
        'goal_progress',
        'daily_companion',
        'milestone_acknowledgements',
        'gentle_inactivity',
      ],
      createdAt: prefs.createdAt.toISOString(),
      updatedAt: prefs.updatedAt.toISOString(),
    };
  }

  private mapActionToDto(action: ProactiveAction): ProactiveActionDto {
    return {
      id: action.id,
      userId: action.userId,
      candidateId: action.candidateId,
      actionType: action.actionType as any,
      channel: action.channel,
      title: action.title,
      content: action.content,
      status: action.status as any,
      deliveredAt: action.deliveredAt ? action.deliveredAt.toISOString() : null,
      metadata: (action.metadata as Record<string, unknown>) || {},
      createdAt: action.createdAt.toISOString(),
      updatedAt: action.updatedAt.toISOString(),
    };
  }

  private mapEventToDto(event: DomainEvent): DomainEventDto {
    return {
      id: event.id,
      userId: event.userId,
      eventType: event.eventType as any,
      eventVersion: event.eventVersion,
      aggregateType: event.aggregateType as any,
      aggregateId: event.aggregateId,
      payload: (event.payload as Record<string, unknown>) || {},
      occurredAt: event.occurredAt.toISOString(),
      status: event.status as any,
      retryCount: event.retryCount,
      maxRetries: event.maxRetries,
      lastError: event.lastError,
      processedAt: event.processedAt ? event.processedAt.toISOString() : null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
