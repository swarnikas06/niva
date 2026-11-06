'use client';

import React, { useState } from 'react';
import { LearningDifficultyDto } from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface LearningDifficultiesViewProps {
  difficulties: LearningDifficultyDto[];
  onResolve: (difficultyId: string, resolutionNotes?: string) => Promise<void>;
  onAddNew: () => void;
  isLoading?: boolean;
}

export function LearningDifficultiesView({
  difficulties,
  onResolve,
  onAddNew,
}: LearningDifficultiesViewProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNoteInput, setResolutionNoteInput] = useState<string>('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState<boolean>(false);

  const filtered = difficulties.filter((d) => {
    if (filter === 'all') return true;
    return d.status === filter;
  });

  const handleOpenResolve = (id: string) => {
    setResolvingId(id);
    setResolutionNoteInput('');
  };

  const handleConfirmResolve = async (id: string) => {
    try {
      setIsSubmittingResolve(true);
      await onResolve(id, resolutionNoteInput.trim() || undefined);
      setResolvingId(null);
      setResolutionNoteInput('');
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Learning Difficulties & Misconceptions
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Explicit tracking of areas of friction, confusion, or incomplete understanding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onAddNew} variant="primary">
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
            Log Difficulty
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter('active')}
          className={`px-3 py-1 text-xs rounded-md font-mono transition-colors cursor-pointer ${
            filter === 'active'
              ? 'bg-primary text-white font-semibold shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Active ({difficulties.filter((d) => d.status === 'active').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('resolved')}
          className={`px-3 py-1 text-xs rounded-md font-mono transition-colors cursor-pointer ${
            filter === 'resolved'
              ? 'bg-brand-indigo text-white font-semibold shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Resolved ({difficulties.filter((d) => d.status === 'resolved').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1 text-xs rounded-md font-mono transition-colors cursor-pointer ${
            filter === 'all'
              ? 'bg-primary text-white font-semibold shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          All ({difficulties.length})
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {filter === 'active'
              ? 'No active learning difficulties recorded. Clear path forward!'
              : 'No difficulties match the selected filter.'}
          </p>
          {filter === 'active' && (
            <Button size="sm" onClick={onAddNew} variant="secondary">
              Record a Concept Difficulty
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((diff) => (
            <div
              key={diff.id}
              className="rounded-xl border border-border bg-card p-4 sm:p-5 hover:border-border/80 transition-colors shadow-2xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {diff.concept}
                    </h4>
                    <Badge
                      variant={diff.status === 'active' ? 'danger' : 'success'}
                      size="sm"
                    >
                      {diff.status === 'active' ? 'Active Difficulty' : 'Resolved'}
                    </Badge>
                    <Badge variant="outline" size="sm" className="capitalize">
                      {diff.source === 'ai_inferred'
                        ? 'AI Inferred'
                        : diff.source === 'practice_evaluation'
                        ? 'Practice Inferred'
                        : 'User Reported'}
                    </Badge>
                    <span className="text-2xs text-muted-foreground">
                      Topic: <strong className="text-foreground">{diff.topicTitle}</strong>{' '}
                      ({diff.subjectName})
                    </span>
                  </div>

                  {diff.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                      {diff.description}
                    </p>
                  )}
                </div>

                {/* Resolve Action */}
                {diff.status === 'active' && resolvingId !== diff.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenResolve(diff.id)}
                    className="self-start sm:self-auto shrink-0"
                  >
                    Resolve Difficulty
                  </Button>
                )}
              </div>

              {/* Resolution Form if opened */}
              {resolvingId === diff.id && (
                <div className="rounded-lg border border-border bg-surface p-3 space-y-2 mt-2 animate-in fade-in duration-100">
                  <label className="text-xs font-medium text-foreground block">
                    How was this difficulty resolved?
                  </label>
                  <textarea
                    rows={2}
                    value={resolutionNoteInput}
                    onChange={(e) => setResolutionNoteInput(e.target.value)}
                    placeholder="e.g. Worked through split-brain scenario with 5-node cluster diagram. Understood quorum requirements."
                    className="w-full text-xs rounded-lg border border-border bg-card px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setResolvingId(null)}
                      disabled={isSubmittingResolve}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleConfirmResolve(diff.id)}
                      isLoading={isSubmittingResolve}
                    >
                      Confirm Resolution
                    </Button>
                  </div>
                </div>
              )}

              {/* Resolved Notes display */}
              {diff.status === 'resolved' && diff.resolutionNotes && (
                <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-xs text-foreground/90 space-y-1">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-success">
                    Resolution Note
                  </span>
                  <p className="italic leading-relaxed">{diff.resolutionNotes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
