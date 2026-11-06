'use client';

import React from 'react';
import { ReflectionOverviewDto } from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ReflectionOverviewCardProps {
  overview: ReflectionOverviewDto | null;
  selectedWindowDays: number;
  onWindowChange: (days: number) => void;
  onGenerateReflection: () => void;
  isGenerating?: boolean;
  isLoading?: boolean;
}

export function ReflectionOverviewCard({
  overview,
  selectedWindowDays,
  onWindowChange,
  onGenerateReflection,
  isGenerating = false,
  isLoading = false,
}: ReflectionOverviewCardProps) {
  if (isLoading || !overview) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 animate-pulse space-y-4">
        <div className="h-4 bg-muted rounded-sm w-1/4"></div>
        <div className="h-6 bg-muted rounded-sm w-1/2"></div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  const windowOptions = [7, 14, 30];

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Longitudinal Intelligence Window
            </span>
            <Badge variant="outline" size="sm">
              Last {selectedWindowDays} Days
            </Badge>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif tracking-tight text-foreground">
            Reflective Synthesis & Patterns
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
            Objective developments across conversations, commitments, and learning over time.
            Observations separate observable facts from calibrated interpretations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Window Picker */}
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-xs font-mono">
            {windowOptions.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onWindowChange(days)}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedWindowDays === days
                    ? 'bg-primary text-white shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>

          <Button
            size="sm"
            onClick={onGenerateReflection}
            disabled={isGenerating}
            variant="primary"
          >
            {isGenerating ? (
              <>
                <svg
                  className="animate-spin -ml-0.5 mr-2 h-3.5 w-3.5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Synthesizing...
              </>
            ) : (
              'Synthesize Patterns'
            )}
          </Button>
        </div>
      </div>

      {/* Summary KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-border/80 bg-surface/40">
          <span className="text-2xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
            Active Patterns
          </span>
          <p className="text-2xl font-bold font-mono text-foreground mt-0.5">
            {overview.activeObservationsCount}
          </p>
          <span className="text-2xs font-mono text-muted-foreground">In current horizon</span>
        </div>

        <div className="p-3.5 rounded-xl border border-brand-indigo/30 bg-brand-indigo/5">
          <span className="text-2xs font-mono font-medium text-brand-indigo uppercase tracking-wider">
            Confirmed Insights
          </span>
          <p className="text-2xl font-bold font-mono text-brand-indigo mt-0.5">
            {overview.confirmedObservationsCount}
          </p>
          <span className="text-2xs font-mono text-brand-indigo/80">Verified by you</span>
        </div>

        <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5">
          <span className="text-2xs font-mono font-medium text-primary uppercase tracking-wider">
            User Corrections
          </span>
          <p className="text-2xl font-bold font-mono text-primary mt-0.5">
            {overview.correctedObservationsCount}
          </p>
          <span className="text-2xs font-mono text-primary/80">NIVA avoids repeating</span>
        </div>

        <div className="p-3.5 rounded-xl border border-border/80 bg-surface/40">
          <span className="text-2xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
            Dismissed
          </span>
          <p className="text-2xl font-bold font-mono text-foreground mt-0.5">
            {overview.dismissedObservationsCount}
          </p>
          <span className="text-2xs font-mono text-muted-foreground">Excluded from grounding</span>
        </div>

        <div className="p-3.5 rounded-lg border border-orange-500/20 bg-orange-500/5">
          <span className="text-[11px] font-medium text-orange-700 dark:text-orange-400 uppercase tracking-wide">
            Open Threads
          </span>
          <p className="text-2xl font-bold text-orange-800 dark:text-orange-300 mt-0.5">
            {overview.unresolvedThreads.length}
          </p>
          <span className="text-[11px] text-orange-600/80 dark:text-orange-400/70">Awaiting resolution</span>
        </div>
      </div>

      {/* Highlights: Recent Progress & Unresolved Threads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Progress Observed */}
        <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Recent Observable Progress
            </span>
            <span className="text-xs text-muted-foreground">
              {overview.recentProgress.length} items
            </span>
          </div>

          {overview.recentProgress.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              No completed sessions or fulfilled commitments recorded in this window yet.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs text-foreground">
              {overview.recentProgress.slice(0, 4).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5 font-bold">✓</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Unresolved Threads */}
        <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
              Unresolved Learning & Task Threads
            </span>
            <span className="text-xs text-muted-foreground">
              {overview.unresolvedThreads.length} items
            </span>
          </div>

          {overview.unresolvedThreads.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              No lingering learning difficulties or overdue tasks detected.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs text-foreground">
              {overview.unresolvedThreads.slice(0, 4).map((thread, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 font-bold">◷</span>
                  <span className="leading-relaxed">{thread}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
