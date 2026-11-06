import { Injectable } from '@nestjs/common';
import { ProactiveCandidate } from '../../database/schema';
import { PersonalizationService } from '../../personalization/personalization.service';

export interface SynthesizedMessage {
  title: string;
  content: string;
}

@Injectable()
export class ProactiveMessageService {
  constructor(private readonly personalizationService: PersonalizationService) {}

  /**
   * Synthesizes a concise, persona-grounded proactive message based on:
   * 1. Candidate type and contextual snapshot
   * 2. User's preferred name
   * 3. Selected companion character archetype (niva_anchor, niva_sage, niva_spark, niva_challenger)
   */
  async synthesizeMessage(candidate: ProactiveCandidate): Promise<SynthesizedMessage> {
    const userId = candidate.userId;
    const personalization = await this.personalizationService.getPersonalization(userId);
    const preferredName = personalization?.preferredName || 'there';
    const archetypeId = personalization?.selectedArchetypeId || 'niva_anchor';
    const snapshot = (candidate.contextSnapshot as Record<string, any>) || {};

    switch (candidate.candidateType) {
      case 'task_postponed_checkin':
        return this.synthesizeTaskPostponed(preferredName, archetypeId, snapshot, candidate.topic);

      case 'commitment_reminder':
        return this.synthesizeCommitmentReminder(preferredName, archetypeId, snapshot, candidate.topic);

      case 'celebrate_task_completed':
        return this.synthesizeTaskCompleted(preferredName, archetypeId, snapshot, candidate.topic);

      default:
        return {
          title: `Check-in: ${candidate.topic}`,
          content: `Hey ${preferredName}, just wanted to check in regarding "${candidate.topic}". Let me know if you need anything!`,
        };
    }
  }

  private synthesizeTaskPostponed(
    name: string,
    archetypeId: string,
    snapshot: Record<string, any>,
    topic: string,
  ): SynthesizedMessage {
    const taskTitle = snapshot.title || topic;
    const count = snapshot.postponementCount || 1;
    const title = `Task Check-in: ${taskTitle}`;

    let content = '';
    switch (archetypeId) {
      case 'niva_catalyst':
      case 'niva_spark':
        content =
          count > 1
            ? `Hey ${name}! I noticed "${taskTitle}" moved back again. Anything I can do to help you take that first bite-sized step?`
            : `Hey ${name}, "${taskTitle}" was postponed. Whenever you're ready to pick it back up, let me know.`;
        break;

      case 'niva_guide':
      case 'niva_sage':
        content =
          count > 1
            ? `I noticed "${taskTitle}" was rescheduled a couple of times, ${name}. If priorities shifted or there's friction, I'm here if you want to reflect on it.`
            : `A gentle note: "${taskTitle}" was rescheduled. Take your time, and let me know if you want to revisit the plan.`;
        break;

      case 'niva_strategist':
      case 'niva_challenger':
        content =
          count > 1
            ? `${name}, "${taskTitle}" has been postponed ${count} times now. Is this still genuinely a priority today, or should we be honest and drop or delegate it?`
            : `"${taskTitle}" was pushed back, ${name}. What's the blocker holding it up?`;
        break;

      case 'niva_anchor':
      default:
        content =
          count > 1
            ? `Hey ${name}, I noticed "${taskTitle}" got postponed a couple of times. No stress at all — do you want to break it down, or push it to when you have more breathing room?`
            : `Hey ${name}, noticed "${taskTitle}" was postponed. Let me know if you want to tackle it together later or adjust your plan.`;
        break;
    }

    return { title, content };
  }

  private synthesizeCommitmentReminder(
    name: string,
    archetypeId: string,
    snapshot: Record<string, any>,
    topic: string,
  ): SynthesizedMessage {
    const commitmentTitle = snapshot.title || topic;
    const title = `Commitment Reminder: ${commitmentTitle}`;

    let content = '';
    switch (archetypeId) {
      case 'niva_catalyst':
      case 'niva_spark':
        content = `Quick reminder, ${name}: your commitment for "${commitmentTitle}" is coming up soon. Let me know if you'd like to prepare or review anything.`;
        break;

      case 'niva_guide':
      case 'niva_sage':
        content = `A gentle reminder regarding your commitment: "${commitmentTitle}". Let me know if you need to review any notes or details beforehand.`;
        break;

      case 'niva_strategist':
      case 'niva_challenger':
        content = `${name}, quick check on your commitment: "${commitmentTitle}". Make sure you're prepped and ready on time.`;
        break;

      case 'niva_anchor':
      default:
        content = `Just keeping "${commitmentTitle}" on your radar, ${name}. Take your time, but wanted to ensure it doesn't slip through the cracks.`;
        break;
    }

    return { title, content };
  }

  private synthesizeTaskCompleted(
    name: string,
    archetypeId: string,
    snapshot: Record<string, any>,
    topic: string,
  ): SynthesizedMessage {
    const taskTitle = snapshot.title || topic;
    const title = `Task Completed: ${taskTitle}`;

    let content = '';
    switch (archetypeId) {
      case 'niva_catalyst':
      case 'niva_spark':
        content = `"${taskTitle}" is checked off. Good forward momentum, ${name}.`;
        break;

      case 'niva_guide':
      case 'niva_sage':
        content = `Nicely done finishing "${taskTitle}", ${name}. Steady consistency like this creates lasting progress.`;
        break;

      case 'niva_strategist':
      case 'niva_challenger':
        content = `"${taskTitle}" done. Solid focus, ${name}. Ready for what's next?`;
        break;

      case 'niva_anchor':
      default:
        content = `"${taskTitle}" is checked off, ${name}. Steady progress.`;
        break;
    }

    return { title, content };
  }
}
