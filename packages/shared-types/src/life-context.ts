// Canonical Life Context domain types and DTOs

export type GoalCategory =
  | 'career'
  | 'technical'
  | 'academic'
  | 'personal'
  | 'health';

export type GoalStatus =
  | 'active'
  | 'completed'
  | 'paused'
  | 'abandoned';

export type PriorityLevel =
  | 'urgent'
  | 'high'
  | 'medium'
  | 'low';

export type ProjectStatus =
  | 'planning'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'archived';

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type CommitmentType =
  | 'interview'
  | 'exam'
  | 'deadline'
  | 'meeting'
  | 'habit_routine';

export type CommitmentStatus =
  | 'upcoming'
  | 'fulfilled'
  | 'missed'
  | 'rescheduled';

export type CommitmentImportance =
  | 'critical'
  | 'high'
  | 'standard';

export type IdeaStatus =
  | 'raw'
  | 'incubating'
  | 'promoted'
  | 'archived';

// DTOs

export interface GoalDto {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: GoalCategory;
  targetDate: string | null;
  status: GoalStatus;
  priority: 'high' | 'medium' | 'low';
  progressPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalRequestDto {
  title: string;
  description?: string | null;
  category: GoalCategory;
  targetDate?: string | null;
  priority?: 'high' | 'medium' | 'low';
  progressPercentage?: number;
}

export interface UpdateGoalRequestDto {
  title?: string;
  description?: string | null;
  category?: GoalCategory;
  targetDate?: string | null;
  status?: GoalStatus;
  priority?: 'high' | 'medium' | 'low';
  progressPercentage?: number;
}

export interface ProjectDto {
  id: string;
  userId: string;
  goalId: string | null;
  title: string;
  description: string | null;
  status: ProjectStatus;
  color: string | null;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequestDto {
  goalId?: string | null;
  title: string;
  description?: string | null;
  status?: ProjectStatus;
  color?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface UpdateProjectRequestDto {
  goalId?: string | null;
  title?: string;
  description?: string | null;
  status?: ProjectStatus;
  color?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface TaskDto {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: PriorityLevel;
  dueDate: string | null;
  completedAt: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequestDto {
  projectId?: string | null;
  title: string;
  description?: string | null;
  priority?: PriorityLevel;
  dueDate?: string | null;
  orderIndex?: number;
}

export interface UpdateTaskRequestDto {
  projectId?: string | null;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: PriorityLevel;
  dueDate?: string | null;
  orderIndex?: number;
}

export interface CommitmentDto {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  commitmentType: CommitmentType;
  dueAt: string;
  status: CommitmentStatus;
  importance: CommitmentImportance;
  relatedGoalId: string | null;
  relatedProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommitmentRequestDto {
  title: string;
  description?: string | null;
  commitmentType: CommitmentType;
  dueAt: string;
  importance?: CommitmentImportance;
  relatedGoalId?: string | null;
  relatedProjectId?: string | null;
}

export interface UpdateCommitmentRequestDto {
  title?: string;
  description?: string | null;
  commitmentType?: CommitmentType;
  dueAt?: string;
  status?: CommitmentStatus;
  importance?: CommitmentImportance;
  relatedGoalId?: string | null;
  relatedProjectId?: string | null;
}

export interface IdeaDto {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  status: IdeaStatus;
  promotedToProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIdeaRequestDto {
  title: string;
  content: string;
  tags?: string[];
}

export interface UpdateIdeaRequestDto {
  title?: string;
  content?: string;
  tags?: string[];
  status?: IdeaStatus;
}

export interface PromoteIdeaRequestDto {
  title?: string;
  description?: string | null;
  color?: string | null;
}

export interface LifeOverviewDto {
  activeGoals: GoalDto[];
  activeProjects: ProjectDto[];
  pendingTasks: TaskDto[];
  imminentCommitments: CommitmentDto[];
  recentIdeas: IdeaDto[];
  summary: {
    totalGoals: number;
    activeGoalsCount: number;
    totalProjects: number;
    activeProjectsCount: number;
    pendingTasksCount: number;
    urgentTasksCount: number;
    imminentCommitmentsCount: number;
    ideasCount: number;
  };
}
