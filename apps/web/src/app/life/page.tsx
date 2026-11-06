'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { authFetch } from '@/lib/auth-client';
import {
  GoalDto,
  ProjectDto,
  TaskDto,
  CommitmentDto,
  IdeaDto,
  LifeOverviewDto,
  GoalCategory,
  ProjectStatus,
  PriorityLevel,
  CommitmentType,
  CommitmentImportance,
} from '@niva/shared-types';

type ActiveTab = 'overview' | 'goals_projects' | 'tasks_commitments' | 'ideas';

export default function LifePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Domain data
  const [overview, setOverview] = useState<LifeOverviewDto | null>(null);
  const [goals, setGoals] = useState<GoalDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [commitments, setCommitments] = useState<CommitmentDto[]>([]);
  const [ideas, setIdeas] = useState<IdeaDto[]>([]);

  // Modals state
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);
  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);
  const [showCommitmentModal, setShowCommitmentModal] = useState<boolean>(false);
  const [showIdeaModal, setShowIdeaModal] = useState<boolean>(false);
  const [editingIdea, setEditingIdea] = useState<IdeaDto | null>(null);

  // Form states
  const [goalForm, setGoalForm] = useState<{
    title: string;
    description: string;
    category: GoalCategory;
    priority: 'high' | 'medium' | 'low';
    targetDate: string;
  }>({
    title: '',
    description: '',
    category: 'career',
    priority: 'high',
    targetDate: '',
  });

  const [projectForm, setProjectForm] = useState<{
    title: string;
    description: string;
    goalId: string;
    status: ProjectStatus;
    color: string;
  }>({
    title: '',
    description: '',
    goalId: '',
    status: 'in_progress',
    color: '#0d9488',
  });

  const [taskForm, setTaskForm] = useState<{
    title: string;
    description: string;
    projectId: string;
    priority: PriorityLevel;
    dueDate: string;
  }>({
    title: '',
    description: '',
    projectId: '',
    priority: 'medium',
    dueDate: '',
  });

  const [commitmentForm, setCommitmentForm] = useState<{
    title: string;
    description: string;
    commitmentType: CommitmentType;
    dueAt: string;
    importance: CommitmentImportance;
    relatedGoalId: string;
    relatedProjectId: string;
  }>({
    title: '',
    description: '',
    commitmentType: 'interview',
    dueAt: '',
    importance: 'high',
    relatedGoalId: '',
    relatedProjectId: '',
  });

  const [ideaForm, setIdeaForm] = useState<{
    title: string;
    content: string;
    tagsString: string;
  }>({
    title: '',
    content: '',
    tagsString: '',
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load all life context data
  const loadLifeData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [overviewData, goalsData, projectsData, tasksData, commitmentsData, ideasData] =
        await Promise.all([
          authFetch<LifeOverviewDto>('/life/overview'),
          authFetch<GoalDto[]>('/life/goals'),
          authFetch<ProjectDto[]>('/life/projects'),
          authFetch<TaskDto[]>('/life/tasks'),
          authFetch<CommitmentDto[]>('/life/commitments'),
          authFetch<IdeaDto[]>('/life/ideas'),
        ]);

      setOverview(overviewData);
      setGoals(goalsData || []);
      setProjects(projectsData || []);
      setTasks(tasksData || []);
      setCommitments(commitmentsData || []);
      setIdeas(ideasData || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load life context');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLifeData();
  }, [loadLifeData]);

  const notifySuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // ==========================================
  // HANDLERS: GOALS
  // ==========================================
  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.title.trim()) return;
    setIsSubmitting(true);
    try {
      await authFetch('/life/goals', {
        method: 'POST',
        body: JSON.stringify({
          title: goalForm.title.trim(),
          description: goalForm.description.trim() || undefined,
          category: goalForm.category,
          priority: goalForm.priority,
          targetDate: goalForm.targetDate || undefined,
        }),
      });
      setShowGoalModal(false);
      setGoalForm({ title: '', description: '', category: 'career', priority: 'high', targetDate: '' });
      notifySuccess('Goal created successfully');
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGoalProgress = async (id: string, progress: number) => {
    try {
      await authFetch(`/life/goals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ progressPercentage: progress }),
      });
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update goal progress');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await authFetch(`/life/goals/${id}`, { method: 'DELETE' });
      notifySuccess('Goal deleted');
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete goal');
    }
  };

  // ==========================================
  // HANDLERS: PROJECTS
  // ==========================================
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.title.trim()) return;
    setIsSubmitting(true);
    try {
      await authFetch('/life/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: projectForm.title.trim(),
          description: projectForm.description.trim() || undefined,
          goalId: projectForm.goalId || undefined,
          status: projectForm.status,
          color: projectForm.color,
        }),
      });
      setShowProjectModal(false);
      setProjectForm({ title: '', description: '', goalId: '', status: 'in_progress', color: '#0d9488' });
      notifySuccess('Project created successfully');
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await authFetch(`/life/projects/${id}`, { method: 'DELETE' });
      notifySuccess('Project deleted');
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete project');
    }
  };

  // ==========================================
  // HANDLERS: TASKS
  // ==========================================
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setIsSubmitting(true);
    try {
      await authFetch('/life/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || undefined,
          projectId: taskForm.projectId || undefined,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || undefined,
        }),
      });
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', projectId: '', priority: 'medium', dueDate: '' });
      notifySuccess('Task added successfully');
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleTaskStatus = async (task: TaskDto) => {
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: nextStatus,
              completedAt: nextStatus === 'completed' ? new Date().toISOString() : null,
            }
          : t,
      ),
    );

    try {
      await authFetch(`/life/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update task');
      await loadLifeData(); // Revert
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await authFetch(`/life/tasks/${id}`, { method: 'DELETE' });
      notifySuccess('Task removed');
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete task');
    }
  };

  // ==========================================
  // HANDLERS: COMMITMENTS
  // ==========================================
  const handleCreateCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitmentForm.title.trim() || !commitmentForm.dueAt) return;
    setIsSubmitting(true);
    try {
      await authFetch('/life/commitments', {
        method: 'POST',
        body: JSON.stringify({
          title: commitmentForm.title.trim(),
          description: commitmentForm.description.trim() || undefined,
          commitmentType: commitmentForm.commitmentType,
          dueAt: new Date(commitmentForm.dueAt).toISOString(),
          importance: commitmentForm.importance,
          relatedGoalId: commitmentForm.relatedGoalId || undefined,
          relatedProjectId: commitmentForm.relatedProjectId || undefined,
        }),
      });
      setShowCommitmentModal(false);
      setCommitmentForm({
        title: '',
        description: '',
        commitmentType: 'interview',
        dueAt: '',
        importance: 'high',
        relatedGoalId: '',
        relatedProjectId: '',
      });
      notifySuccess('Commitment scheduled successfully');
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to schedule commitment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleCommitmentStatus = async (comm: CommitmentDto) => {
    const nextStatus = comm.status === 'fulfilled' ? 'upcoming' : 'fulfilled';
    try {
      await authFetch(`/life/commitments/${comm.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      notifySuccess(nextStatus === 'fulfilled' ? 'Commitment marked fulfilled' : 'Commitment reopened');
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update commitment');
    }
  };

  const handleDeleteCommitment = async (id: string) => {
    try {
      await authFetch(`/life/commitments/${id}`, { method: 'DELETE' });
      notifySuccess('Commitment removed');
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete commitment');
    }
  };

  // ==========================================
  // HANDLERS: IDEAS & PROMOTE
  // ==========================================
  const handleCreateOrUpdateIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaForm.title.trim() || !ideaForm.content.trim()) return;
    setIsSubmitting(true);
    const tags = ideaForm.tagsString
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      if (editingIdea) {
        await authFetch(`/life/ideas/${editingIdea.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: ideaForm.title.trim(),
            content: ideaForm.content.trim(),
            tags,
          }),
        });
        notifySuccess('Idea updated');
      } else {
        await authFetch('/life/ideas', {
          method: 'POST',
          body: JSON.stringify({
            title: ideaForm.title.trim(),
            content: ideaForm.content.trim(),
            tags,
          }),
        });
        notifySuccess('Idea recorded');
      }
      setShowIdeaModal(false);
      setEditingIdea(null);
      setIdeaForm({ title: '', content: '', tagsString: '' });
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save idea');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromoteIdea = async (idea: IdeaDto) => {
    try {
      await authFetch(`/life/ideas/${idea.id}/promote`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      notifySuccess(`Idea "${idea.title}" promoted to Project!`);
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to promote idea');
    }
  };

  const handleDeleteIdea = async (id: string) => {
    try {
      await authFetch(`/life/ideas/${id}`, { method: 'DELETE' });
      notifySuccess('Idea deleted');
      await loadLifeData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete idea');
    }
  };

  if (isLoading) {
    return (
      <PageContainer maxWidth="lg" className="py-12">
        <LoadingState message="Connecting to your personal context..." />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="lg" className="py-6 sm:py-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="presence" size="sm">Life & Context</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Personal Reality & Grounding
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Your goals, active projects, tasks, commitments, and ideas that inform NIVA&apos;s continuity
          </p>
        </div>

        {/* Action Button depending on tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'goals_projects' && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowProjectModal(true)}>
                + New Project
              </Button>
              <Button size="sm" onClick={() => setShowGoalModal(true)}>
                + New Goal
              </Button>
            </>
          )}
          {activeTab === 'tasks_commitments' && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowCommitmentModal(true)}>
                + New Commitment
              </Button>
              <Button size="sm" onClick={() => setShowTaskModal(true)}>
                + New Task
              </Button>
            </>
          )}
          {activeTab === 'ideas' && (
            <Button size="sm" onClick={() => { setEditingIdea(null); setIdeaForm({ title: '', content: '', tagsString: '' }); setShowIdeaModal(true); }}>
              + Capture Idea
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="mb-6 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-medium flex items-center gap-2">
          <span>✓</span>
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mb-6 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
          <span>✕</span>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-border mb-8 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2.5 px-4 text-xs font-mono border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Overview
          {overview?.summary && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-surface border border-border text-[10px] font-mono">
              {overview.summary.activeGoalsCount + overview.summary.activeProjectsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('goals_projects')}
          className={`py-2.5 px-4 text-xs font-mono border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'goals_projects'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Goals & Projects
          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-surface border border-border text-[10px] font-mono">
            {goals.length + projects.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('tasks_commitments')}
          className={`py-2.5 px-4 text-xs font-mono border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'tasks_commitments'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Tasks & Commitments
          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-surface border border-border text-[10px] font-mono">
            {tasks.filter((t) => t.status !== 'completed').length + commitments.filter((c) => c.status === 'upcoming').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ideas')}
          className={`py-2.5 px-4 text-xs font-mono border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'ideas'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Sparks & Ideas
          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-surface border border-border text-[10px] font-mono">
            {ideas.length}
          </span>
        </button>
      </div>

      {/* ========================================== */}
      {/* 1. OVERVIEW VIEW */}
      {/* ========================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Executive Pulse Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-border/80 bg-surface/50 shadow-subtle">
              <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground block">Active Goals</span>
              <span className="text-2xl font-bold font-mono text-foreground mt-1 block">{overview?.summary.activeGoalsCount ?? 0}</span>
              <span className="text-2xs font-mono text-muted-foreground mt-0.5 block">{overview?.summary.totalGoals ?? 0} total targets</span>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-surface/50 shadow-subtle">
              <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground block">In-Flight Projects</span>
              <span className="text-2xl font-bold font-mono text-foreground mt-1 block">{overview?.summary.activeProjectsCount ?? 0}</span>
              <span className="text-2xs font-mono text-muted-foreground mt-0.5 block">{overview?.summary.totalProjects ?? 0} registered</span>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-surface/50 shadow-subtle">
              <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground block">Pending Tasks</span>
              <span className="text-2xl font-bold font-mono text-primary mt-1 block">{overview?.summary.pendingTasksCount ?? 0}</span>
              <span className="text-2xs font-mono text-primary/80 mt-0.5 block">{overview?.summary.urgentTasksCount ?? 0} high priority</span>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-surface/50 shadow-subtle">
              <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground block">7-Day Commitments</span>
              <span className="text-2xl font-bold font-mono text-foreground mt-1 block">{overview?.summary.imminentCommitmentsCount ?? 0}</span>
              <span className="text-2xs font-mono text-muted-foreground mt-0.5 block">Imminent obligations</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Active Goals Column */}
            <div className="p-6 rounded-2xl border border-border bg-card shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-semibold text-foreground tracking-widest uppercase">Active Goals</h2>
                <button onClick={() => setActiveTab('goals_projects')} className="text-xs font-mono text-primary hover:underline cursor-pointer">View all &rarr;</button>
              </div>

              {overview?.activeGoals && overview.activeGoals.length > 0 ? (
                <div className="space-y-3">
                  {overview.activeGoals.map((goal) => (
                    <div key={goal.id} className="p-3.5 rounded-xl border border-border/70 bg-surface/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{goal.title}</span>
                        <Badge variant="neutral" size="sm">{goal.category}</Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-2xs font-mono text-muted-foreground">
                          <span>Progress</span>
                          <span>{goal.progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-border/40 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-brand-indigo h-1.5 rounded-full transition-all"
                            style={{ width: `${goal.progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-4">No active goals yet. Add your primary aspirations in the Goals tab.</p>
              )}
            </div>

            {/* Imminent Commitments Column */}
            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground tracking-wide uppercase">Upcoming Commitments (Next 7 Days)</h2>
                <button onClick={() => setActiveTab('tasks_commitments')} className="text-xs text-accent hover:underline">View all &rarr;</button>
              </div>

              {overview?.imminentCommitments && overview.imminentCommitments.length > 0 ? (
                <div className="space-y-3">
                  {overview.imminentCommitments.map((comm) => {
                    const due = new Date(comm.dueAt);
                    return (
                      <div key={comm.id} className="p-3.5 rounded-xl border border-border-subtle bg-surface-subtle flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-foreground">{comm.title}</span>
                            <Badge variant={comm.importance === 'critical' ? 'danger' : 'warning'} size="sm">
                              {comm.commitmentType}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {due.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {due.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          onClick={() => handleToggleCommitmentStatus(comm)}
                          className="text-[11px] font-medium text-accent hover:underline whitespace-nowrap"
                        >
                          Mark Done
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-4">No commitments scheduled in the next 7 days.</p>
              )}
            </div>
          </div>

          {/* Pending Priority Tasks */}
          <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground tracking-wide uppercase">Open Tasks & Execution Loops</h2>
              <button onClick={() => setActiveTab('tasks_commitments')} className="text-xs text-accent hover:underline">Manage tasks &rarr;</button>
            </div>

            {overview?.pendingTasks && overview.pendingTasks.length > 0 ? (
              <div className="divide-y divide-border-subtle">
                {overview.pendingTasks.map((t) => (
                  <div key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={t.status === 'completed'}
                        onChange={() => handleToggleTaskStatus(t)}
                        className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                      />
                      <span className={`text-xs ${t.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>
                        {t.title}
                      </span>
                    </label>
                    <Badge variant={t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : 'neutral'} size="sm">
                      {t.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-4">All tasks completed! Add actionable items in the Tasks tab.</p>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. GOALS & PROJECTS VIEW */}
      {/* ========================================== */}
      {activeTab === 'goals_projects' && (
        <div className="space-y-10">
          {/* Goals Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Long-Term Goals</h2>
                <p className="text-xs text-muted-foreground">Strategic milestones and focus areas</p>
              </div>
              <Button size="sm" onClick={() => setShowGoalModal(true)}>+ Add Goal</Button>
            </div>

            {goals.length === 0 ? (
              <EmptyState
                title="No Goals Defined"
                description="Establish your placement, career, or academic goals so NIVA can align daily conversations with your targets."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.map((g) => (
                  <div key={g.id} className="p-5 rounded-2xl border border-border bg-surface shadow-subtle space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
                        {g.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.description}</p>}
                      </div>
                      <Badge variant="presence" size="sm">{g.category}</Badge>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-border-subtle">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Progress: <strong className="text-foreground">{g.progressPercentage}%</strong></span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateGoalProgress(g.id, Math.max(0, g.progressPercentage - 10))}
                            className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            -10
                          </button>
                          <button
                            onClick={() => handleUpdateGoalProgress(g.id, Math.min(100, g.progressPercentage + 10))}
                            className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            +10
                          </button>
                        </div>
                      </div>
                      <div className="w-full bg-border-subtle rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-accent h-1.5 rounded-full transition-all"
                          style={{ width: `${g.progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground border-t border-border-subtle">
                      <span>Status: <strong className="capitalize text-foreground">{g.status}</strong></span>
                      <button onClick={() => handleDeleteGoal(g.id)} className="text-destructive hover:underline">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Projects Section */}
          <section className="space-y-4 pt-6 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Active Projects</h2>
                <p className="text-xs text-muted-foreground">In-flight builds, repositories, and study courses</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowProjectModal(true)}>+ Add Project</Button>
            </div>

            {projects.length === 0 ? (
              <EmptyState
                title="No Projects Registered"
                description="Break down your goals into active technical builds or learning initiatives."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((p) => {
                  const linkedGoal = goals.find((g) => g.id === p.goalId);
                  return (
                    <div key={p.id} className="p-4 rounded-xl border border-border bg-surface shadow-subtle space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color || '#0d9488' }} />
                          <h3 className="text-xs font-semibold text-foreground">{p.title}</h3>
                        </div>
                        <Badge variant="neutral" size="sm">{p.status}</Badge>
                      </div>

                      {p.description && <p className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</p>}

                      {linkedGoal && (
                        <div className="text-[11px] text-accent flex items-center gap-1 pt-1 border-t border-border-subtle">
                          <span>Target Goal:</span>
                          <span className="font-medium truncate">{linkedGoal.title}</span>
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        <button onClick={() => handleDeleteProject(p.id)} className="text-[10px] text-destructive hover:underline">Delete Project</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================== */}
      {/* 3. TASKS & COMMITMENTS VIEW */}
      {/* ========================================== */}
      {activeTab === 'tasks_commitments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Tasks Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Task Checklist</h2>
                <p className="text-xs text-muted-foreground">Actionable steps and daily focus</p>
              </div>
              <Button size="sm" onClick={() => setShowTaskModal(true)}>+ Add Task</Button>
            </div>

            {tasks.length === 0 ? (
              <EmptyState title="No Tasks" description="Add specific actionable tasks to stay accountable." />
            ) : (
              <div className="divide-y divide-border border border-border rounded-xl bg-surface p-2 shadow-subtle">
                {tasks.map((t) => {
                  const project = projects.find((p) => p.id === t.projectId);
                  return (
                    <div key={t.id} className="py-2.5 px-3 flex items-center justify-between gap-3">
                      <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={t.status === 'completed'}
                          onChange={() => handleToggleTaskStatus(t)}
                          className="mt-0.5 rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <p className={`text-xs ${t.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>
                            {t.title}
                          </p>
                          {project && <span className="text-[10px] text-muted-foreground block">{project.title}</span>}
                        </div>
                      </label>

                      <div className="flex items-center gap-2">
                        <Badge variant={t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : 'neutral'} size="sm">
                          {t.priority}
                        </Badge>
                        <button onClick={() => handleDeleteTask(t.id)} className="text-[11px] text-muted-foreground hover:text-destructive">✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Commitments Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Real-World Commitments</h2>
                <p className="text-xs text-muted-foreground">Interviews, exams, and firm deadlines</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowCommitmentModal(true)}>+ Add Commitment</Button>
            </div>

            {commitments.length === 0 ? (
              <EmptyState title="No Commitments" description="Schedule your upcoming interviews, exams, or major obligations." />
            ) : (
              <div className="space-y-3">
                {commitments.map((c) => {
                  const due = new Date(c.dueAt);
                  const isFulfilled = c.status === 'fulfilled';
                  return (
                    <div key={c.id} className={`p-4 rounded-xl border ${isFulfilled ? 'border-border/50 bg-surface-muted/30' : 'border-border bg-surface'} shadow-subtle space-y-2`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className={`text-xs font-semibold ${isFulfilled ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {c.title}
                          </h3>
                          {c.description && <p className="text-[11px] text-muted-foreground mt-0.5">{c.description}</p>}
                        </div>
                        <Badge variant={c.importance === 'critical' ? 'danger' : 'presence'} size="sm">
                          {c.commitmentType}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border-subtle">
                        <span>Due: <strong className="text-foreground">{due.toLocaleDateString()} {due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleToggleCommitmentStatus(c)} className="text-accent hover:underline font-medium">
                            {isFulfilled ? 'Reopen' : 'Mark Fulfilled'}
                          </button>
                          <button onClick={() => handleDeleteCommitment(c.id)} className="text-destructive hover:underline">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 4. SPARKS & IDEAS VIEW */}
      {/* ========================================== */}
      {activeTab === 'ideas' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Idea Sparks & Notes</h2>
              <p className="text-xs text-muted-foreground">Unstructured thoughts, architecture concepts, and seeds</p>
            </div>
            <Button size="sm" onClick={() => { setEditingIdea(null); setIdeaForm({ title: '', content: '', tagsString: '' }); setShowIdeaModal(true); }}>
              + Capture Idea
            </Button>
          </div>

          {ideas.length === 0 ? (
            <EmptyState title="No Ideas Recorded" description="Capture creative sparks or study insights before they slip away." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ideas.map((idea) => (
                <div key={idea.id} className="p-5 rounded-2xl border border-border bg-surface shadow-subtle space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{idea.title}</h3>
                      <Badge variant={idea.status === 'promoted' ? 'success' : 'neutral'} size="sm">
                        {idea.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{idea.content}</p>

                    {idea.tags && idea.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {idea.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle text-muted-foreground">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-[11px]">
                    {idea.status !== 'promoted' ? (
                      <button onClick={() => handlePromoteIdea(idea)} className="text-accent hover:underline font-medium">
                        Promote to Project &rarr;
                      </button>
                    ) : (
                      <span className="text-success font-medium">✓ Promoted</span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingIdea(idea);
                          setIdeaForm({ title: idea.title, content: idea.content, tagsString: idea.tags.join(', ') });
                          setShowIdeaModal(true);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDeleteIdea(idea.id)} className="text-destructive hover:underline">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* MODALS */}
      {/* ========================================== */}

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border p-6 rounded-2xl max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-base font-semibold text-foreground">Add New Goal</h3>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Title</label>
                <Input
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  placeholder="e.g. Master System Design"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Description (Optional)</label>
                <textarea
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  className="w-full text-xs p-2 rounded-xl border border-border bg-surface-subtle text-foreground focus:ring-1 focus:ring-accent"
                  rows={3}
                  placeholder="Why this goal matters..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Category</label>
                  <select
                    value={goalForm.category}
                    onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value as GoalCategory })}
                    className="w-full text-xs p-2 rounded-xl border border-border bg-surface text-foreground"
                  >
                    <option value="career">Career</option>
                    <option value="technical">Technical</option>
                    <option value="academic">Academic</option>
                    <option value="personal">Personal</option>
                    <option value="health">Health</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
                  <select
                    value={goalForm.priority}
                    onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value as 'high' | 'medium' | 'low' })}
                    className="w-full text-xs p-2 rounded-xl border border-border bg-surface text-foreground"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Target Date (Optional)</label>
                <Input
                  type="date"
                  value={goalForm.targetDate}
                  onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowGoalModal(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Create Goal'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border p-6 rounded-2xl max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-base font-semibold text-foreground">Add New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Title</label>
                <Input
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  placeholder="e.g. Distributed Cache in Go"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Description (Optional)</label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  className="w-full text-xs p-2 rounded-xl border border-border bg-surface-subtle text-foreground focus:ring-1 focus:ring-accent"
                  rows={2}
                  placeholder="Scope or deliverables..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Linked Goal (Optional)</label>
                <select
                  value={projectForm.goalId}
                  onChange={(e) => setProjectForm({ ...projectForm, goalId: e.target.value })}
                  className="w-full text-xs p-2 rounded-xl border border-border bg-surface text-foreground"
                >
                  <option value="">-- No Goal Associated --</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowProjectModal(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Create Project'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border p-6 rounded-2xl max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-base font-semibold text-foreground">Add Actionable Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Task Title</label>
                <Input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="e.g. Implement LRU cache eviction logic"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Project (Optional)</label>
                  <select
                    value={taskForm.projectId}
                    onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}
                    className="w-full text-xs p-2 rounded-xl border border-border bg-surface text-foreground"
                  >
                    <option value="">-- Standalone Task --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as PriorityLevel })}
                    className="w-full text-xs p-2 rounded-xl border border-border bg-surface text-foreground"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Due Date (Optional)</label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowTaskModal(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add Task'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Commitment Modal */}
      {showCommitmentModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border p-6 rounded-2xl max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-base font-semibold text-foreground">Schedule Commitment</h3>
            <form onSubmit={handleCreateCommitment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Commitment Title</label>
                <Input
                  value={commitmentForm.title}
                  onChange={(e) => setCommitmentForm({ ...commitmentForm, title: e.target.value })}
                  placeholder="e.g. Mock Interview with Senior Engineer"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Type</label>
                  <select
                    value={commitmentForm.commitmentType}
                    onChange={(e) => setCommitmentForm({ ...commitmentForm, commitmentType: e.target.value as CommitmentType })}
                    className="w-full text-xs p-2 rounded-xl border border-border bg-surface text-foreground"
                  >
                    <option value="interview">Interview</option>
                    <option value="exam">Exam</option>
                    <option value="deadline">Deadline</option>
                    <option value="meeting">Meeting</option>
                    <option value="habit_routine">Habit Routine</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Importance</label>
                  <select
                    value={commitmentForm.importance}
                    onChange={(e) => setCommitmentForm({ ...commitmentForm, importance: e.target.value as CommitmentImportance })}
                    className="w-full text-xs p-2 rounded-xl border border-border bg-surface text-foreground"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="standard">Standard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Date & Time</label>
                <Input
                  type="datetime-local"
                  value={commitmentForm.dueAt}
                  onChange={(e) => setCommitmentForm({ ...commitmentForm, dueAt: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCommitmentModal(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Scheduling...' : 'Save Commitment'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Idea Modal */}
      {showIdeaModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border p-6 rounded-2xl max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              {editingIdea ? 'Edit Idea Spark' : 'Capture Idea Spark'}
            </h3>
            <form onSubmit={handleCreateOrUpdateIdea} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Title</label>
                <Input
                  value={ideaForm.title}
                  onChange={(e) => setIdeaForm({ ...ideaForm, title: e.target.value })}
                  placeholder="e.g. Vector Search Benchmarking in Rust"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Content / Thoughts</label>
                <textarea
                  value={ideaForm.content}
                  onChange={(e) => setIdeaForm({ ...ideaForm, content: e.target.value })}
                  className="w-full text-xs p-2 rounded-xl border border-border bg-surface-subtle text-foreground focus:ring-1 focus:ring-accent"
                  rows={4}
                  placeholder="What is this idea about? Key hypotheses, links, architecture thoughts..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Tags (Comma-separated)</label>
                <Input
                  value={ideaForm.tagsString}
                  onChange={(e) => setIdeaForm({ ...ideaForm, tagsString: e.target.value })}
                  placeholder="rust, algorithms, databases"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowIdeaModal(false); setEditingIdea(null); }}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Idea'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
