'use client';

import React, { useState } from 'react';
import {
  MockEvaluationSessionDto,
  EvaluationDimensionRating,
} from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/auth-client';
import { SessionReviewModal } from './session-review-modal';

interface EvaluationHistoryViewProps {
  sessions: MockEvaluationSessionDto[];
  onResumeSession: (sessionId: string) => void;
  onStartNewMock: () => void;
  onRefresh: () => void;
}

const RATING_VARIANT: Record<
  EvaluationDimensionRating,
  { label: string; variant: 'success' | 'presence' | 'warning' | 'danger' }
> = {
  strong: { label: 'Strong', variant: 'success' },
  adequate: { label: 'Adequate', variant: 'presence' },
  developing: { label: 'Developing', variant: 'warning' },
  insufficient: { label: 'Insufficient', variant: 'danger' },
};

export function EvaluationHistoryView({
  sessions,
  onResumeSession,
  onStartNewMock,
  onRefresh,
}: EvaluationHistoryViewProps) {
  const [selectedSession, setSelectedSession] = useState<MockEvaluationSessionDto | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleInspectSession = async (session: MockEvaluationSessionDto) => {
    setIsLoadingSession(true);
    setError(null);
    try {
      // Fetch full session details with questions and answers
      const full = await authFetch<MockEvaluationSessionDto>(
        `/career/evaluations/sessions/${session.id}`,
      );
      setSelectedSession(full);
    } catch (err: any) {
      setError(err.message || 'Failed to load session details.');
    } finally {
      setIsLoadingSession(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Mock Practice & Evaluation History ({sessions.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record of completed and in-progress technical rounds with verified dimension scores.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
          <Button size="sm" onClick={onStartNewMock}>
            + Start Practice Round
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs bg-danger/10 border border-danger/30 text-danger rounded-lg">
          {error}
        </div>
      )}

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full bg-surface border border-border flex items-center justify-center text-muted-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p>No evaluation rounds conducted yet.</p>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            Interactive mock interviews evaluate your depth, communication, and system reasoning while producing verified proof points for your profile.
          </p>
          <Button size="sm" onClick={onStartNewMock}>
            Conduct First Mock Round
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {sessions.map((session) => {
            const isCompleted = session.status === 'completed';
            const isInProgress = session.status === 'in_progress';
            const isAbandoned = session.status === 'abandoned';
            const ratingInfo = session.overallRating
              ? RATING_VARIANT[session.overallRating]
              : { label: 'Not Rated', variant: 'default' as const };

            return (
              <div
                key={session.id}
                className="rounded-xl border border-border bg-card p-4 sm:p-5 hover:border-border/80 transition-colors shadow-2xs space-y-3 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {session.targetRoleTitle}
                        {session.skillName && (
                          <span className="text-muted-foreground font-normal">
                            {' '}· {session.skillName}
                          </span>
                        )}
                      </span>
                      <Badge variant="default" size="sm" className="capitalize">
                        {session.evaluationType.replace(/_/g, ' ')}
                      </Badge>
                      <Badge
                        variant={isCompleted ? 'success' : isAbandoned ? 'default' : 'presence'}
                        size="sm"
                      >
                        {session.status.replace(/_/g, ' ')}
                      </Badge>
                      {session.overallRating && (
                        <Badge variant={ratingInfo.variant} size="sm">
                          {ratingInfo.label}
                        </Badge>
                      )}
                    </div>

                    {session.summary ? (
                      <p className="text-muted-foreground leading-relaxed line-clamp-2">
                        {session.summary}
                      </p>
                    ) : (
                      <p className="text-muted-foreground italic">
                        {isInProgress
                          ? `In progress · Question ${session.currentQuestionIndex} of ${session.totalPlannedQuestions}`
                          : 'Round abandoned before completion.'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    {isInProgress && (
                      <Button
                        size="sm"
                        onClick={() => onResumeSession(session.id)}
                      >
                        Resume Round
                      </Button>
                    )}

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleInspectSession(session)}
                      disabled={isLoadingSession}
                    >
                      Inspect Rubric
                    </Button>
                  </div>
                </div>

                {/* Footer metadata */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span>
                      Date:{' '}
                      {new Date(session.startedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span>Difficulty: <strong className="capitalize text-foreground">{session.currentDifficulty}</strong></span>
                  </div>

                  {session.overallScore !== null && (
                    <span className="font-semibold text-foreground">
                      Demonstrated Score: {session.overallScore} / 100
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selectedSession && (
        <SessionReviewModal
          isOpen={Boolean(selectedSession)}
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onResumeSession={(id) => {
            setSelectedSession(null);
            onResumeSession(id);
          }}
        />
      )}
    </div>
  );
}
