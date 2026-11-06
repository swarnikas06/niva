'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  StudyTopicDto,
  CreateLearningDifficultyDto,
  DifficultySource,
} from '@niva/shared-types';

export interface RecordDifficultyModalProps {
  isOpen: boolean;
  onClose: () => void;
  topics: StudyTopicDto[];
  preselectedTopicId?: string;
  onSave: (data: CreateLearningDifficultyDto) => Promise<void>;
  isSaving?: boolean;
}

export function RecordDifficultyModal({
  isOpen,
  onClose,
  topics,
  preselectedTopicId,
  onSave,
  isSaving = false,
}: RecordDifficultyModalProps) {
  const [topicId, setTopicId] = useState<string>('');
  const [concept, setConcept] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [source, setSource] = useState<DifficultySource>('user_reported');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTopicId(preselectedTopicId || topics[0]?.id || '');
      setConcept('');
      setDescription('');
      setSource('user_reported');
      setErrorMsg(null);
    }
  }, [isOpen, preselectedTopicId, topics]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!topicId) {
      setErrorMsg('Please select a topic.');
      return;
    }
    if (!concept.trim()) {
      setErrorMsg('Concept title is required.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Description of the confusion or difficulty is required.');
      return;
    }

    try {
      await onSave({
        topicId,
        concept: concept.trim(),
        description: description.trim(),
        source,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record difficulty';
      setErrorMsg(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!isSaving) onClose();
        }}
        aria-hidden="true"
      />

      <div className="relative bg-card border border-border w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 my-8 z-10">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Record Learning Difficulty
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track challenging concepts for targeted revision and recall.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-md"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-xs text-danger">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Topic Select */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Associated Topic *</label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              required
              className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.subjectName})
                </option>
              ))}
            </select>
          </div>

          {/* Concept Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Concept or Subtopic *</label>
            <input
              type="text"
              placeholder="e.g. Quorum intersection property under network partition"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              required
              className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Description / Specific Confusion
            </label>
            <textarea
              rows={3}
              placeholder="What specific question or mental model is causing friction?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
            />
          </div>

          {/* Provenance */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Source / Provenance</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as DifficultySource)}
              className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
            >
              <option value="user_reported">User Reported (Self-identified confusion)</option>
              <option value="ai_inferred">AI Inferred (Detected during conversation / evaluation)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSaving}
            >
              Record Difficulty
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
