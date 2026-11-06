'use client';

import React, { useEffect } from 'react';
import {
  MockEvaluationSessionDto,
  EvaluationDimensionRating,
  EvaluationStructuredDimension,
} from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SessionReviewModalProps {
  session: MockEvaluationSessionDto | null;
  isOpen: boolean;
  onClose: () => void;
  onResumeSession?: (sessionId: string) => void;
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

const DIMENSION_LABELS: Record<string, string> = {
  technical_correctness: 'Technical Correctness',
  reasoning: 'Reasoning & Logic',
  communication: 'Communication & Clarity',
  depth: 'Depth & Nuance',
  completeness: 'Completeness',
};

export function SessionReviewModal({
  session,
  isOpen,
  onClose,
  onResumeSession,
}: SessionReviewModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !session) return null;

  const isCompleted = session.status === 'completed';
  const isInProgress = session.status === 'in_progress';
  const ratingInfo = session.overallRating
    ? RATING_VARIANT[session.overallRating]
    : { label: 'Not Rated', variant: 'default' as const };

  const questions = session.questions || [];

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-review-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative bg-surface border border-border w-full max-w-2xl rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6 animate-in zoom-in-95 duration-150 z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-border">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" size="sm" className="uppercase">
                {session.evaluationType.replace(/_/g, ' ')}
              </Badge>
              <Badge variant={session.status === 'completed' ? 'success' : session.status === 'abandoned' ? 'default' : 'presence'} size="sm">
                {session.status.replace(/_/g, ' ')}
              </Badge>
              {session.overallRating && (
                <Badge variant={ratingInfo.variant} size="sm">
                  {ratingInfo.label}
                </Badge>
              )}
            </div>

            <h3 id="session-review-title" className="text-xl font-semibold text-foreground">
              {session.targetRoleTitle}
              {session.skillName && (
                <span className="text-muted-foreground font-normal"> · {session.skillName}</span>
              )}
            </h3>

            <p className="text-xs text-muted-foreground">
              Conducted on{' '}
              {new Date(session.startedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-medium p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Overall Score & Companion Summary */}
        {isCompleted && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Overall Evaluation Outcome
              </span>
              {session.overallScore !== null && (
                <span className="text-xl font-bold text-foreground">
                  {session.overallScore} / 100
                </span>
              )}
            </div>

            {session.summary && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {session.summary}
              </p>
            )}
          </div>
        )}

        {/* In-Progress Resume Action */}
        {isInProgress && onResumeSession && (
          <div className="rounded-xl border border-presence/30 bg-presence/5 p-4 flex items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-semibold text-foreground">Session is currently in progress</p>
              <p className="text-muted-foreground">
                Question {session.currentQuestionIndex} of {session.totalPlannedQuestions}
              </p>
            </div>
            <Button size="sm" onClick={() => onResumeSession(session.id)}>
              Resume Round
            </Button>
          </div>
        )}

        {/* Questions and Answers Breakdown */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground">
            Interview Turns & Dimension Rubric ({questions.length})
          </h4>

          {questions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No questions recorded in this session.</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const answer = q.answer;
                const evaluation = answer?.evaluation;
                const dimensions = evaluation?.dimensions || [];

                return (
                  <div
                    key={q.id || idx}
                    className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3 text-xs shadow-2xs"
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/40">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Question {q.sequenceNumber} · {q.targetedSkill}
                        </span>
                        <p className="font-medium text-foreground text-sm leading-snug">
                          {q.questionText}
                        </p>
                      </div>
                      <Badge variant="default" size="sm" className="shrink-0 capitalize">
                        {q.difficulty}
                      </Badge>
                    </div>

                    {/* Candidate Answer */}
                    {answer ? (
                      <div className="space-y-1.5 bg-surface/50 p-3 rounded-lg border border-border/50">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Your Submitted Answer
                        </span>
                        <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {answer.answerText}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Not answered yet.
                      </p>
                    )}

                    {/* Structured Rubric Evaluation */}
                    {evaluation && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            5-Dimension Rubric Evaluation
                          </span>
                          {answer?.overallRating && (
                            <Badge
                              variant={RATING_VARIANT[answer.overallRating as EvaluationDimensionRating]?.variant || 'default'}
                              size="sm"
                            >
                              {answer.overallRating}
                            </Badge>
                          )}
                        </div>

                        {/* Dimensions Grid */}
                        <div className="grid grid-cols-1 gap-2">
                          {dimensions.map((dim: EvaluationStructuredDimension) => {
                            const dimVariant = RATING_VARIANT[dim.rating] || {
                              label: dim.rating,
                              variant: 'default' as const,
                            };

                            return (
                              <div
                                key={dim.dimension}
                                className="p-2.5 rounded-lg bg-surface/40 border border-border/40 space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-foreground text-[11px]">
                                    {DIMENSION_LABELS[dim.dimension] || dim.dimension}
                                  </span>
                                  <Badge variant={dimVariant.variant} size="sm">
                                    {dim.rating}
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground text-[11px] leading-relaxed">
                                  {dim.feedback}
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Strengths & Improvements */}
                        {(evaluation.strengths?.length > 0 || evaluation.gaps?.length > 0) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                            {evaluation.strengths?.length > 0 && (
                              <div className="p-2.5 rounded-lg bg-success/5 border border-success/20 space-y-1">
                                <span className="font-semibold text-success block">Strengths</span>
                                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                                  {evaluation.strengths.map((s, i) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {evaluation.gaps?.length > 0 && (
                              <div className="p-2.5 rounded-lg bg-warning/5 border border-warning/20 space-y-1">
                                <span className="font-semibold text-warning block">Areas for Growth</span>
                                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                                  {evaluation.gaps.map((g, i) => (
                                    <li key={i}>{g}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Review
          </Button>
        </div>
      </div>
    </div>
  );
}
