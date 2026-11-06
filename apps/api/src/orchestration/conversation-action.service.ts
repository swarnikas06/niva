import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { LifeContextService } from '../life-context/life-context.service';
import { LifeContextRepository } from '../life-context/life-context.repository';
import { JobSchedulerService } from '../jobs/job-scheduler.service';
import { EventRepository } from '../events/event.repository';
import { ExecutedActionOutcomeDto } from '@niva/shared-types';

@Injectable()
export class ConversationActionService {
  private readonly logger = new Logger(ConversationActionService.name);

  constructor(
    private readonly lifeContextService: LifeContextService,
    private readonly lifeContextRepository: LifeContextRepository,
    @Inject(forwardRef(() => JobSchedulerService))
    private readonly jobSchedulerService: JobSchedulerService,
    private readonly eventRepository: EventRepository,
  ) {}

  /**
   * Deterministically parses a user's conversational message for actionable requests,
   * executes them through LifeContextService and JobSchedulerService,
   * and returns structured action outcomes to ground the companion's response.
   */
  async detectAndExecuteActions(
    userId: string,
    message: string,
  ): Promise<ExecutedActionOutcomeDto[]> {
    const outcomes: ExecutedActionOutcomeDto[] = [];
    const text = message.trim();

    try {
      // 1. Check for Task / Commitment Completion
      const completionOutcome = await this.tryCompleteTaskOrCommitment(userId, text);
      if (completionOutcome) {
        outcomes.push(completionOutcome);
        return outcomes;
      }

      // 2. Check for Task / Commitment Rescheduling / Postponement
      const rescheduleOutcome = await this.tryRescheduleOrPostpone(userId, text);
      if (rescheduleOutcome) {
        outcomes.push(rescheduleOutcome);
        return outcomes;
      }

      // 3. Check for Incomplete Progress / Continuity response to reminder
      const progressOutcome = await this.tryProgressUpdateOrIncomplete(userId, text);
      if (progressOutcome) {
        outcomes.push(progressOutcome);
        return outcomes;
      }

      // 4. Check for Natural Deadline Statements
      const deadlineOutcome = await this.tryDeadlineStatement(userId, text);
      if (deadlineOutcome) {
        outcomes.push(deadlineOutcome);
        return outcomes;
      }

      // 5. Check for Reminder Creation (relative or absolute)
      const reminderOutcome = await this.tryCreateReminder(userId, text);
      if (reminderOutcome) {
        outcomes.push(reminderOutcome);
        return outcomes;
      }

      // 6. Check for Task Creation
      const creationOutcome = await this.tryCreateTask(userId, text);
      if (creationOutcome) {
        outcomes.push(creationOutcome);
        return outcomes;
      }
    } catch (err: any) {
      this.logger.error(`Error executing conversational action for user ${userId}: ${err.message}`, err.stack);
    }

    return outcomes;
  }

  /**
   * Detects phrases marking a task or commitment complete:
   * e.g., "I finished the assignment", "I completed my project", "done with the task", "mark task as done"
   * Cancels any scheduled reminders for the completed entity.
   */
  private async tryCompleteTaskOrCommitment(
    userId: string,
    text: string,
  ): Promise<ExecutedActionOutcomeDto | null> {
    const completePatterns = [
      /(?:i\s+(?:have\s+|just\s+)?(?:finished|submitted|completed)(?:\s+and\s+(?:finished|submitted|completed))?|i\s+did|done\s+with|finally\s+finished)\s+(?:the\s+|my\s+)?(.+)/i,
      /(?:mark\s+task\s+|mark\s+)(?:['"]?)(.+?)(?:['"]?)\s+(?:as\s+done|as\s+completed|done|complete)/i,
      /(?:completed|finished|submitted)\s+task:?\s+(.+)/i,
    ];

    let extractedCandidate: string | null = null;
    for (const pattern of completePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        extractedCandidate = match[1].trim().replace(/[.!?]+$/, '').replace(/^['"]|['"]$/g, '').trim();
        break;
      }
    }

    if (!extractedCandidate || extractedCandidate.length < 2) {
      return null;
    }

    extractedCandidate = extractedCandidate.replace(/^(?:the\s+)?(?:task|commitment|project|assignment):?\s*/i, '').trim();
    const candidateLower = extractedCandidate.toLowerCase();

    // 1. Check commitments
    const allCommitments = await this.lifeContextRepository.findCommitments(userId);
    const activeCommitments = allCommitments.filter((c) => c.status === 'upcoming');
    let matchedCommitment = activeCommitments.find(
      (c) =>
        c.title.toLowerCase().includes(candidateLower) ||
        candidateLower.includes(c.title.toLowerCase()),
    );

    // Fallback: match by significant keywords (e.g. "transformer" in "transformer paper draft" vs "Transformer attention draft")
    if (!matchedCommitment) {
      const candidateTokens = candidateLower
        .split(/\s+/)
        .filter((w) => w.length > 3 && !['paper', 'draft', 'assignment', 'task', 'submission'].includes(w));
      if (candidateTokens.length > 0) {
        matchedCommitment = activeCommitments.find((c) => {
          const titleLower = c.title.toLowerCase();
          return candidateTokens.some((token) => titleLower.includes(token));
        });
      }
    }

    // If candidate is generic "assignment" or "project", match most recent commitment
    if (!matchedCommitment && (candidateLower === 'assignment' || candidateLower === 'project') && activeCommitments.length > 0) {
      matchedCommitment = activeCommitments[0];
    }

    if (matchedCommitment) {
      await this.lifeContextService.updateCommitment(matchedCommitment.id, userId, {
        status: 'fulfilled',
      });
      // Cancel background jobs for this commitment
      await this.jobSchedulerService.cancelJobsForTarget('commitment', matchedCommitment.id);

      this.logger.log(`Conversation action: Marked commitment '${matchedCommitment.title}' (${matchedCommitment.id}) fulfilled and cancelled scheduled reminders`);
      return {
        actionType: 'commitment_fulfilled',
        status: 'success',
        title: matchedCommitment.title,
        message: `Marked "${matchedCommitment.title}" as fulfilled and cancelled pending reminders.`,
        details: { commitmentId: matchedCommitment.id },
      };
    }

    // 2. Check tasks
    const allTasks = await this.lifeContextRepository.findTasks(userId);
    const activeTasks = allTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
    let matchedTask = activeTasks.find((t) => t.title.toLowerCase().includes(candidateLower) || candidateLower.includes(t.title.toLowerCase()));

    if (!matchedTask && (candidateLower === 'assignment' || candidateLower === 'project') && activeTasks.length > 0) {
      matchedTask = activeTasks[0];
    }

    if (matchedTask) {
      await this.lifeContextService.updateTask(matchedTask.id, userId, {
        status: 'completed',
      });
      await this.jobSchedulerService.cancelJobsForTarget('task', matchedTask.id);

      this.logger.log(`Conversation action: Marked task '${matchedTask.title}' (${matchedTask.id}) completed and cancelled reminders`);
      return {
        actionType: 'task_completed',
        status: 'success',
        title: matchedTask.title,
        message: `Marked task "${matchedTask.title}" as completed.`,
        details: { taskId: matchedTask.id },
      };
    }

    return null;
  }

  /**
   * Detects rescheduling / postponement requests:
   * e.g., "Push the deadline to Monday", "Reschedule my assignment to Friday", "Postpone assignment to November 20"
   */
  private async tryRescheduleOrPostpone(
    userId: string,
    text: string,
  ): Promise<ExecutedActionOutcomeDto | null> {
    let targetTitlePart: string | null = null;
    let dateTargetPart = '';

    const targetedPostponeRegex = /(?:push|postpone|reschedule|move|delay)\s+(?:(?:my|the)\s+)?(.+?)\s+(?:to|until|for)\s+(.+)/i;
    const genericPostponeRegex = /(?:push|postpone|reschedule|move|delay)\s+(?:to|until|for)\s+(.+)/i;

    const targetedMatch = text.match(targetedPostponeRegex);
    const genericMatch = text.match(genericPostponeRegex);

    if (targetedMatch && targetedMatch[1] && targetedMatch[2]) {
      targetTitlePart = targetedMatch[1].trim();
      dateTargetPart = targetedMatch[2].trim();
    } else if (genericMatch && genericMatch[1]) {
      dateTargetPart = genericMatch[1].trim();
    } else {
      return null;
    }

    const prefs = await this.eventRepository.getUserPreferences(userId);
    const userTz = prefs?.timezone || 'UTC';
    const parsedDate = this.parseDateString(dateTargetPart, userTz);
    if (!parsedDate) {
      return null;
    }

    // Find the user's upcoming commitments
    const allCommitments = await this.lifeContextRepository.findCommitments(userId);
    const upcoming = allCommitments.filter((c) => c.status === 'upcoming');
    if (upcoming.length === 0) {
      return null;
    }

    const targetCommitment =
      (targetTitlePart
        ? upcoming.find(
            (c) =>
              c.title.toLowerCase().includes(targetTitlePart!.toLowerCase()) ||
              targetTitlePart!.toLowerCase().includes(c.title.toLowerCase()),
          )
        : null) || upcoming[0]!;

    await this.lifeContextService.updateCommitment(targetCommitment.id, userId, {
      dueAt: parsedDate.toISOString(),
      status: 'upcoming',
    });

    // Reschedule background jobs
    await this.jobSchedulerService.rescheduleDeadline(
      userId,
      'commitment',
      targetCommitment.id,
      targetCommitment.title,
      parsedDate,
      userTz,
    );

    this.logger.log(`Rescheduled commitment '${targetCommitment.title}' to ${parsedDate.toISOString()}`);
    return {
      actionType: 'commitment_rescheduled',
      status: 'success',
      title: targetCommitment.title,
      message: `Rescheduled "${targetCommitment.title}" to ${parsedDate.toLocaleDateString('en-US', { timeZone: userTz })} at ${parsedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: userTz })}. Updated reminder schedule.`,
      details: {
        commitmentId: targetCommitment.id,
        newDueAt: parsedDate.toISOString(),
      },
    };
  }

  /**
   * Detects progress updates or incomplete status:
   * e.g., "I haven't completed the task yet", "still working on it", "almost done. just need to finish the conclusion"
   */
  private async tryProgressUpdateOrIncomplete(
    userId: string,
    text: string,
  ): Promise<ExecutedActionOutcomeDto | null> {
    const lower = text.toLowerCase();
    const isIncomplete =
      lower.includes("haven't completed") ||
      lower.includes('not completed') ||
      lower.includes('not finished yet') ||
      lower.includes('still working on') ||
      lower.includes('almost done') ||
      lower.includes('working on the conclusion') ||
      lower.includes('in progress');

    if (!isIncomplete) {
      return null;
    }

    // Find active commitment
    const allCommitments = await this.lifeContextRepository.findCommitments(userId);
    const upcoming = allCommitments.filter((c) => c.status === 'upcoming');

    if (upcoming.length === 0) {
      return null;
    }

    const targetCommitment = upcoming[0]!;
    const progressNote = text.length > 80 ? text.substring(0, 80) + '...' : text;

    await this.lifeContextService.updateCommitment(targetCommitment.id, userId, {
      description: `Progress update: ${progressNote} (updated ${new Date().toLocaleTimeString()})`,
    });

    return {
      actionType: 'task_progress_updated',
      status: 'success',
      title: targetCommitment.title,
      message: `Updated progress on "${targetCommitment.title}": ${progressNote}.`,
      details: {
        commitmentId: targetCommitment.id,
        status: 'in_progress',
      },
    };
  }

  /**
   * Detects natural deadline expressions:
   * e.g., "My assignment is due on November 15", "I need to finish this before Friday", "I have three submissions next week"
   */
  private async tryDeadlineStatement(
    userId: string,
    text: string,
  ): Promise<ExecutedActionOutcomeDto | null> {
    const lower = text.toLowerCase();

    // Ambiguity Check: "I have a deadline coming up soon" or "My assignment is due soon" without date
    const hasAmbiguousDeadline =
      /(?:deadline|due|submission).*?(?:soon|coming up|shortly|approaching)/i.test(lower) ||
      /(?:have|got)\s+a\s+(?:deadline|submission)\b/i.test(lower);
    if (hasAmbiguousDeadline && !this.containsSpecificDate(lower)) {
      return {
        actionType: 'clarification_needed',
        status: 'success',
        title: 'Deadline Clarification',
        message: 'Could you clarify the exact due date for your assignment or paper?',
        details: { ambiguous: true },
      };
    }

    // Multiple submissions check: "I have three submissions next week"
    const multipleMatch = text.match(/(?:i\s+have\s+)?(three|two|3|2|\d+)\s+submissions?\s+(?:next\s+week|coming\s+up)/i);
    if (multipleMatch) {
      const countStr = multipleMatch[1]!.toLowerCase();
      const count = countStr === 'three' ? 3 : countStr === 'two' ? 2 : parseInt(countStr, 10) || 3;
      const nextWeekDate = new Date();
      nextWeekDate.setDate(nextWeekDate.getDate() + 7);
      nextWeekDate.setHours(18, 0, 0, 0);

      for (let i = 1; i <= count; i++) {
        const comm = await this.lifeContextService.createCommitment(userId, {
          title: `Submission Item ${i}`,
          commitmentType: 'deadline',
          importance: 'high',
          dueAt: nextWeekDate.toISOString(),
        });
        await this.jobSchedulerService.scheduleDeadlineIntelligence(
          userId,
          'commitment',
          comm.id,
          comm.title,
          nextWeekDate,
        );
      }

      return {
        actionType: 'multiple_commitments_created',
        status: 'success',
        title: `${count} Submissions Scheduled`,
        message: `Registered ${count} submissions for next week (due ${nextWeekDate.toLocaleDateString()}). Set advance reminders for each.`,
        details: { count, dueAt: nextWeekDate.toISOString() },
      };
    }

    // Standard deadline match: "My assignment is due on November 15", "I have to submit my machine learning assignment on November 10 at 5 PM", "Need to finish this before Friday"
    const verbPrefix = '(?:(?:definitely|really|also|urgently)\\s+)?(?:have\\s+to|need\\s+to|must)\\s+(?:submit|complete|finish)';
    const deadlinePatterns = [
      new RegExp(`${verbPrefix}\\s+(?:my\\s+)?(.+?)\\s+(?:on|by|before)\\s+([a-zA-Z0-9\\s,:]+)`, 'i'),
      new RegExp(`${verbPrefix}\\s+(?:my\\s+)?(.+?)\\s+(in\\s+(?:\\d+|one|two|three|four|five|six|seven|ten|fourteen)\\s+days?.*)`, 'i'),
      new RegExp(`${verbPrefix}\\s+(?:my\\s+)?(.+?)\\s+(tomorrow.*|next\\s+[a-zA-Z]+.*)`, 'i'),
      /(?:my\s+)?(.+?)\s+(?:is\s+due|due)\s+(?:on|by|at)?\s*([a-zA-Z0-9\s,:]+)/i,
      new RegExp(`${verbPrefix}\\s+(.+?)\\s+before\\s+([a-zA-Z0-9\\s,:]+)`, 'i'),
    ];

    let subject: string | null = null;
    let datePart: string | null = null;

    for (const pattern of deadlinePatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[2]) {
        subject = match[1].trim().replace(/^(?:the|my)\s+/i, '');
        datePart = match[2].trim().replace(/[.!?]+$/, '');
        break;
      }
    }

    if (!subject || !datePart) {
      return null;
    }

    const prefs = await this.eventRepository.getUserPreferences(userId);
    const userTz = prefs?.timezone || 'UTC';

    const parsedDate = this.parseDateString(datePart, userTz);
    if (!parsedDate) {
      return null;
    }

    // Clean subject
    const title = subject.length > 3 ? subject.charAt(0).toUpperCase() + subject.slice(1) : 'Assignment';

    const commitment = await this.lifeContextService.createCommitment(userId, {
      title,
      commitmentType: 'deadline',
      importance: 'high',
      dueAt: parsedDate.toISOString(),
    });

    // Schedule 3-tier advance reminder intelligence in background
    const jobs = await this.jobSchedulerService.scheduleDeadlineIntelligence(
      userId,
      'commitment',
      commitment.id,
      commitment.title,
      parsedDate,
      userTz,
    );

    this.logger.log(`Created commitment '${commitment.title}' with ${jobs.length} advance reminder jobs`);

    return {
      actionType: 'commitment_created',
      status: 'success',
      title: commitment.title,
      message: `Set deadline for "${commitment.title}" on ${parsedDate.toLocaleDateString('en-US', { timeZone: userTz })} at ${parsedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: userTz })}. Scheduled advance reminder, progress check, and final alert.`,
      details: {
        commitmentId: commitment.id,
        dueAt: parsedDate.toISOString(),
        remindersScheduled: jobs.length,
      },
    };
  }

  /**
   * Detects reminder requests (relative offset or absolute time):
   * e.g., "Remind me two days before the deadline", "Remind me tomorrow at 7 AM to practise Python"
   */
  private async tryCreateReminder(
    userId: string,
    text: string,
  ): Promise<ExecutedActionOutcomeDto | null> {
    const reminderRegex = /(?:remind\s+me|set\s+a\s+reminder)\s+(?:to\s+|for\s+|that\s+)?(.+)/i;
    const match = text.match(reminderRegex);
    if (!match || !match[1]) {
      return null;
    }

    const content = match[1].trim();

    // 1. Relative reminder: "two days before the deadline"
    const relativeMatch = content.match(/(\d+|two|one|three)\s+days?\s+before\s+(?:the\s+)?(?:deadline|assignment)/i);
    if (relativeMatch) {
      const daysStr = relativeMatch[1]!.toLowerCase();
      const days = daysStr === 'two' ? 2 : daysStr === 'one' ? 1 : daysStr === 'three' ? 3 : parseInt(daysStr, 10) || 2;

      const upcoming = (await this.lifeContextRepository.findCommitments(userId)).filter((c) => c.status === 'upcoming');
      if (upcoming.length > 0) {
        const comm = upcoming[0]!;
        const reminderTime = new Date(new Date(comm.dueAt).getTime() - days * 24 * 60 * 60 * 1000);
        reminderTime.setHours(9, 0, 0, 0);

        const job = await this.jobSchedulerService.scheduleReminder({
          userId,
          targetType: 'commitment',
          targetId: comm.id,
          scheduledAt: reminderTime,
          title: `Advance Reminder: ${comm.title}`,
          message: `Reminder: "${comm.title}" is due in ${days} days on ${new Date(comm.dueAt).toLocaleDateString()}.`,
          stage: 'advance',
        });

        return {
          actionType: 'reminder_scheduled',
          status: 'success',
          title: comm.title,
          message: `Scheduled reminder for "${comm.title}" ${days} days before deadline (${reminderTime.toLocaleDateString()} at 9:00 AM).`,
          details: { jobId: job.id, scheduledAt: reminderTime.toISOString() },
        };
      }
    }

    // 2. Absolute time reminder: "tomorrow at 7 AM to practise Python"
    let targetTime = new Date();
    let reminderTitle = content;

    const tomorrowMatch = content.match(/tomorrow(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
    const timeMatch = content.match(/(?:at|for)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);

    if (tomorrowMatch) {
      targetTime.setDate(targetTime.getDate() + 1);
      let hours = 9;
      let mins = 0;
      if (tomorrowMatch[1]) {
        hours = parseInt(tomorrowMatch[1], 10);
        if (tomorrowMatch[3]?.toLowerCase() === 'pm' && hours < 12) hours += 12;
        if (tomorrowMatch[3]?.toLowerCase() === 'am' && hours === 12) hours = 0;
        if (tomorrowMatch[2]) mins = parseInt(tomorrowMatch[2], 10);
      }
      targetTime.setHours(hours, mins, 0, 0);

      reminderTitle = content
        .replace(/tomorrow(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i, '')
        .replace(/^(?:to|about|for)\s+/i, '')
        .trim();
    } else if (timeMatch && timeMatch[1]) {
      let hours = parseInt(timeMatch[1], 10);
      let mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      if (timeMatch[3]?.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (timeMatch[3]?.toLowerCase() === 'am' && hours === 12) hours = 0;
      targetTime.setHours(hours, mins, 0, 0);
      if (targetTime.getTime() <= Date.now()) {
        targetTime.setDate(targetTime.getDate() + 1);
      }

      reminderTitle = content
        .replace(/(?:at|for)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)/i, '')
        .replace(/^(?:to|about|for)\s+/i, '')
        .trim();
    } else {
      targetTime.setDate(targetTime.getDate() + 1);
      targetTime.setHours(9, 0, 0, 0);
      reminderTitle = content.replace(/^(?:to|about|for)\s+/i, '').trim();
    }

    reminderTitle = reminderTitle.replace(/^(?:to|about|for)\s+/i, '').replace(/[.!?]+$/, '').trim();
    if (!reminderTitle || reminderTitle.length < 2) return null;

    const comm = await this.lifeContextService.createCommitment(userId, {
      title: reminderTitle,
      commitmentType: 'deadline',
      importance: 'standard',
      dueAt: targetTime.toISOString(),
    });

    const job = await this.jobSchedulerService.scheduleReminder({
      userId,
      targetType: 'commitment',
      targetId: comm.id,
      scheduledAt: targetTime,
      title: `Reminder: ${reminderTitle}`,
      message: `Reminder for "${reminderTitle}".`,
      stage: 'custom',
    });

    const formattedTime = targetTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    return {
      actionType: 'commitment_created',
      status: 'success',
      title: comm.title,
      message: `Set reminder "${comm.title}" for ${targetTime.toDateString()} at ${formattedTime}.`,
      details: { commitmentId: comm.id, jobId: job.id, dueAt: targetTime.toISOString() },
    };
  }

  private async tryCreateTask(
    userId: string,
    text: string,
  ): Promise<ExecutedActionOutcomeDto | null> {
    const createPatterns = [
      /^(?:add\s+task|create\s+task|new\s+task|todo|add\s+to\s+my\s+tasks)[:\s]+(.+)/i,
      /^(?:please\s+)?(?:add\s+a?\s*task\s+to|add\s+task\s+to)\s+(.+)/i,
    ];

    let candidateTitle: string | null = null;
    for (const pattern of createPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        candidateTitle = match[1].trim().replace(/[.!?]+$/, '').trim();
        break;
      }
    }

    if (!candidateTitle || candidateTitle.length < 2) return null;

    // Check if an active task with identical title already exists to avoid duplication
    const existingTasks = await this.lifeContextRepository.findTasks(userId);
    const duplicate = existingTasks.find(
      (t) =>
        (t.status === 'todo' || t.status === 'in_progress') &&
        t.title.toLowerCase() === candidateTitle.toLowerCase(),
    );
    if (duplicate) {
      return {
        actionType: 'task_created',
        status: 'success',
        title: duplicate.title,
        message: `Task "${duplicate.title}" is already in your active tasks.`,
        details: { taskId: duplicate.id, duplicate: true },
      };
    }

    const created = await this.lifeContextService.createTask(userId, {
      title: candidateTitle,
      priority: 'medium',
    });

    return {
      actionType: 'task_created',
      status: 'success',
      title: created.title,
      message: `Created new task "${created.title}".`,
      details: { taskId: created.id },
    };
  }

  /**
   * Helper: extracts user's current local date parts in their configured timezone
   */
  private getUserNowParts(userTimezone: string = 'UTC', baseDate: Date = new Date()) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = dtf.formatToParts(baseDate);
    const m: Record<string, string> = {};
    for (const p of parts) m[p.type] = p.value;
    let hour = parseInt(m.hour || '0', 10);
    if (hour === 24) hour = 0;
    return {
      year: parseInt(m.year || '2026', 10),
      monthIndex: parseInt(m.month || '1', 10) - 1,
      day: parseInt(m.day || '1', 10),
      weekday: (m.weekday || '').toLowerCase(),
      hour,
      minute: parseInt(m.minute || '0', 10),
    };
  }

  /**
   * Helper: converts local wall-clock date/time in userTimezone to exact UTC Date object
   */
  private localToUtc(
    year: number,
    monthIndex: number,
    day: number,
    hour: number,
    minute: number,
    timezone: string = 'UTC',
  ): Date {
    if (!timezone || timezone === 'UTC') {
      return new Date(Date.UTC(year, monthIndex, day, hour, minute, 0, 0));
    }
    const desiredTime = Date.UTC(year, monthIndex, day, hour, minute, 0, 0);
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });

    const getOffset = (date: Date) => {
      const parts = dtf.formatToParts(date);
      const m: Record<string, string> = {};
      for (const p of parts) m[p.type] = p.value;
      let h = parseInt(m.hour || '0', 10);
      if (h === 24) h = 0;
      const d = parseInt(m.day || '1', 10);
      const mo = parseInt(m.month || '1', 10) - 1;
      const y = parseInt(m.year || '2026', 10);
      const min = parseInt(m.minute || '0', 10);
      const timeInTz = Date.UTC(y, mo, d, h, min, 0, 0);
      return timeInTz - date.getTime();
    };

    // Iteration 1: Initial estimate using desired wall time as naive UTC
    const guess = new Date(desiredTime);
    const offset1 = getOffset(guess);
    let res = new Date(desiredTime - offset1);

    // Iteration 2: Re-check offset at target timestamp to handle transition boundary shifts
    const offset2 = getOffset(res);
    if (offset1 !== offset2) {
      res = new Date(desiredTime - offset2);
    }
    return res;
  }

  /**
   * Helper: parses natural date expressions like "November 15", "before Friday", "Friday", "tomorrow", "in three days"
   * preserving user's intended local timezone.
   */
  private parseDateString(dateStr: string, userTimezone: string = 'UTC'): Date | null {
    const clean = dateStr.toLowerCase().trim();
    const now = new Date();
    const userNow = this.getUserNowParts(userTimezone, now);

    const wordToNum: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      fourteen: 14,
    };

    let targetHour = 18;
    let targetMinute = 0;
    let hasSpecificTime = false;

    const timeMatch = clean.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (timeMatch && timeMatch[1]) {
      targetHour = parseInt(timeMatch[1], 10);
      targetMinute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      if (timeMatch[3]?.toLowerCase() === 'pm' && targetHour < 12) targetHour += 12;
      if (timeMatch[3]?.toLowerCase() === 'am' && targetHour === 12) targetHour = 0;
      hasSpecificTime = true;
    }

    // 1. "in X days" / "in three days" / "in 3 days"
    const inDaysMatch = clean.match(/in\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|fourteen)\s+days?/i);
    if (inDaysMatch && inDaysMatch[1]) {
      const rawVal = inDaysMatch[1].toLowerCase();
      const daysOffset = wordToNum[rawVal] || parseInt(rawVal, 10) || 1;
      const targetLocal = new Date(Date.UTC(userNow.year, userNow.monthIndex, userNow.day + daysOffset));
      const finalHour = hasSpecificTime ? targetHour : 18;
      return this.localToUtc(
        targetLocal.getUTCFullYear(),
        targetLocal.getUTCMonth(),
        targetLocal.getUTCDate(),
        finalHour,
        targetMinute,
        userTimezone,
      );
    }

    // 2. Month and Day: "November 10 at 5 PM", "Nov 15", "10th November"
    const monthRegex = /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?/i;
    const monthMatch = clean.match(monthRegex);
    if (monthMatch && monthMatch[1] && monthMatch[2]) {
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthIdx = monthNames.findIndex((m) => monthMatch[1]!.toLowerCase().startsWith(m));
      const day = parseInt(monthMatch[2]!, 10);
      if (monthIdx !== -1 && day >= 1 && day <= 31) {
        let year = userNow.year;
        const finalHour = hasSpecificTime ? targetHour : 23;
        const finalMinute = hasSpecificTime ? targetMinute : 59;
        let targetUtc = this.localToUtc(year, monthIdx, day, finalHour, finalMinute, userTimezone);
        if (targetUtc.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
          year += 1;
          targetUtc = this.localToUtc(year, monthIdx, day, finalHour, finalMinute, userTimezone);
        }
        return targetUtc;
      }
    }

    // 3. "tomorrow"
    if (clean.includes('tomorrow')) {
      const targetLocal = new Date(Date.UTC(userNow.year, userNow.monthIndex, userNow.day + 1));
      const finalHour = hasSpecificTime ? targetHour : 18;
      return this.localToUtc(
        targetLocal.getUTCFullYear(),
        targetLocal.getUTCMonth(),
        targetLocal.getUTCDate(),
        finalHour,
        targetMinute,
        userTimezone,
      );
    }

    // 4. Day of week: "Friday", "next Monday", "before Friday at 4 PM"
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < daysOfWeek.length; i++) {
      const dayName = daysOfWeek[i]!;
      if (clean.includes(dayName)) {
        const currentDayIdx = daysOfWeek.indexOf(userNow.weekday);
        let daysUntil = (i - currentDayIdx + 7) % 7;
        if (clean.includes('next ' + dayName)) {
          if (daysUntil === 0) daysUntil = 7;
        } else {
          if (daysUntil === 0) daysUntil = 7;
        }
        const targetLocal = new Date(Date.UTC(userNow.year, userNow.monthIndex, userNow.day + daysUntil));
        const finalHour = hasSpecificTime ? targetHour : 18;
        return this.localToUtc(
          targetLocal.getUTCFullYear(),
          targetLocal.getUTCMonth(),
          targetLocal.getUTCDate(),
          finalHour,
          targetMinute,
          userTimezone,
        );
      }
    }

    // 5. "next week"
    if (clean.includes('next week')) {
      const targetLocal = new Date(Date.UTC(userNow.year, userNow.monthIndex, userNow.day + 7));
      const finalHour = hasSpecificTime ? targetHour : 18;
      return this.localToUtc(
        targetLocal.getUTCFullYear(),
        targetLocal.getUTCMonth(),
        targetLocal.getUTCDate(),
        finalHour,
        targetMinute,
        userTimezone,
      );
    }

    return null;
  }

  private containsSpecificDate(text: string): boolean {
    const keywords = [
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      'tomorrow', 'next week', 'november', 'december', 'january', 'february',
      'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october',
      'nov', 'dec', 'jan', 'feb', 'in three days', 'in 3 days', 'in 2 days', 'in two days',
      'in a week', 'in 1 week', 'in one week'
    ];
    return keywords.some((k) => text.includes(k));
  }
}
