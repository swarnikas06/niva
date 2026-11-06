'use client';

import React, { useState } from 'react';
import { StudyRecommendationDto } from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface StudyRecommendationsViewProps {
  recommendations: StudyRecommendationDto[];
  onStartStudy: (topicId: string) => void;
  onAddToLifeTasks: (rec: StudyRecommendationDto) => Promise<void>;
  isLoading?: boolean;
}

const DEFAULT_BADGE = { label: 'Routine Study', variant: 'default' as const };

const PRIORITY_BADGE_STYLE: Record<
  string,
  { label: string; variant: 'danger' | 'warning' | 'presence' | 'default' }
> = {
  critical: { label: 'Critical Revision', variant: 'danger' },
  high: { label: 'High Priority', variant: 'warning' },
  medium: { label: 'Medium Priority', variant: 'presence' },
  routine: { label: 'Routine Study', variant: 'default' },
};

export function StudyRecommendationsView({
  recommendations,
  onStartStudy,
  onAddToLifeTasks,
}: StudyRecommendationsViewProps) {
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);

  const handleAddLifeTask = async (rec: StudyRecommendationDto) => {
    try {
      setAddingTaskId(rec.topicId);
      await onAddToLifeTasks(rec);
    } finally {
      setAddingTaskId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Recommended Next Study Steps
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deterministic, explainable next actions prioritized by active difficulties, retention decay, and career requirements.
          </p>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            No study recommendations at this moment. You are caught up on active topics!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => {
            const badge = PRIORITY_BADGE_STYLE[rec.priority] ?? DEFAULT_BADGE;
            const isAdding = addingTaskId === rec.topicId;

            return (
              <div
                key={rec.topicId}
                className="rounded-xl border border-border bg-card p-4 sm:p-5 hover:border-border/80 transition-colors shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-foreground">
                        {rec.topicTitle}
                      </h4>
                      <Badge variant={badge.variant} size="sm">
                        {badge.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium">
                        {rec.subjectName}
                      </span>
                      <Badge variant="outline" size="sm" className="capitalize font-mono">
                        {rec.recommendedSessionType.replace('_', ' ')} · ~{rec.estimatedMinutes}m
                      </Badge>
                    </div>

                    <div className="space-y-0.5 pt-0.5">
                      <p className="text-xs text-foreground font-medium">
                        {rec.what}
                      </p>
                      <p className="text-2xs text-muted-foreground leading-relaxed">
                        💡 {rec.why}
                      </p>
                    </div>

                    {rec.unmetPrerequisites && rec.unmetPrerequisites.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-2xs text-warning font-semibold uppercase">
                          Prerequisites to study first:
                        </span>
                        {rec.unmetPrerequisites.map((p, idx) => (
                          <Badge key={idx} variant="warning" size="sm">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => onStartStudy(rec.topicId)}
                    >
                      Study Now
                    </Button>

                    {rec.linkedLifeTasks && rec.linkedLifeTasks.length > 0 ? (
                      <Badge variant="default" size="sm">
                        ✓ In Life Tasks
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAddLifeTask(rec)}
                        isLoading={isAdding}
                        title="Add this recommended study session directly to your Life Context Tasks"
                      >
                        + Add to Tasks
                      </Button>
                    )}
                  </div>
                </div>

                {/* Career Skill Linkage */}
                {rec.linkedCareerSkillName && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 text-2xs text-muted-foreground border-t border-border/40">
                    <span className="inline-flex items-center gap-1 text-presence font-medium">
                      🎯 Aligns with Career Skill: {rec.linkedCareerSkillName}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
