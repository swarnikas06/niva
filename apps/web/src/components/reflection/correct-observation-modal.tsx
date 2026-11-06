'use client';

import React, { useState } from 'react';
import { LongitudinalObservationDto } from '@niva/shared-types';
import { Button } from '@/components/ui/button';

interface CorrectObservationModalProps {
  isOpen: boolean;
  observation: LongitudinalObservationDto | null;
  onClose: () => void;
  onSubmitCorrection: (id: string, notes: string) => Promise<void>;
}

export function CorrectObservationModal({
  isOpen,
  observation,
  onClose,
  onSubmitCorrection,
}: CorrectObservationModalProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !observation) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError('Please provide your correction notes.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmitCorrection(observation.id, notes.trim());
      setNotes('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save correction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            User Feedback & Correction
          </span>
          <h3 className="text-lg font-serif font-semibold text-foreground">
            Correct Observation
          </h3>
          <p className="text-xs text-muted-foreground">
            Clarify what was inaccurate or missing. NIVA will record this correction, update this pattern,
            and explicitly avoid repeating assumptions you reject.
          </p>
        </div>

        {/* Observation Snippet */}
        <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2 text-xs">
          <div>
            <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              Pattern Title:
            </span>
            <p className="font-medium text-foreground">{observation.title}</p>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              Recorded Fact:
            </span>
            <p className="text-foreground">{observation.fact}</p>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              Interpreted by Companion:
            </span>
            <p className="italic text-muted-foreground">{observation.interpretation}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              What should NIVA understand instead?
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. I didn't get stuck on Raft; I intentionally paused it to prepare for a database migration interview."
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground transition"
              required
            />
            <span className="text-[10px] text-muted-foreground block text-right">
              {notes.length} / 2000 characters
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving Correction...' : 'Submit Correction'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
