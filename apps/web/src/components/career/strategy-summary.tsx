'use client';

import React, { useState } from 'react';
import {
  CareerPlacementStrategyDto,
  PlacementStrategyItemDto,
  PlacementPriorityLevel,
} from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface StrategySummaryProps {
  strategy: CareerPlacementStrategyDto;
  onStartMock: (skillId?: string, difficulty?: string) => void;
  onAddLifeTask?: (item: PlacementStrategyItemDto) => Promise<void>;
  isStartingMock?: boolean;
}

const PRIORITY_BADGE_VARIANT: Record<
  PlacementPriorityLevel,
  'danger' | 'warning' | 'presence' | 'default'
> = {
  critical: 'danger',
  high: 'warning',
  medium: 'presence',
  low: 'default',
};

export function StrategySummary({
  strategy,
  onStartMock,
  onAddLifeTask,
  isStartingMock = false,
}: StrategySummaryProps) {
  const { targetRole, currentFocus, rationale, priorities, readinessDiscrepancy, suggestedMockSession } =
    strategy;

  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);

  const handleCreateTask = async (item: PlacementStrategyItemDto) => {
    if (!onAddLifeTask) return;
    setAddingTaskId(item.skillId);
    try {
      await onAddLifeTask(item);
    } finally {
      setAddingTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Target Role & Strategic Focus Header */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Target Role Benchmark
            </span>
            <h2 className="text-xl font-semibold text-foreground mt-0.5">
              {targetRole?.title || 'No Target Role Specified'}
            </h2>
          </div>
          {readinessDiscrepancy !== 'aligned' && readinessDiscrepancy !== 'unassessed' && (
            <Badge
              variant={readinessDiscrepancy === 'overconfident' ? 'warning' : 'presence'}
              className="self-start sm:self-auto capitalize"
            >
              {readinessDiscrepancy === 'overconfident' ? 'Evidence Gap Detected' : 'Confidence Gap Detected'}
            </Badge>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-lg bg-surface/50 border border-border/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">
              Immediate Priority
            </span>
            <p className="text-sm font-medium text-foreground mt-1">
              {currentFocus}
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-surface/50 border border-border/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Strategic Rationale
            </span>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {rationale}
            </p>
          </div>
        </div>

        {/* Suggested Mock Round Banner */}
        {suggestedMockSession && (
          <div className="mt-5 p-4 rounded-lg bg-accent/5 border border-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  NIVA Recommended Practice
                </span>
              </div>
              <p className="text-sm text-foreground">
                <span className="font-semibold">{suggestedMockSession.skillName}</span> — {suggestedMockSession.reason}
              </p>
            </div>
            <Button
              onClick={() => onStartMock(suggestedMockSession.skillId, suggestedMockSession.suggestedDifficulty)}
              disabled={isStartingMock}
              size="sm"
              className="shrink-0"
            >
              {isStartingMock ? 'Preparing Session...' : 'Start Mock Round'}
            </Button>
          </div>
        )}
      </div>

      {/* 2. Prioritized Actionable Recommendations (WHAT, WHY, NEXT) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">
            What to Focus on Next
          </h3>
          <span className="text-xs text-muted-foreground">
            Ranked by target role impact and evidence depth
          </span>
        </div>

        {priorities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
            All core benchmark requirements have verified evidence artifacts. Conduct comprehensive mock interviews to maintain peak readiness.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {priorities.map((item: PlacementStrategyItemDto, idx: number) => {
              const priorityVariant = PRIORITY_BADGE_VARIANT[item.priority] || 'default';
              const hasLinkedTasks = item.linkedLifeTasks && item.linkedLifeTasks.length > 0;
              const isAddingThisTask = addingTaskId === item.skillId;

              return (
                <div
                  key={item.skillId || idx}
                  className="rounded-xl border border-border bg-card p-4 sm:p-5 hover:border-border/80 transition-colors shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">
                          #{idx + 1}
                        </span>
                        <h4 className="text-base font-semibold text-foreground">
                          {item.skillName}
                        </h4>
                        <Badge variant={priorityVariant} size="sm" className="uppercase">
                          {item.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Requires: {item.requiredProficiency} (Current: {item.currentProficiency})
                        </span>
                      </div>

                      {/* WHAT */}
                      <div className="text-sm text-foreground">
                        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider block sm:inline sm:mr-2">
                          Focus:
                        </span>
                        {item.action}
                      </div>

                      {/* WHY */}
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium uppercase tracking-wider mr-1.5">
                          Why:
                        </span>
                        {item.reason}
                      </div>

                      {/* NEXT */}
                      <div className="text-xs text-accent">
                        <span className="font-medium uppercase tracking-wider mr-1.5 text-muted-foreground">
                          Next Step:
                        </span>
                        {item.recommendedActivity.replace(/_/g, ' ')}
                      </div>

                      {/* Linked Life Context Tasks (Integrated without duplication) */}
                      {hasLinkedTasks ? (
                        <div className="mt-2 pt-2 border-t border-border/40">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                            Operational Life Context Tasks:
                          </span>
                          <div className="space-y-1">
                            {item.linkedLifeTasks.map((t) => (
                              <div
                                key={t.id}
                                className="text-xs text-foreground/80 flex items-center gap-2 bg-surface/40 px-2.5 py-1 rounded-md"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-accent/60" />
                                <span className="truncate">{t.title}</span>
                                <Badge variant="default" size="sm" className="ml-auto text-[10px]">
                                  {t.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        onAddLifeTask && (
                          <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground italic">
                              Not tracked in Life Context yet.
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCreateTask(item)}
                              disabled={isAddingThisTask}
                              className="text-xs text-accent hover:underline font-medium flex items-center gap-1"
                            >
                              <span>+ Add to Life Tasks</span>
                              {isAddingThisTask && <span className="animate-spin">⏳</span>}
                            </button>
                          </div>
                        )
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onStartMock(item.skillId, item.currentProficiency === 'none' ? 'foundation' : 'intermediate')}
                        disabled={isStartingMock}
                      >
                        Practice Topic
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
