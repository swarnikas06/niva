import { z } from 'zod';

export const GoalCategoryEnum = z.enum([
  'career',
  'technical',
  'academic',
  'personal',
  'health',
]);

export const GoalStatusEnum = z.enum([
  'active',
  'completed',
  'paused',
  'abandoned',
]);

export const PriorityEnum = z.enum(['high', 'medium', 'low']);
export const TaskPriorityEnum = z.enum(['urgent', 'high', 'medium', 'low']);

export const ProjectStatusEnum = z.enum([
  'planning',
  'in_progress',
  'on_hold',
  'completed',
  'archived',
]);

export const TaskStatusEnum = z.enum([
  'todo',
  'in_progress',
  'completed',
  'cancelled',
]);

export const CommitmentTypeEnum = z.enum([
  'interview',
  'exam',
  'deadline',
  'meeting',
  'habit_routine',
]);

export const CommitmentStatusEnum = z.enum([
  'upcoming',
  'fulfilled',
  'missed',
  'rescheduled',
]);

export const CommitmentImportanceEnum = z.enum([
  'critical',
  'high',
  'standard',
]);

export const IdeaStatusEnum = z.enum([
  'raw',
  'incubating',
  'promoted',
  'archived',
]);

// 1. Goals Schemas
export const CreateGoalSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255, 'Title must not exceed 255 characters'),
  description: z.string().trim().max(5000).nullable().optional(),
  category: GoalCategoryEnum,
  targetDate: z.string().nullable().optional(),
  priority: PriorityEnum.optional().default('medium'),
  progressPercentage: z.number().int().min(0).max(100).optional().default(0),
});

export const UpdateGoalSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  category: GoalCategoryEnum.optional(),
  targetDate: z.string().nullable().optional(),
  status: GoalStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  progressPercentage: z.number().int().min(0).max(100).optional(),
});

// 2. Projects Schemas
export const CreateProjectSchema = z.object({
  goalId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, 'Title is required').max(255, 'Title must not exceed 255 characters'),
  description: z.string().trim().max(5000).nullable().optional(),
  status: ProjectStatusEnum.optional().default('in_progress'),
  color: z.string().trim().max(32).nullable().optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
});

export const UpdateProjectSchema = z.object({
  goalId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: ProjectStatusEnum.optional(),
  color: z.string().trim().max(32).nullable().optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
});

// 3. Tasks Schemas
export const CreateTaskSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, 'Title is required').max(255, 'Title must not exceed 255 characters'),
  description: z.string().trim().max(5000).nullable().optional(),
  priority: TaskPriorityEnum.optional().default('medium'),
  dueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
  orderIndex: z.number().int().optional().default(0),
});

export const UpdateTaskSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  dueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
  orderIndex: z.number().int().optional(),
});

// 4. Commitments Schemas
export const CreateCommitmentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255, 'Title must not exceed 255 characters'),
  description: z.string().trim().max(5000).nullable().optional(),
  commitmentType: CommitmentTypeEnum,
  dueAt: z.string().min(1, 'dueAt timestamp is required'),
  importance: CommitmentImportanceEnum.optional().default('standard'),
  relatedGoalId: z.string().uuid().nullable().optional(),
  relatedProjectId: z.string().uuid().nullable().optional(),
});

export const UpdateCommitmentSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  commitmentType: CommitmentTypeEnum.optional(),
  dueAt: z.string().optional(),
  status: CommitmentStatusEnum.optional(),
  importance: CommitmentImportanceEnum.optional(),
  relatedGoalId: z.string().uuid().nullable().optional(),
  relatedProjectId: z.string().uuid().nullable().optional(),
});

// 5. Ideas Schemas
export const CreateIdeaSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255, 'Title must not exceed 255 characters'),
  content: z.string().trim().min(1, 'Content is required'),
  tags: z.array(z.string().trim().max(50)).optional().default([]),
});

export const UpdateIdeaSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
  status: IdeaStatusEnum.optional(),
});

export const PromoteIdeaSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  color: z.string().trim().max(32).nullable().optional(),
});
