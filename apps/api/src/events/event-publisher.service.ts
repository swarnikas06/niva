import { Injectable, Logger } from '@nestjs/common';
import { EventRepository } from './event.repository';
import { DomainEventType, AggregateType, DomainEventDto } from '@niva/shared-types';
import { DomainEvent } from '../database/schema';

export interface PublishDomainEventParams {
  userId: string;
  eventType: DomainEventType;
  aggregateType: AggregateType;
  aggregateId: string;
  payload: Record<string, unknown>;
  eventVersion?: number;
}

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  // Background processor reference injected or hooked dynamically to avoid circular dependencies
  private processorHook?: (eventId?: string) => Promise<void>;

  constructor(private readonly repository: EventRepository) {}

  registerProcessorHook(hook: (eventId?: string) => Promise<void>) {
    this.processorHook = hook;
  }

  /**
   * Publishes a trusted domain event from authoritative internal domain services.
   * Persists durably to the PostgreSQL outbox and triggers asynchronous evaluation.
   */
  async publish(params: PublishDomainEventParams): Promise<DomainEventDto> {
    const { userId, eventType, aggregateType, aggregateId, payload, eventVersion = 1 } = params;

    // 1. Boundary & Sanitization Check: Ensure payload is compact and purposeful
    const cleanPayload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string' && value.length > 2000) {
        cleanPayload[key] = value.slice(0, 2000) + '...[truncated]';
      } else {
        cleanPayload[key] = value;
      }
    }

    // 2. Persist to PostgreSQL durable event store
    const event = await this.repository.createEvent({
      userId,
      eventType,
      eventVersion,
      aggregateType,
      aggregateId,
      payload: cleanPayload,
      occurredAt: new Date(),
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
    });

    this.logger.log(
      `[Event Published] ${eventType} (v${eventVersion}) for user ${userId} on ${aggregateType}:${aggregateId} (Event ID: ${event.id})`,
    );

    // 3. Asynchronously invoke processor without blocking caller turn
    if (this.processorHook) {
      setImmediate(() => {
        this.processorHook!(event.id).catch((err) => {
          this.logger.error(`Asynchronous processing failed for event ${event.id}:`, err);
        });
      });
    }

    return this.mapToDto(event);
  }

  private mapToDto(event: DomainEvent): DomainEventDto {
    return {
      id: event.id,
      userId: event.userId,
      eventType: event.eventType as DomainEventType,
      eventVersion: event.eventVersion,
      aggregateType: event.aggregateType as AggregateType,
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
