'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import type { TaskDto, CommitmentDto } from '@niva/shared-types';

export function QuickTasksPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [commitments, setCommitments] = useState<CommitmentDto[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const [tasksRes, commitmentsRes] = await Promise.all([
        authFetch<TaskDto[]>('/life/tasks?status=todo'),
        authFetch<CommitmentDto[]>('/life/commitments'),
      ]);
      setTasks(tasksRes || []);
      setCommitments((commitmentsRes || []).filter((c) => c.status === 'upcoming').slice(0, 4));
    } catch {
      // Graceful fallback for offline / unauth
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleTask = async (task: TaskDto) => {
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    // Optimistic update
    setTasks((prev) => prev.filter((t) => t.id !== task.id));

    try {
      await authFetch(`/life/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch {
      // Revert on failure
      setTasks((prev) => [task, ...prev]);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await authFetch<TaskDto>('/life/tasks', {
        method: 'POST',
        body: JSON.stringify({ title, priority: 'medium' }),
      });
      if (created) {
        setTasks((prev) => [created, ...prev]);
        setNewTaskTitle('');
      }
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = tasks.length;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Header Button Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition-colors',
          isOpen
            ? 'bg-primary/20 border-primary text-primary shadow-subtle'
            : 'bg-surface-muted border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover',
        )}
        title="Quick Tasks & Commitments"
        aria-label="Quick Tasks & Commitments"
        aria-expanded={isOpen}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="hidden sm:inline uppercase text-[10px] tracking-wider font-semibold">Tasks</span>
        {pendingCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-primary text-primary-foreground">
            {pendingCount}
          </span>
        )}
      </button>

      {/* Popover Flyout */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-surface shadow-surface z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="p-3 border-b border-border flex items-center justify-between bg-surface-muted/60">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-foreground">
                Tasks & Commitments
              </span>
            </div>
            <Link
              href="/life"
              onClick={() => setIsOpen(false)}
              className="text-[10px] font-mono text-primary hover:underline uppercase tracking-wide font-semibold"
            >
              Open Life →
            </Link>
          </div>

          {/* Quick Add Input */}
          <form onSubmit={handleCreateTask} className="p-2.5 border-b border-border bg-surface">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="+ Add task and press Enter..."
                disabled={isSubmitting}
                className="flex-1 text-xs rounded-lg border border-border bg-surface-muted/50 px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-sans"
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim() || isSubmitting}
                className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider disabled:opacity-40 transition-opacity"
              >
                Add
              </button>
            </div>
          </form>

          {/* Task Items */}
          <div className="max-h-72 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              <div className="p-6 text-center text-xs font-mono text-muted-foreground">
                Loading tasks...
              </div>
            ) : tasks.length === 0 && commitments.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">All caught up!</p>
                <p className="text-[11px]">No pending tasks or commitments due today.</p>
              </div>
            ) : (
              <>
                {tasks.length > 0 && (
                  <div className="space-y-1 mb-2">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground px-2 py-0.5 block">
                      Active Tasks ({tasks.length})
                    </span>
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => handleToggleTask(task)}
                        className="group flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface-hover cursor-pointer border border-transparent hover:border-border transition-colors select-none"
                      >
                        <div className="mt-0.5 w-4 h-4 rounded border border-muted-foreground/50 group-hover:border-primary flex items-center justify-center shrink-0">
                          {task.status === 'completed' && (
                            <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground font-medium leading-tight truncate">
                            {task.title}
                          </p>
                          {task.dueDate && (
                            <span className="text-[9px] font-mono text-muted-foreground block mt-0.5">
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {task.priority === 'urgent' || task.priority === 'high' ? (
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-danger/10 text-danger border border-danger/20 shrink-0">
                            {task.priority}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {commitments.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border-subtle">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground px-2 py-0.5 block">
                      Upcoming Commitments ({commitments.length})
                    </span>
                    {commitments.map((cmt) => (
                      <div
                        key={cmt.id}
                        className="flex items-start gap-2.5 p-2 rounded-lg bg-surface-muted/30 border border-border/50 select-none"
                      >
                        <span className="text-xs mt-0.5">📅</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground font-medium leading-tight truncate">
                            {cmt.title}
                          </p>
                          <span className="text-[9px] font-mono text-primary block mt-0.5">
                            {new Date(cmt.dueAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-surface-muted border border-border text-muted-foreground shrink-0">
                          {cmt.commitmentType}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
