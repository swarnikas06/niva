import { Injectable, Logger } from '@nestjs/common';
import { EventRepository } from '../event.repository';
import {
  ProactiveCandidate,
  UserProactivePreferences,
} from '../../database/schema';
import { PolicyDecisionType } from '@niva/shared-types';

export interface PolicyEvaluationResult {
  decision: PolicyDecisionType;
  reason: string;
  cooldownMinutes?: number;
}

@Injectable()
export class ProactivePolicyService {
  private readonly logger = new Logger(ProactivePolicyService.name);

  constructor(private readonly repository: EventRepository) {}

  /**
   * Evaluates a ProactiveCandidate against deterministic policy rules:
   * 1. Global toggle
   * 2. Quiet hours (with user timezone)
   * 3. Daily interaction cap
   * 4. Topic cooldowns
   * 5. Active conversation topic suppression
   */
  async evaluate(
    candidate: ProactiveCandidate,
    preferences: UserProactivePreferences,
  ): Promise<PolicyEvaluationResult> {
    const userId = candidate.userId;
    const topic = candidate.topic;
    const candidateType = candidate.candidateType;

    // ========================================================================
    // RULE 1: Global Master Switch
    // ========================================================================
    if (!preferences.proactiveEnabled) {
      return {
        decision: 'NO_ACTION',
        reason: 'Proactive companion behavior is disabled in user preferences',
      };
    }

    // ========================================================================
    // RULE 2: Quiet Hours (Timezone Aware)
    // ========================================================================
    if (preferences.quietHoursEnabled) {
      const isQuiet = this.isWithinQuietHours(
        preferences.quietHoursStart,
        preferences.quietHoursEnd,
        preferences.timezone,
      );

      if (isQuiet) {
        const allowCritical =
          candidate.urgency === 'high' && preferences.allowHighUrgencyInQuietHours;

        if (!allowCritical) {
          return {
            decision: 'DEFER',
            reason: `Suppressed during user quiet hours (${preferences.quietHoursStart} - ${preferences.quietHoursEnd} ${preferences.timezone})`,
          };
        }
      }
    }

    // ========================================================================
    // RULE 3: Daily Proactive Interaction Cap
    // ========================================================================
    const startOfToday = this.getStartOfDayInTimezone(preferences.timezone);
    const dailyCount = await this.repository.countDailyDeliveredActions(userId, startOfToday);

    if (dailyCount >= preferences.maxDailyInteractions) {
      return {
        decision: 'NO_ACTION',
        reason: `Suppressed: Daily proactive interaction cap (${preferences.maxDailyInteractions}) reached for today`,
      };
    }

    // ========================================================================
    // RULE 4: Topic & Candidate Cooldown Check
    // ========================================================================
    const cooldown = await this.repository.getCooldown(userId, topic, candidateType);
    if (cooldown && cooldown.cooldownUntil > new Date()) {
      return {
        decision: 'NO_ACTION',
        reason: `Suppressed: Cooldown active for topic "${topic}" until ${cooldown.cooldownUntil.toISOString()}`,
      };
    }

    // ========================================================================
    // RULE 5: Active Conversation Topic Suppression
    // If the user has discussed this topic in the last 30 minutes, suppress proactive intervention.
    // ========================================================================
    const isTopicActive = await this.repository.hasRecentConversationTurnOnTopic(
      userId,
      topic,
      30,
    );
    if (isTopicActive) {
      return {
        decision: 'NO_ACTION',
        reason: `Suppressed: Active conversation already in progress regarding "${topic}"`,
      };
    }

    // ========================================================================
    // RULE 6: Action Warranted
    // Determine appropriate cooldown duration depending on candidate type
    // ========================================================================
    let cooldownMinutes = 720; // 12 hours default
    if (candidateType === 'task_postponed_checkin') {
      cooldownMinutes = 1440; // 24 hours
    } else if (candidateType === 'commitment_reminder') {
      cooldownMinutes = 360;  // 6 hours
    } else if (candidateType === 'celebrate_task_completed') {
      cooldownMinutes = 720;  // 12 hours
    }

    return {
      decision: 'ACT',
      reason: 'Proactive intervention warranted and verified against all policy rules',
      cooldownMinutes,
    };
  }

  /**
   * Determines if the current moment is within the user's configured quiet hours in their local timezone.
   */
  isWithinQuietHours(startStr: string, endStr: string, timezone: string): boolean {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });

      const parts = formatter.formatToParts(now);
      const hourPart = parts.find((p) => p.type === 'hour')?.value || '0';
      const minPart = parts.find((p) => p.type === 'minute')?.value || '0';
      const currentMinutes = parseInt(hourPart, 10) * 60 + parseInt(minPart, 10);

      const [startH, startM] = startStr.split(':').map((s) => parseInt(s, 10));
      const [endH, endM] = endStr.split(':').map((s) => parseInt(s, 10));

      const startMinutes = (startH || 0) * 60 + (startM || 0);
      const endMinutes = (endH || 0) * 60 + (endM || 0);

      if (startMinutes > endMinutes) {
        // Overnight quiet hours (e.g. 22:00 -> 08:00)
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      } else {
        // Daytime quiet hours (e.g. 13:00 -> 15:00)
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      }
    } catch (err) {
      this.logger.warn(`Failed to compute quiet hours with timezone "${timezone}": ${err}; defaulting to false.`);
      return false;
    }
  }

  private getStartOfDayInTimezone(timezone: string): Date {
    try {
      const now = new Date();
      const localStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
      return new Date(`${localStr}T00:00:00Z`);
    } catch {
      const fallback = new Date();
      fallback.setUTCHours(0, 0, 0, 0);
      return fallback;
    }
  }
}
