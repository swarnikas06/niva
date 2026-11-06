'use client';

import React from 'react';
import { StudyOverviewSummaryDto } from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface StudyOverviewCardProps {
  overview: StudyOverviewSummaryDto | null;
  onStartStudy: () => void;
  onResumeSession?: () => void;
  isLoading?: boolean;
}

export function StudyOverviewCard({
  overview,
  onStartStudy,
  onResumeSession,
  isLoading = false,
}: StudyOverviewCardProps) {
  if (isLoading || !overview) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 animate-pulse space-y-4">
        <div className="h-4 bg-muted rounded-sm w-1/4"></div>
        <div className="h-6 bg-muted rounded-sm w-1/2"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="h-16 bg-muted rounded-lg"></div>
          <div className="h-16 bg-muted rounded-lg"></div>
          <div className="h-16 bg-muted rounded-lg"></div>
          <div className="h-16 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  const hasActiveSession = !!overview.activeSession;

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-5">
      {/* Active Session Recovery Banner */}
      {hasActiveSession && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-xs font-mono uppercase tracking-widest text-primary font-semibold">
                Active Study Session in Progress
              </span>
            </div>
            <p className="text-sm text-foreground font-medium">
              Topic:{' '}
              <span className="font-semibold text-primary">
                {overview.activeSession?.topicTitle || 'Active Topic'}
              </span>{' '}
              <span className="text-muted-foreground font-mono text-xs">({overview.activeSession?.subjectName || 'Study'})</span>
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onResumeSession && (
              <Button size="sm" onClick={onResumeSession} variant="primary">
                Resume Session
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono font-semibold uppercase tracking-widest text-muted-foreground">
              Learning Focus & Knowledge Base
            </span>
            {overview.topicsNeedingReview > 0 && (
              <Badge variant="warning" size="sm">
                {overview.topicsNeedingReview} Need Review
              </Badge>
            )}
            {overview.activeDifficultiesCount > 0 && (
              <Badge variant="danger" size="sm">
                {overview.activeDifficultiesCount} Active Difficulties
              </Badge>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
            {overview.lastStudiedTopic
              ? `Last Studied: ${overview.lastStudiedTopic.title}`
              : 'Study Intelligence & Structured Knowledge'}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Evidence-grounded learning companion. Understand concepts deeply, track active difficulties,
            and connect structured study directly with career requirements.
          </p>
        </div>

        {!hasActiveSession && (
          <Button size="sm" onClick={onStartStudy} variant="primary" className="self-start sm:self-auto">
            <svg
              className="w-3.5 h-3.5 mr-1.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Start Study Session
          </Button>
        )}
      </div>

      {/* Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Topics */}
        <div className="rounded-lg border border-border/80 bg-surface/40 p-3.5 space-y-1">
          <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">Total Topics</span>
          <div className="text-2xl font-bold font-mono text-foreground">{overview.totalTopics}</div>
          <span className="text-2xs font-mono text-muted-foreground block">
            {overview.topicsInProgress} in progress
          </span>
        </div>

        {/* Demonstrated Mastery */}
        <div className="rounded-lg border border-border/80 bg-surface/40 p-3.5 space-y-1">
          <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">Demonstrated</span>
          <div className="text-2xl font-bold font-mono text-success">{overview.topicsDemonstrated}</div>
          <span className="text-2xs font-mono text-muted-foreground block">Verified with evidence</span>
        </div>

        {/* Active Difficulties */}
        <div className="rounded-lg border border-border/80 bg-surface/40 p-3.5 space-y-1">
          <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">Difficulties</span>
          <div className="text-2xl font-bold font-mono text-foreground">
            {overview.activeDifficultiesCount}
          </div>
          <span className="text-2xs font-mono text-muted-foreground block">
            {overview.activeDifficultiesCount > 0 ? 'Targeted revision needed' : 'All clear'}
          </span>
        </div>

        {/* Total Time */}
        <div className="rounded-lg border border-border/80 bg-surface/40 p-3.5 space-y-1">
          <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">Study Logged</span>
          <div className="text-2xl font-bold font-mono text-foreground">
            {Math.round(overview.totalStudyMinutes / 60)}h {overview.totalStudyMinutes % 60}m
          </div>
          <span className="text-2xs font-mono text-muted-foreground block">
            Across {overview.recentSessionsCount} sessions
          </span>
        </div>
      </div>
    </div>
  );
}
