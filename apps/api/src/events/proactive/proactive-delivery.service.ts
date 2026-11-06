import { Injectable, Logger } from '@nestjs/common';
import { EventRepository } from '../event.repository';
import { ProactiveCandidate, ProactiveAction } from '../../database/schema';
import { SynthesizedMessage } from './proactive-message.service';

@Injectable()
export class ProactiveDeliveryService {
  private readonly logger = new Logger(ProactiveDeliveryService.name);

  constructor(private readonly repository: EventRepository) {}

  /**
   * Delivers an in-app proactive action:
   * 1. Creates a durable proactive_actions record.
   * 2. Marks the candidate as evaluated with decision ACT.
   * 3. Sets the topic-level cooldown to prevent repeated interventions.
   */
  async deliverInAppAction(
    candidate: ProactiveCandidate,
    message: SynthesizedMessage,
    cooldownMinutes: number = 720,
  ): Promise<ProactiveAction> {
    const userId = candidate.userId;

    // 1. Create proactive action
    const action = await this.repository.createAction({
      userId,
      candidateId: candidate.id,
      actionType: 'IN_APP_MESSAGE',
      channel: 'in_app',
      title: message.title,
      content: message.content,
      status: 'delivered',
      deliveredAt: new Date(),
      metadata: {
        candidateType: candidate.candidateType,
        topic: candidate.topic,
        urgency: candidate.urgency,
        importance: candidate.importance,
        contextSnapshot: candidate.contextSnapshot,
      },
    });

    // 2. Update candidate record
    await this.repository.updateCandidate(candidate.id, {
      status: 'evaluated',
      decision: 'ACT',
      decisionReason: 'Proactive intervention delivered in-app',
      evaluatedAt: new Date(),
    });

    // 3. Set cooldown
    const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);
    await this.repository.setCooldown(
      userId,
      candidate.topic,
      candidate.candidateType,
      cooldownUntil,
      action.id,
    );

    this.logger.log(
      `[Proactive Action Delivered] Action ID: ${action.id} for user ${userId} on topic "${candidate.topic}" (Cooldown until ${cooldownUntil.toISOString()})`,
    );

    return action;
  }
}
