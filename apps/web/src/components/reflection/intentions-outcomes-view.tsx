'use client';

import React from 'react';
import { IntentionOutcomeComparisonDto } from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';

interface IntentionsOutcomesViewProps {
  comparisons: IntentionOutcomeComparisonDto[];
  isLoading?: boolean;
}

export function IntentionsOutcomesView({
  comparisons,
  isLoading = false,
}: IntentionsOutcomesViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card p-5 animate-pulse"></div>
        ))}
      </div>
    );
  }

  const getOutcomeBadge = (outcome: IntentionOutcomeComparisonDto['outcome']) => {
    switch (outcome) {
      case 'completed':
        return <Badge variant="success" size="sm">Completed</Badge>;
      case 'postponed':
        return <Badge variant="warning" size="sm">Postponed</Badge>;
      case 'missed':
        return <Badge variant="danger" size="sm">Overdue / Missed</Badge>;
      default:
        return <Badge variant="neutral" size="sm">Unresolved</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-border bg-card space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          Intentions vs. Recorded Outcomes
        </h3>
        <p className="text-xs text-muted-foreground">
          An objective look at stated plans across tasks and personal commitments compared to
          actual follow-through. Helping you observe follow-through patterns without judgement.
        </p>
      </div>

      {comparisons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">No intention records in this window</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Create tasks or commitments in Life Context to track your execution follow-through.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="divide-y divide-border text-xs">
            {comparisons.map((item) => (
              <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/10 transition">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">
                      {item.intention}
                    </span>
                    <Badge variant="outline" size="sm">
                      {item.sourceEntity === 'life_task' ? 'Life Task' : 'Commitment'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {item.evidenceSnippet}
                  </p>
                </div>

                <div className="flex items-center gap-4 self-start sm:self-auto shrink-0">
                  <div className="text-right text-[11px] text-muted-foreground">
                    <div>Stated: {new Date(item.statedAt).toLocaleDateString()}</div>
                    {item.recordedAt && (
                      <div>Resolved: {new Date(item.recordedAt).toLocaleDateString()}</div>
                    )}
                  </div>
                  {getOutcomeBadge(item.outcome)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
