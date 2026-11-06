import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventRepository } from '../event.repository';
import { LifeContextRepository } from '../../life-context/life-context.repository';
import { NotificationDeliveryService } from '../../notifications/notification-delivery.service';
import { PersonalizationService } from '../../personalization/personalization.service';
import { ProactivePolicyService } from './proactive-policy.service';
import { UserProactivePreferences } from '../../database/schema';
import { CandidateUrgency } from '@niva/shared-types';

export interface IntelligentNotificationCandidate {
  category: string;
  topic: string;
  urgency: CandidateUrgency;
  importance: number;
  contextSnapshot: Record<string, any>;
  actionUrl: string;
}

export interface MomentEvaluationOutcome {
  evaluated: boolean;
  decision: 'ACT' | 'DEFER' | 'NO_ACTION';
  reason: string;
  candidateCategory?: string;
  notificationId?: string;
  title?: string;
  body?: string;
  channel?: string;
}

@Injectable()
export class NotificationIntelligenceService {
  private readonly logger = new Logger(NotificationIntelligenceService.name);

  constructor(
    private readonly repository: EventRepository,
    private readonly lifeRepository: LifeContextRepository,
    @Inject(forwardRef(() => NotificationDeliveryService))
    private readonly deliveryService: NotificationDeliveryService,
    private readonly personalizationService: PersonalizationService,
    private readonly policyService: ProactivePolicyService,
  ) {}

  /**
   * Evaluates user context, generates highest-leverage candidate moment,
   * tests against quiet-hours / cooldown / deduplication policies,
   * synthesizes persona-grounded message, and delivers across channels.
   */
  async evaluateAndDeliverMoment(
    userId: string,
    forcedCategory?: string,
  ): Promise<MomentEvaluationOutcome> {
    // 1. Fetch user preferences
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

    if (!prefs.proactiveEnabled) {
      return {
        evaluated: true,
        decision: 'NO_ACTION',
        reason: 'Proactive companion behavior disabled in user preferences',
      };
    }

    // 2. Discover context-driven candidate moments
    const candidates = await this.generateCandidateMoments(userId, prefs, forcedCategory);
    if (candidates.length === 0) {
      return {
        evaluated: true,
        decision: 'NO_ACTION',
        reason: 'No high-value companion moment warranted by current context',
      };
    }

    // Select candidate with highest combined priority (importance * 10 + urgency score)
    const selected = candidates.sort((a, b) => {
      const uA = a.urgency === 'high' ? 30 : a.urgency === 'medium' ? 15 : 5;
      const uB = b.urgency === 'high' ? 30 : b.urgency === 'medium' ? 15 : 5;
      return b.importance * 10 + uB - (a.importance * 10 + uA);
    })[0]!;

    // 3. Check Category Opt-In
    const enabledCategories: string[] = (prefs as any).enabledCategories || [
      'deadline_reminders',
      'study_checkins',
      'project_followups',
      'goal_progress',
      'daily_companion',
      'milestone_acknowledgements',
      'gentle_inactivity',
    ];
    if (!enabledCategories.includes(selected.category)) {
      return {
        evaluated: true,
        decision: 'NO_ACTION',
        reason: `User has opted out of notification category: ${selected.category}`,
        candidateCategory: selected.category,
      };
    }

    // 4. Create domain event and ProactiveCandidate for policy evaluation
    const domainEvent = await this.repository.createEvent({
      userId,
      eventType: 'UserMessageSent',
      eventVersion: 1,
      aggregateType: 'user',
      aggregateId: userId,
      payload: { momentCategory: selected.category, topic: selected.topic },
      occurredAt: new Date(),
      status: 'processed',
    });

    const candidateRecord = await this.repository.createCandidate({
      userId,
      eventId: domainEvent.id,
      candidateType: selected.category,
      topic: selected.topic,
      urgency: selected.urgency,
      importance: selected.importance,
      contextSnapshot: selected.contextSnapshot,
      status: 'pending',
    });

    // 5. Evaluate policy (Master switch, Quiet hours, Daily interaction cap, Cooldown, Active dialogue suppression)
    const policyResult = await this.policyService.evaluate(candidateRecord, prefs);

    if (policyResult.decision !== 'ACT') {
      await this.repository.updateCandidate(candidateRecord.id, {
        status: 'evaluated',
        decision: policyResult.decision,
        decisionReason: policyResult.reason,
        evaluatedAt: new Date(),
      });

      return {
        evaluated: true,
        decision: policyResult.decision,
        reason: policyResult.reason,
        candidateCategory: selected.category,
      };
    }

    // 6. Synthesize Personalized Message in NIVA's Distinct Companion Voice
    const personalization = await this.personalizationService.getPersonalization(userId);
    const preferredName = personalization?.preferredName || 'there';
    const archetypeId = personalization?.selectedArchetypeId || 'niva_anchor';

    const { title, body } = this.synthesizeContextualNotification(
      preferredName,
      archetypeId,
      selected,
    );

    // 7. Deliver notification via NotificationDeliveryService (In-app + Browser WebPush)
    const deliveryRes = await this.deliveryService.deliver({
      userId,
      channel: prefs.browserEnabled ? 'browser' : 'in_app',
      title,
      body,
      actionUrl: selected.actionUrl,
      metadata: {
        candidateId: candidateRecord.id,
        category: selected.category,
        topic: selected.topic,
        archetypeId,
      },
    });

    // 8. Record Proactive Action and set 24h Cooldown to prevent repetition
    const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const action = await this.repository.createAction({
      userId,
      candidateId: candidateRecord.id,
      actionType: 'IN_APP_MESSAGE',
      channel: deliveryRes.channel || 'in_app',
      title,
      content: body,
      status: 'delivered',
      deliveredAt: new Date(),
      metadata: {
        category: selected.category,
        topic: selected.topic,
        actionUrl: selected.actionUrl,
      },
    });

    await this.repository.updateCandidate(candidateRecord.id, {
      status: 'evaluated',
      decision: 'ACT',
      decisionReason: 'Intelligent notification delivered',
      evaluatedAt: new Date(),
    });

    await this.repository.setCooldown(
      userId,
      selected.topic,
      selected.category,
      cooldownUntil,
      action.id,
    );

    this.logger.log(
      `Delivered intelligent notification (${selected.category}) to user ${userId}: "${title}"`,
    );

    return {
      evaluated: true,
      decision: 'ACT',
      reason: 'Delivered successfully',
      candidateCategory: selected.category,
      notificationId: deliveryRes.notificationId,
      title,
      body,
      channel: deliveryRes.channel,
    };
  }

  /**
   * Generates candidate moments from user's live relational state.
   */
  private async generateCandidateMoments(
    userId: string,
    prefs: UserProactivePreferences,
    forcedCategory?: string,
  ): Promise<IntelligentNotificationCandidate[]> {
    const candidates: IntelligentNotificationCandidate[] = [];
    const now = new Date();

    // 1. Approaching Deadline (Commitments)
    const rawCommitments = await this.lifeRepository.findCommitments(userId, { status: 'upcoming' });
    const commitments = rawCommitments.slice(0, 5);
    for (const c of commitments) {
      if (c.dueAt) {
        const msRemaining = new Date(c.dueAt).getTime() - now.getTime();
        const hoursRemaining = msRemaining / (1000 * 60 * 60);

        if (hoursRemaining > 0 && hoursRemaining <= 48) {
          candidates.push({
            category: 'deadline_reminders',
            topic: c.title,
            urgency: hoursRemaining <= 12 ? 'high' : 'medium',
            importance: hoursRemaining <= 12 ? 9 : 7,
            contextSnapshot: {
              commitmentId: c.id,
              title: c.title,
              dueAt: c.dueAt,
              hoursRemaining: Math.round(hoursRemaining),
            },
            actionUrl: `/conversation?commitmentId=${c.id}`,
          });
        }
      }
    }

    // 2. Active Projects Follow-Up
    const rawProjects = await this.lifeRepository.findProjects(userId, { status: 'in_progress' });
    const projects = rawProjects.slice(0, 3);
    for (const p of projects) {
      candidates.push({
        category: 'project_followups',
        topic: p.title,
        urgency: 'low',
        importance: 6,
        contextSnapshot: {
          projectId: p.id,
          title: p.title,
          updatedAt: p.updatedAt,
        },
        actionUrl: `/life`,
      });
    }

    // 2b. Active Goals Progress
    const rawGoals = await this.lifeRepository.findGoals(userId, { status: 'active' });
    const goals = rawGoals.slice(0, 3);
    for (const g of goals) {
      candidates.push({
        category: 'goal_progress',
        topic: g.title,
        urgency: 'low',
        importance: 6,
        contextSnapshot: {
          goalId: g.id,
          title: g.title,
          progressPercentage: g.progressPercentage,
        },
        actionUrl: `/life`,
      });
    }

    // 3. Scheduled Companion Moments: Morning Check-in & Evening Check-in
    const localHour = this.getUserLocalHour(prefs.timezone || 'UTC');
    const isMorning = localHour >= 8 && localHour < 11;
    const isEvening = localHour >= 17 && localHour < 21;

    if (isMorning && ((prefs as any).morningCheckinEnabled ?? true)) {
      candidates.push({
        category: 'daily_companion',
        topic: 'Morning Intentions',
        urgency: 'low',
        importance: 6,
        contextSnapshot: { momentType: 'morning_checkin', hour: localHour },
        actionUrl: `/conversation`,
      });
    }

    if (isEvening && ((prefs as any).eveningCheckinEnabled ?? true)) {
      candidates.push({
        category: 'daily_companion',
        topic: 'Evening Decompression',
        urgency: 'low',
        importance: 6,
        contextSnapshot: { momentType: 'evening_checkin', hour: localHour },
        actionUrl: `/conversation`,
      });
    }

    // 4. Milestone Acknowledgements (Recently Completed Tasks)
    const rawTasks = await this.lifeRepository.findTasks(userId, { status: 'completed' });
    const completedTasks = rawTasks.slice(0, 2);
    for (const latest of completedTasks) {
      candidates.push({
        category: 'milestone_acknowledgements',
        topic: latest.title,
        urgency: 'low',
        importance: 5,
        contextSnapshot: { taskId: latest.id, title: latest.title },
        actionUrl: `/life`,
      });
    }

    // 5. Gentle Inactivity Check-in
    const hasRecent = await this.repository.hasRecentDialogue(userId, 60 * 48); // 48 hours
    if (!hasRecent) {
      candidates.push({
        category: 'gentle_inactivity',
        topic: 'Checking in',
        urgency: 'low',
        importance: 4,
        contextSnapshot: { hoursInactive: 48 },
        actionUrl: `/conversation`,
      });
    }

    // Filter or synthesize for forcedCategory if specified
    if (forcedCategory) {
      const filtered = candidates.filter((c) => c.category === forcedCategory);
      if (filtered.length > 0) {
        return filtered;
      }
      // If no natural candidate existed for the explicitly requested category, synthesize one
      if (forcedCategory === 'project_followups') {
        return [
          {
            category: 'project_followups',
            topic: 'Active Project Focus',
            urgency: 'low',
            importance: 6,
            contextSnapshot: { title: 'Active Engineering Sprint' },
            actionUrl: `/life`,
          },
        ];
      }
      if (forcedCategory === 'daily_companion') {
        return [
          {
            category: 'daily_companion',
            topic: localHour < 12 ? 'Morning Intentions' : 'Evening Decompression',
            urgency: 'low',
            importance: 6,
            contextSnapshot: {
              momentType: localHour < 12 ? 'morning_checkin' : 'evening_checkin',
              hour: localHour,
            },
            actionUrl: `/conversation`,
          },
        ];
      }
      if (forcedCategory === 'gentle_inactivity') {
        return [
          {
            category: 'gentle_inactivity',
            topic: 'Checking in',
            urgency: 'low',
            importance: 4,
            contextSnapshot: { hoursInactive: 48 },
            actionUrl: `/conversation`,
          },
        ];
      }
      if (forcedCategory === 'milestone_acknowledgements') {
        return [
          {
            category: 'milestone_acknowledgements',
            topic: 'Milestone Progress',
            urgency: 'low',
            importance: 5,
            contextSnapshot: { title: 'Project Milestone' },
            actionUrl: `/life`,
          },
        ];
      }
      if (forcedCategory === 'deadline_reminders') {
        return [
          {
            category: 'deadline_reminders',
            topic: 'Upcoming Target',
            urgency: 'medium',
            importance: 7,
            contextSnapshot: { title: 'Target Milestone', hoursRemaining: 24 },
            actionUrl: `/conversation`,
          },
        ];
      }
      if (forcedCategory === 'goal_progress') {
        return [
          {
            category: 'goal_progress',
            topic: 'Master Distributed Systems',
            urgency: 'low',
            importance: 6,
            contextSnapshot: { title: 'Master Distributed Systems', progressPercentage: 60 },
            actionUrl: `/life`,
          },
        ];
      }
      if (forcedCategory === 'study_checkins') {
        return [
          {
            category: 'study_checkins',
            topic: 'Raft Consensus State Machine',
            urgency: 'low',
            importance: 6,
            contextSnapshot: { topic: 'Raft Consensus State Machine' },
            actionUrl: `/study`,
          },
        ];
      }
      if (forcedCategory === 'evening_checkin') {
        return [
          {
            category: 'daily_companion',
            topic: 'Evening Decompression',
            urgency: 'low',
            importance: 6,
            contextSnapshot: { momentType: 'evening_checkin', hour: 18 },
            actionUrl: `/conversation`,
          },
        ];
      }
      return filtered;
    }

    return candidates;
  }

  /**
   * Synthesizes notification copy in NIVA's distinct personal companion voice,
   * avoiding boring generic alerts while keeping it respectful and relevant.
   */
  private synthesizeContextualNotification(
    name: string,
    archetypeId: string,
    candidate: IntelligentNotificationCandidate,
  ): { title: string; body: string } {
    const snap = candidate.contextSnapshot;
    const topic = candidate.topic;

    switch (candidate.category) {
      case 'deadline_reminders': {
        const hours = snap.hoursRemaining || 24;
        if (archetypeId === 'niva_strategist') {
          return {
            title: `Deadline Horizon: ${topic}`,
            body: `${topic} is due in ${hours}h. Let's isolate the critical path and ensure the final deliverables are locked.`,
          };
        } else if (archetypeId === 'niva_guide') {
          return {
            title: `Gentle Reminder: ${topic}`,
            body: `${name}, your submission for "${topic}" is coming up in ${hours} hours. Take it one steady step at a time.`,
          };
        } else if (archetypeId === 'niva_catalyst') {
          return {
            title: `Final Stretch: ${topic}`,
            body: `${hours} hours remaining for "${topic}". Want to knock out the final section together right now?`,
          };
        }
        // Default Anchor
        return {
          title: `Upcoming Deadline: ${topic}`,
          body: `Your submission for "${topic}" is approaching in ${hours} hours. Would you like to review the final checklist together?`,
        };
      }

      case 'project_followups': {
        if (archetypeId === 'niva_strategist') {
          return {
            title: `Project Check: ${topic}`,
            body: `Last time you were building "${topic}". What's the current bottleneck or next module to ship?`,
          };
        } else if (archetypeId === 'niva_catalyst') {
          return {
            title: `Active Momentum: ${topic}`,
            body: `Hey ${name}! Got a few minutes to push "${topic}" forward today? Let's get building.`,
          };
        }
        return {
          title: `Project Follow-up: ${topic}`,
          body: `Last time, you were working on "${topic}". Did you get a chance to test the latest progress?`,
        };
      }

      case 'daily_companion': {
        const isEvening = snap.momentType === 'evening_checkin';
        if (isEvening) {
          if (archetypeId === 'niva_strategist') {
            return {
              title: `Day End Review`,
              body: `Evening check-in, ${name}. Did the primary focus for today cross the line, or are we carrying it into tomorrow?`,
            };
          } else if (archetypeId === 'niva_guide') {
            return {
              title: `Evening Space`,
              body: `It's evening, ${name}. How did today unfold? Anything you'd like to get off your mind before unwinding?`,
            };
          }
          return {
            title: `Evening Check-in`,
            body: `It's 6 PM, ${name}. How did today go? Anything you'd like to get off your mind before the evening?`,
          };
        }
        // Morning
        return {
          title: `Morning Intentions`,
          body: `Good morning, ${name}. What is the single meaningful priority you'd like to protect today?`,
        };
      }

      case 'milestone_acknowledgements': {
        return {
          title: `Progress Recognized`,
          body: `You wrapped up "${topic}". That's solid progress worth recognizing—clean slate for what's next.`,
        };
      }

      case 'goal_progress': {
        if (archetypeId === 'niva_strategist') {
          return {
            title: `Goal Calibration: ${topic}`,
            body: `Reviewing your progress toward "${topic}". Are our current weekly sprints effectively moving this needle?`,
          };
        } else if (archetypeId === 'niva_guide') {
          return {
            title: `Reflecting on ${topic}`,
            body: `${name}, take a quiet moment to look at your progress on "${topic}". Steady, gradual compounding matters.`,
          };
        } else if (archetypeId === 'niva_catalyst') {
          return {
            title: `Goal Momentum: ${topic}`,
            body: `Hey ${name}! Ready to make another stride toward "${topic}" today? Let's keep the fire going!`,
          };
        }
        return {
          title: `Goal Horizon: ${topic}`,
          body: `Checking in on your progress toward "${topic}". How are you feeling about your momentum this week?`,
        };
      }

      case 'study_checkins': {
        if (archetypeId === 'niva_strategist') {
          return {
            title: `Study Focus: ${topic}`,
            body: `Time for a high-intensity 30m block on "${topic}". Focus strictly on active recall and problem decomposition.`,
          };
        } else if (archetypeId === 'niva_catalyst') {
          return {
            title: `Study Sprint: ${topic}`,
            body: `Ready for a quick 25-minute sprint on "${topic}"? Let's knock out one key concept right now!`,
          };
        }
        return {
          title: `Focused Study Sprint: ${topic}`,
          body: `Ready for 30 minutes of deep study on "${topic}"? Your future self will appreciate the focus today.`,
        };
      }

      case 'gentle_inactivity': {
        return {
          title: `Checking in with NIVA`,
          body: `Hey ${name}, hope your week is treating you well. When you have a few minutes, I'm here if you want to catch up.`,
        };
      }

      default: {
        return {
          title: `Companion Check-in: ${topic}`,
          body: `Checking in, ${name}. I'm here whenever you'd like to talk through your current focus.`,
        };
      }
    }
  }

  private getUserLocalHour(timezone: string): number {
    try {
      const str = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }).format(new Date());
      return parseInt(str, 10);
    } catch {
      return new Date().getUTCHours();
    }
  }
}
