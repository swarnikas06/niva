'use client';

import React, { useState } from 'react';
import {
  MockEvaluationSessionDto,
  EvaluationDimensionRating,
  EvaluationDifficulty,
} from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface MockInterviewSessionProps {
  session: MockEvaluationSessionDto;
  onSubmitAnswer: (sessionId: string, answerText: string) => Promise<void>;
  onCancelSession: (sessionId: string) => Promise<void>;
  onDone: () => void;
  isSubmitting?: boolean;
}

const RATING_VARIANT: Record<
  EvaluationDimensionRating,
  'success' | 'default' | 'warning' | 'danger'
> = {
  strong: 'success',
  adequate: 'default',
  developing: 'warning',
  insufficient: 'danger',
};

const DIFFICULTY_VARIANT: Record<EvaluationDifficulty, 'default' | 'presence' | 'warning'> = {
  foundation: 'default',
  intermediate: 'presence',
  advanced: 'warning',
};

export function MockInterviewSession({
  session,
  onSubmitAnswer,
  onCancelSession,
  onDone,
  isSubmitting = false,
}: MockInterviewSessionProps) {
  const [answerText, setAnswerText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const questions = session.questions || [];
  // Find current active unanswered question
  const currentQuestion = questions.find((q) => !q.answer);
  // Find the most recently answered question for displaying immediate feedback
  const lastAnsweredQuestion = [...questions].reverse().find((q) => q.answer);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerText.trim()) {
      setLocalError('Please write your response before submitting to NIVA.');
      return;
    }
    setLocalError(null);
    try {
      await onSubmitAnswer(session.id, answerText.trim());
      setAnswerText('');
    } catch (err: any) {
      setLocalError(err.message || 'Failed to submit answer. Please try again.');
    }
  };

  const isCompleted = session.status === 'completed';
  const currentQNum = (session.currentQuestionIndex ?? 0) + 1;
  const totalQNum = session.totalPlannedQuestions || 1;

  return (
    <div className="space-y-6">
      {/* 1. Session Status Bar */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">
                MOCK TECHNICAL ROUND — IN SESSION WITH NIVA
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground uppercase tracking-tight mt-1">
              {session.targetRoleTitle}
              {session.skillName && (
                <span className="text-muted-foreground font-normal">
                  {' '}· {session.skillName}
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto font-mono">
            <Badge variant={DIFFICULTY_VARIANT[session.currentDifficulty] || 'default'}>
              {session.currentDifficulty}
            </Badge>
            <Badge variant="default">
              Question {Math.min(currentQNum, totalQNum)} of {totalQNum}
            </Badge>
          </div>
        </div>

        {/* NIVA Companion Voice */}
        <div className="mt-3.5 flex items-start gap-3 text-xs text-muted-foreground bg-surface-muted/60 p-3 rounded-lg border border-border">
          <div className="w-6 h-6 rounded-md bg-[#111606] border border-primary/30 text-primary flex items-center justify-center font-bold text-xs shrink-0 font-mono">
            N
          </div>
          <div>
            <span className="font-bold text-foreground mr-1">NIVA:</span>
            {isCompleted ? (
              <span>Session complete. Review your structured evaluation breakdown and newly validated evidence below.</span>
            ) : currentQuestion ? (
              <span>
                Take your time to articulate your architectural choices, concrete trade-offs, and failure edge cases. I'll evaluate your response across technical correctness, reasoning, and depth.
              </span>
            ) : (
              <span>Reviewing your response...</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Session Completed View */}
      {isCompleted ? (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-subtle space-y-6">
          <div className="text-center py-4 space-y-2">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>
            <h3 className="text-xl font-bold text-foreground uppercase tracking-tight">
              Mock Technical Session Complete
            </h3>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
              {session.summary}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-surface-muted/60 border border-border text-center">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                Demonstrated Rating
              </span>
              <div className="mt-1">
                <Badge
                  variant={RATING_VARIANT[session.overallRating || 'adequate']}
                  size="md"
                  className="uppercase text-xs font-bold"
                >
                  {session.overallRating}
                </Badge>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-surface-muted/60 border border-border text-center">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                Readiness Score
              </span>
              <p className="text-2xl font-bold text-foreground mt-0.5 font-mono">
                {session.overallScore !== null ? `${session.overallScore}/100` : 'Evaluated'}
              </p>
            </div>
          </div>

          {/* Evidence update notice */}
          {(session.overallRating === 'strong' || session.overallRating === 'adequate') && (
            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-foreground flex items-center gap-3">
              <span className="text-emerald-500 text-lg font-bold">✦</span>
              <div>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">
                  Evidence Artifact Logged & Validated by NIVA:
                </span>{' '}
                Your demonstrated proficiency has been recorded in your persistent Career Evidence base, contributing to your real-time readiness benchmark.
              </div>
            </div>
          )}

          {/* Question Breakdown History */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h4 className="text-sm font-bold text-foreground uppercase tracking-tight">
              Turn-by-Turn Evaluations
            </h4>
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="p-4 rounded-lg bg-surface-muted/40 border border-border space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">
                    Question #{idx + 1}: {q.targetedSkill}
                  </span>
                  {q.answer?.overallRating && (
                    <Badge variant={RATING_VARIANT[q.answer.overallRating]}>
                      {q.answer.overallRating}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{q.questionText}</p>
                {q.answer?.answerText && (
                  <div className="p-2.5 rounded bg-surface border border-border text-foreground/90 italic">
                    "{q.answer.answerText}"
                  </div>
                )}
                {q.answer?.evaluation?.feedbackNotes && (
                  <div className="text-muted-foreground">
                    <span className="font-bold text-foreground mr-1">Feedback:</span>
                    {q.answer.evaluation.feedbackNotes}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={onDone} variant="primary" className="w-full sm:w-auto font-bold uppercase tracking-wider">
              Return to Placement Strategy
            </Button>
          </div>
        </div>
      ) : (
        /* 3. In-Progress Question & Answer View */
        <div className="space-y-6">
          {/* Active Question Card */}
          {currentQuestion && (
            <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">
                  Active Question #{currentQuestion.sequenceNumber}
                </span>
                <Badge variant={DIFFICULTY_VARIANT[currentQuestion.difficulty]}>
                  {currentQuestion.difficulty}
                </Badge>
              </div>

              <div className="text-base sm:text-lg font-medium text-foreground leading-relaxed">
                {currentQuestion.questionText}
              </div>

              {currentQuestion.contextRationale && (
                <div className="text-xs text-muted-foreground italic border-t border-border pt-2">
                  Objective: {currentQuestion.contextRationale}
                </div>
              )}

              {/* Answer submission form */}
              <form onSubmit={handleSubmit} className="space-y-3 pt-2">
                <label
                  htmlFor="user-answer"
                  className="block text-xs font-bold uppercase tracking-wider text-foreground"
                >
                  Your Response
                </label>
                <textarea
                  id="user-answer"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Explain your approach, architectural trade-offs, and failure handling..."
                  rows={6}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-border bg-surface-muted/40 p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y font-sans transition-all"
                />

                {localError && (
                  <p className="text-xs text-danger font-medium">{localError}</p>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancelSession(session.id)}
                    disabled={isSubmitting}
                    className="text-muted-foreground hover:text-foreground order-2 sm:order-1"
                  >
                    Pause or Abandon Round
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting || !answerText.trim()}
                    className="order-1 sm:order-2 w-full sm:w-auto font-bold uppercase tracking-wider text-xs"
                  >
                    {isSubmitting ? 'Evaluating Response...' : 'Submit to NIVA'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Feedback from Last Answered Question (if available) */}
          {lastAnsweredQuestion?.answer?.evaluation && (
            <div className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-subtle">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                  NIVA Evaluation — Question #{lastAnsweredQuestion.sequenceNumber} ({lastAnsweredQuestion.targetedSkill})
                </span>
                <Badge
                  variant={RATING_VARIANT[lastAnsweredQuestion.answer.overallRating || 'adequate']}
                  className="uppercase font-semibold"
                >
                  {lastAnsweredQuestion.answer.overallRating}
                </Badge>
              </div>

              {/* Strengths & Gaps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {lastAnsweredQuestion.answer.evaluation.strengths.length > 0 && (
                  <div className="space-y-1.5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                      Key Strengths Demonstrated:
                    </span>
                    <ul className="space-y-1 list-disc list-inside text-foreground/90">
                      {lastAnsweredQuestion.answer.evaluation.strengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {lastAnsweredQuestion.answer.evaluation.gaps.length > 0 && (
                  <div className="space-y-1.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                      What to Improve:
                    </span>
                    <ul className="space-y-1 list-disc list-inside text-foreground/90">
                      {lastAnsweredQuestion.answer.evaluation.gaps.map((g, idx) => (
                        <li key={idx}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Feedback notes */}
              {lastAnsweredQuestion.answer.evaluation.feedbackNotes && (
                <div className="text-xs text-foreground bg-surface-muted/40 p-3 rounded-lg border border-border">
                  <span className="font-bold text-primary mr-1 uppercase font-mono text-[10px]">Coaching Note:</span>
                  {lastAnsweredQuestion.answer.evaluation.feedbackNotes}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
