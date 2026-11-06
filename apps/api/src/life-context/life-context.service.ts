import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { LifeContextRepository } from './life-context.repository';
import { JobSchedulerService } from '../jobs/job-scheduler.service';
import {
  GoalDto,
  CreateGoalRequestDto,
  UpdateGoalRequestDto,
  ProjectDto,
  CreateProjectRequestDto,
  UpdateProjectRequestDto,
  TaskDto,
  CreateTaskRequestDto,
  UpdateTaskRequestDto,
  CommitmentDto,
  CreateCommitmentRequestDto,
  UpdateCommitmentRequestDto,
  IdeaDto,
  CreateIdeaRequestDto,
  UpdateIdeaRequestDto,
  PromoteIdeaRequestDto,
  LifeOverviewDto,
  GoalCategory,
  GoalStatus,
  ProjectStatus,
  TaskStatus,
  PriorityLevel,
  CommitmentType,
  CommitmentStatus,
  CommitmentImportance,
  IdeaStatus,
} from '@niva/shared-types';
import {
  LifeGoal,
  LifeProject,
  LifeTask,
  LifeCommitment,
  LifeIdea,
} from '../database/schema';
import { EventPublisherService } from '../events/event-publisher.service';

@Injectable()
export class LifeContextService {
  private readonly logger = new Logger(LifeContextService.name);

  constructor(
    private readonly repository: LifeContextRepository,
    private readonly eventPublisher: EventPublisherService,
    @Inject(forwardRef(() => JobSchedulerService))
    private readonly jobScheduler?: JobSchedulerService,
  ) {}

  // ==========================================
  // GOALS
  // ==========================================
  async getGoals(
    userId: string,
    filter?: { status?: string; category?: string },
  ): Promise<GoalDto[]> {
    const goals = await this.repository.findGoals(userId, filter);
    return goals.map(this.mapGoalToDto);
  }

  async getGoalById(id: string, userId: string): Promise<GoalDto> {
    const goal = await this.repository.findGoalById(id, userId);
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }
    return this.mapGoalToDto(goal);
  }

  async createGoal(userId: string, dto: CreateGoalRequestDto): Promise<GoalDto> {
    const created = await this.repository.createGoal({
      userId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      category: dto.category,
      targetDate: dto.targetDate || null,
      priority: dto.priority || 'medium',
      progressPercentage: dto.progressPercentage ?? 0,
    });
    return this.mapGoalToDto(created);
  }

  async updateGoal(
    id: string,
    userId: string,
    dto: UpdateGoalRequestDto,
  ): Promise<GoalDto> {
    const existing = await this.repository.findGoalById(id, userId);
    if (!existing) {
      throw new NotFoundException('Goal not found');
    }

    const updated = await this.repository.updateGoal(id, userId, {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.targetDate !== undefined && { targetDate: dto.targetDate || null }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.progressPercentage !== undefined && { progressPercentage: dto.progressPercentage }),
    });

    if (!updated) {
      throw new NotFoundException('Goal not found');
    }
    return this.mapGoalToDto(updated);
  }

  async deleteGoal(id: string, userId: string): Promise<void> {
    const deleted = await this.repository.deleteGoal(id, userId);
    if (!deleted) {
      throw new NotFoundException('Goal not found');
    }
  }

  // ==========================================
  // PROJECTS
  // ==========================================
  async getProjects(
    userId: string,
    filter?: { goalId?: string; status?: string },
  ): Promise<ProjectDto[]> {
    const projects = await this.repository.findProjects(userId, filter);
    return projects.map(this.mapProjectToDto);
  }

  async getProjectById(id: string, userId: string): Promise<ProjectDto> {
    const project = await this.repository.findProjectById(id, userId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.mapProjectToDto(project);
  }

  async createProject(userId: string, dto: CreateProjectRequestDto): Promise<ProjectDto> {
    // If goalId provided, verify it belongs to user
    if (dto.goalId) {
      const goal = await this.repository.findGoalById(dto.goalId, userId);
      if (!goal) {
        throw new NotFoundException('Referenced goal not found or does not belong to you');
      }
    }

    const created = await this.repository.createProject({
      userId,
      goalId: dto.goalId || null,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      status: dto.status || 'in_progress',
      color: dto.color?.trim() || null,
      startDate: dto.startDate || null,
      targetDate: dto.targetDate || null,
    });
    return this.mapProjectToDto(created);
  }

  async updateProject(
    id: string,
    userId: string,
    dto: UpdateProjectRequestDto,
  ): Promise<ProjectDto> {
    const existing = await this.repository.findProjectById(id, userId);
    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    if (dto.goalId !== undefined && dto.goalId !== null) {
      const goal = await this.repository.findGoalById(dto.goalId, userId);
      if (!goal) {
        throw new NotFoundException('Referenced goal not found or does not belong to you');
      }
    }

    const updated = await this.repository.updateProject(id, userId, {
      ...(dto.goalId !== undefined && { goalId: dto.goalId }),
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.color !== undefined && { color: dto.color?.trim() || null }),
      ...(dto.startDate !== undefined && { startDate: dto.startDate || null }),
      ...(dto.targetDate !== undefined && { targetDate: dto.targetDate || null }),
    });

    if (!updated) {
      throw new NotFoundException('Project not found');
    }
    return this.mapProjectToDto(updated);
  }

  async deleteProject(id: string, userId: string): Promise<void> {
    const deleted = await this.repository.deleteProject(id, userId);
    if (!deleted) {
      throw new NotFoundException('Project not found');
    }
  }

  // ==========================================
  // TASKS
  // ==========================================
  async getTasks(
    userId: string,
    filter?: { projectId?: string; status?: string; priority?: string },
  ): Promise<TaskDto[]> {
    const tasks = await this.repository.findTasks(userId, filter);
    return tasks.map(this.mapTaskToDto);
  }

  async getTaskById(id: string, userId: string): Promise<TaskDto> {
    const task = await this.repository.findTaskById(id, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return this.mapTaskToDto(task);
  }

  async createTask(userId: string, dto: CreateTaskRequestDto): Promise<TaskDto> {
    // If projectId provided, verify it belongs to user
    if (dto.projectId) {
      const project = await this.repository.findProjectById(dto.projectId, userId);
      if (!project) {
        throw new NotFoundException('Referenced project not found or does not belong to you');
      }
    }

    const created = await this.repository.createTask({
      userId,
      projectId: dto.projectId || null,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      priority: dto.priority || 'medium',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      orderIndex: dto.orderIndex ?? 0,
    });
    const result = this.mapTaskToDto(created);

    await this.eventPublisher.publish({
      userId,
      eventType: 'TaskCreated',
      aggregateType: 'task',
      aggregateId: created.id,
      payload: {
        taskId: created.id,
        title: created.title,
        priority: created.priority,
        dueDate: created.dueDate ? created.dueDate.toISOString() : null,
      },
    });

    return result;
  }

  async updateTask(
    id: string,
    userId: string,
    dto: UpdateTaskRequestDto,
  ): Promise<TaskDto> {
    const existing = await this.repository.findTaskById(id, userId);
    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    if (dto.projectId !== undefined && dto.projectId !== null) {
      const project = await this.repository.findProjectById(dto.projectId, userId);
      if (!project) {
        throw new NotFoundException('Referenced project not found or does not belong to you');
      }
    }

    // Determine completion timestamp transitions
    let completedAt = existing.completedAt;
    if (dto.status !== undefined) {
      if (dto.status === 'completed' && existing.status !== 'completed') {
        completedAt = new Date();
      } else if (dto.status !== 'completed' && existing.status === 'completed') {
        completedAt = null;
      }
    }

    const updated = await this.repository.updateTask(id, userId, {
      ...(dto.projectId !== undefined && { projectId: dto.projectId }),
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
      ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
      completedAt,
    });

    if (!updated) {
      throw new NotFoundException('Task not found');
    }

    const result = this.mapTaskToDto(updated);

    // Check completion event
    if (dto.status === 'completed' && existing.status !== 'completed') {
      await this.eventPublisher.publish({
        userId,
        eventType: 'TaskCompleted',
        aggregateType: 'task',
        aggregateId: updated.id,
        payload: {
          taskId: updated.id,
          title: updated.title,
          completedAt: completedAt ? completedAt.toISOString() : new Date().toISOString(),
        },
      });
    }

    // Check postponement event (due date moved to a later date)
    if ((dto.status === 'completed' || dto.status === 'cancelled') && this.jobScheduler) {
      await this.jobScheduler.cancelJobsForTarget('task', id).catch(() => {});
    }

    if (
      existing.dueDate &&
      dto.dueDate &&
      new Date(dto.dueDate).getTime() > new Date(existing.dueDate).getTime()
    ) {
      await this.eventPublisher.publish({
        userId,
        eventType: 'TaskPostponed',
        aggregateType: 'task',
        aggregateId: updated.id,
        payload: {
          taskId: updated.id,
          title: updated.title,
          previousDueDate: existing.dueDate.toISOString(),
          newDueDate: new Date(dto.dueDate).toISOString(),
          postponementCount: 1,
        },
      });
    }

    return result;
  }

  async deleteTask(id: string, userId: string): Promise<void> {
    const deleted = await this.repository.deleteTask(id, userId);
    if (!deleted) {
      throw new NotFoundException('Task not found');
    }
    if (this.jobScheduler) {
      await this.jobScheduler.cancelJobsForTarget('task', id).catch(() => {});
    }
  }

  // ==========================================
  // COMMITMENTS
  // ==========================================
  async getCommitments(
    userId: string,
    filter?: { status?: string; from?: Date; to?: Date },
  ): Promise<CommitmentDto[]> {
    const commitments = await this.repository.findCommitments(userId, filter);
    return commitments.map(this.mapCommitmentToDto);
  }

  async getCommitmentById(id: string, userId: string): Promise<CommitmentDto> {
    const commitment = await this.repository.findCommitmentById(id, userId);
    if (!commitment) {
      throw new NotFoundException('Commitment not found');
    }
    return this.mapCommitmentToDto(commitment);
  }

  async createCommitment(
    userId: string,
    dto: CreateCommitmentRequestDto,
  ): Promise<CommitmentDto> {
    if (dto.relatedGoalId) {
      const goal = await this.repository.findGoalById(dto.relatedGoalId, userId);
      if (!goal) {
        throw new NotFoundException('Referenced goal not found or does not belong to you');
      }
    }
    if (dto.relatedProjectId) {
      const project = await this.repository.findProjectById(dto.relatedProjectId, userId);
      if (!project) {
        throw new NotFoundException('Referenced project not found or does not belong to you');
      }
    }

    const created = await this.repository.createCommitment({
      userId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      commitmentType: dto.commitmentType,
      dueAt: new Date(dto.dueAt),
      importance: dto.importance || 'standard',
      relatedGoalId: dto.relatedGoalId || null,
      relatedProjectId: dto.relatedProjectId || null,
    });
    const result = this.mapCommitmentToDto(created);

    if (this.jobScheduler && created.dueAt) {
      await this.jobScheduler
        .scheduleDeadlineIntelligence(
          userId,
          'commitment',
          created.id,
          created.title,
          created.dueAt,
        )
        .catch((err) => {
          this.logger.warn(`Failed to schedule deadline intelligence for commitment ${created.id}: ${err.message}`);
        });
    }

    await this.eventPublisher.publish({
      userId,
      eventType: 'CommitmentCreated',
      aggregateType: 'commitment',
      aggregateId: created.id,
      payload: {
        commitmentId: created.id,
        title: created.title,
        commitmentType: created.commitmentType,
        dueAt: created.dueAt.toISOString(),
        importance: created.importance,
      },
    });

    return result;
  }

  async updateCommitment(
    id: string,
    userId: string,
    dto: UpdateCommitmentRequestDto,
  ): Promise<CommitmentDto> {
    const existing = await this.repository.findCommitmentById(id, userId);
    if (!existing) {
      throw new NotFoundException('Commitment not found');
    }

    if (dto.relatedGoalId !== undefined && dto.relatedGoalId !== null) {
      const goal = await this.repository.findGoalById(dto.relatedGoalId, userId);
      if (!goal) {
        throw new NotFoundException('Referenced goal not found or does not belong to you');
      }
    }
    if (dto.relatedProjectId !== undefined && dto.relatedProjectId !== null) {
      const project = await this.repository.findProjectById(dto.relatedProjectId, userId);
      if (!project) {
        throw new NotFoundException('Referenced project not found or does not belong to you');
      }
    }

    const updated = await this.repository.updateCommitment(id, userId, {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
      ...(dto.commitmentType !== undefined && { commitmentType: dto.commitmentType }),
      ...(dto.dueAt !== undefined && { dueAt: new Date(dto.dueAt) }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.importance !== undefined && { importance: dto.importance }),
      ...(dto.relatedGoalId !== undefined && { relatedGoalId: dto.relatedGoalId }),
      ...(dto.relatedProjectId !== undefined && { relatedProjectId: dto.relatedProjectId }),
    });

    if (!updated) {
      throw new NotFoundException('Commitment not found');
    }

    if (dto.status === 'fulfilled' && this.jobScheduler) {
      await this.jobScheduler.cancelJobsForTarget('commitment', id).catch(() => {});
    } else if (dto.dueAt !== undefined && updated.status === 'upcoming' && this.jobScheduler) {
      await this.jobScheduler.rescheduleDeadline(
        userId,
        'commitment',
        updated.id,
        updated.title,
        updated.dueAt,
      ).catch(() => {});
    }

    const result = this.mapCommitmentToDto(updated);

    await this.eventPublisher.publish({
      userId,
      eventType: 'CommitmentUpdated',
      aggregateType: 'commitment',
      aggregateId: updated.id,
      payload: {
        commitmentId: updated.id,
        title: updated.title,
        commitmentType: updated.commitmentType,
        newDueAt: updated.dueAt.toISOString(),
        importance: updated.importance,
        status: updated.status,
      },
    });

    return result;
  }

  async deleteCommitment(id: string, userId: string): Promise<void> {
    const deleted = await this.repository.deleteCommitment(id, userId);
    if (!deleted) {
      throw new NotFoundException('Commitment not found');
    }
    if (this.jobScheduler) {
      await this.jobScheduler.cancelJobsForTarget('commitment', id).catch(() => {});
    }
  }

  // ==========================================
  // IDEAS
  // ==========================================
  async getIdeas(
    userId: string,
    filter?: { status?: string },
  ): Promise<IdeaDto[]> {
    const ideas = await this.repository.findIdeas(userId, filter);
    return ideas.map(this.mapIdeaToDto);
  }

  async getIdeaById(id: string, userId: string): Promise<IdeaDto> {
    const idea = await this.repository.findIdeaById(id, userId);
    if (!idea) {
      throw new NotFoundException('Idea not found');
    }
    return this.mapIdeaToDto(idea);
  }

  async createIdea(userId: string, dto: CreateIdeaRequestDto): Promise<IdeaDto> {
    const created = await this.repository.createIdea({
      userId,
      title: dto.title.trim(),
      content: dto.content.trim(),
      tags: dto.tags || [],
    });
    return this.mapIdeaToDto(created);
  }

  async updateIdea(
    id: string,
    userId: string,
    dto: UpdateIdeaRequestDto,
  ): Promise<IdeaDto> {
    const existing = await this.repository.findIdeaById(id, userId);
    if (!existing) {
      throw new NotFoundException('Idea not found');
    }

    const updated = await this.repository.updateIdea(id, userId, {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.content !== undefined && { content: dto.content.trim() }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
      ...(dto.status !== undefined && { status: dto.status }),
    });

    if (!updated) {
      throw new NotFoundException('Idea not found');
    }
    return this.mapIdeaToDto(updated);
  }

  async deleteIdea(id: string, userId: string): Promise<void> {
    const deleted = await this.repository.deleteIdea(id, userId);
    if (!deleted) {
      throw new NotFoundException('Idea not found');
    }
  }

  // ==========================================
  // PROMOTE IDEA TO PROJECT
  // ==========================================
  async promoteIdeaToProject(
    ideaId: string,
    userId: string,
    dto: PromoteIdeaRequestDto,
  ): Promise<{ idea: IdeaDto; project: ProjectDto }> {
    const idea = await this.repository.findIdeaById(ideaId, userId);
    if (!idea) {
      throw new NotFoundException('Idea not found');
    }
    if (idea.status === 'promoted' && idea.promotedToProjectId) {
      throw new BadRequestException('Idea is already promoted to a project');
    }

    // Create project
    const project = await this.repository.createProject({
      userId,
      title: dto.title?.trim() || idea.title,
      description: dto.description?.trim() || idea.content,
      color: dto.color?.trim() || null,
      status: 'planning',
    });

    // Update idea
    const updatedIdea = await this.repository.updateIdea(ideaId, userId, {
      status: 'promoted',
      promotedToProjectId: project.id,
    });

    return {
      idea: this.mapIdeaToDto(updatedIdea!),
      project: this.mapProjectToDto(project),
    };
  }

  // ==========================================
  // LIFE OVERVIEW
  // ==========================================
  async getOverview(userId: string): Promise<LifeOverviewDto> {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [allGoals, allProjects, allTasks, imminentCommitments, allIdeas] =
      await Promise.all([
        this.repository.findGoals(userId),
        this.repository.findProjects(userId),
        this.repository.findTasks(userId),
        this.repository.findCommitments(userId, {
          status: 'upcoming',
          from: now,
          to: sevenDaysLater,
        }),
        this.repository.findIdeas(userId),
      ]);

    const activeGoals = allGoals.filter((g) => g.status === 'active');
    const activeProjects = allProjects.filter(
      (p) => p.status === 'in_progress' || p.status === 'planning',
    );
    const pendingTasks = allTasks.filter(
      (t) => t.status === 'todo' || t.status === 'in_progress',
    );
    const urgentTasks = pendingTasks.filter(
      (t) => t.priority === 'urgent' || t.priority === 'high',
    );

    return {
      activeGoals: activeGoals.slice(0, 5).map(this.mapGoalToDto),
      activeProjects: activeProjects.slice(0, 5).map(this.mapProjectToDto),
      pendingTasks: pendingTasks.slice(0, 8).map(this.mapTaskToDto),
      imminentCommitments: imminentCommitments.slice(0, 5).map(this.mapCommitmentToDto),
      recentIdeas: allIdeas.slice(0, 5).map(this.mapIdeaToDto),
      summary: {
        totalGoals: allGoals.length,
        activeGoalsCount: activeGoals.length,
        totalProjects: allProjects.length,
        activeProjectsCount: activeProjects.length,
        pendingTasksCount: pendingTasks.length,
        urgentTasksCount: urgentTasks.length,
        imminentCommitmentsCount: imminentCommitments.length,
        ideasCount: allIdeas.length,
      },
    };
  }

  // ==========================================
  // DTO MAPPERS
  // ==========================================
  private mapGoalToDto(entity: LifeGoal): GoalDto {
    return {
      id: entity.id,
      userId: entity.userId,
      title: entity.title,
      description: entity.description,
      category: entity.category as GoalCategory,
      targetDate: entity.targetDate,
      status: entity.status as GoalStatus,
      priority: entity.priority as 'high' | 'medium' | 'low',
      progressPercentage: entity.progressPercentage,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private mapProjectToDto(entity: LifeProject): ProjectDto {
    return {
      id: entity.id,
      userId: entity.userId,
      goalId: entity.goalId,
      title: entity.title,
      description: entity.description,
      status: entity.status as ProjectStatus,
      color: entity.color,
      startDate: entity.startDate,
      targetDate: entity.targetDate,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private mapTaskToDto(entity: LifeTask): TaskDto {
    return {
      id: entity.id,
      userId: entity.userId,
      projectId: entity.projectId,
      title: entity.title,
      description: entity.description,
      status: entity.status as TaskStatus,
      priority: entity.priority as PriorityLevel,
      dueDate: entity.dueDate ? entity.dueDate.toISOString() : null,
      completedAt: entity.completedAt ? entity.completedAt.toISOString() : null,
      orderIndex: entity.orderIndex,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private mapCommitmentToDto(entity: LifeCommitment): CommitmentDto {
    return {
      id: entity.id,
      userId: entity.userId,
      title: entity.title,
      description: entity.description,
      commitmentType: entity.commitmentType as CommitmentType,
      dueAt: entity.dueAt.toISOString(),
      status: entity.status as CommitmentStatus,
      importance: entity.importance as CommitmentImportance,
      relatedGoalId: entity.relatedGoalId,
      relatedProjectId: entity.relatedProjectId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private mapIdeaToDto(entity: LifeIdea): IdeaDto {
    return {
      id: entity.id,
      userId: entity.userId,
      title: entity.title,
      content: entity.content,
      tags: (entity.tags as string[]) || [],
      status: entity.status as IdeaStatus,
      promotedToProjectId: entity.promotedToProjectId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
