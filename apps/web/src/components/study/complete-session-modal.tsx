'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  StudySessionDto,
  StudyTopicDto,
  CompleteStudySessionDto,
  TopicProgressStatus,
  StudyProficiencyLevel,
} from '@niva/shared-types';

export interface CompleteSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StudySessionDto | null;
  topic: StudyTopicDto | null;
  onConfirmComplete: (data: CompleteStudySessionDto) => Promise<void>;
  isCompleting?: boolean;
}

export function CompleteSessionModal({
  isOpen,
  onClose,
  session,
  topic,
  onConfirmComplete,
  isCompleting = false,
}: CompleteSessionModalProps) {
  const [notes, setNotes] = useState('');
  const [conceptsUnderstood, setConceptsUnderstood] = useState<string[]>(['']);
  const [difficultiesFaced, setDifficultiesFaced] = useState<string[]>([]);
  const [newDifficultyInput, setNewDifficultyInput] = useState('');
  const [followUpActions, setFollowUpActions] = useState<string[]>([]);
  const [newActionInput, setNewActionInput] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [targetTopicStatus, setTargetTopicStatus] = useState<TopicProgressStatus>('practiced');
  const [targetTopicProficiency, setTargetTopicProficiency] = useState<StudyProficiencyLevel | ''>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      const firstObjective = topic?.learningObjectives?.[0];
      setConceptsUnderstood(firstObjective ? [firstObjective] : ['']);
      setDifficultiesFaced([]);
      setNewDifficultyInput('');
      setFollowUpActions([]);
      setNewActionInput('');
      setEvidenceNotes('');
      setTargetTopicStatus('practiced');
      setTargetTopicProficiency('');
      setErrorMsg(null);
    }
  }, [isOpen, topic]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isCompleting) {
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
  }, [isOpen, isCompleting, onClose]);

  if (!isOpen || !session) return null;

  const handleAddConcept = () => setConceptsUnderstood([...conceptsUnderstood, '']);
  const handleConceptChange = (index: number, val: string) => {
    const updated = [...conceptsUnderstood];
    updated[index] = val;
    setConceptsUnderstood(updated);
  };
  const handleRemoveConcept = (index: number) => {
    if (conceptsUnderstood.length <= 1) {
      setConceptsUnderstood(['']);
      return;
    }
    setConceptsUnderstood(conceptsUnderstood.filter((_, i) => i !== index));
  };

  const handleAddDifficulty = () => {
    if (!newDifficultyInput.trim()) return;
    setDifficultiesFaced([...difficultiesFaced, newDifficultyInput.trim()]);
    setNewDifficultyInput('');
  };
  const handleRemoveDifficulty = (index: number) => {
    setDifficultiesFaced(difficultiesFaced.filter((_, i) => i !== index));
  };

  const handleAddAction = () => {
    if (!newActionInput.trim()) return;
    setFollowUpActions([...followUpActions, newActionInput.trim()]);
    setNewActionInput('');
  };
  const handleRemoveAction = (index: number) => {
    setFollowUpActions(followUpActions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (targetTopicStatus === 'demonstrated' && !evidenceNotes.trim()) {
      setErrorMsg(
        'Demonstrated mastery requires concrete evidence notes (e.g. mock evaluation pass, verified implementation, or detailed conceptual proof).',
      );
      return;
    }

    const cleanedConcepts = conceptsUnderstood.map((c) => c.trim()).filter(Boolean);

    try {
      const payload: CompleteStudySessionDto = {
        userNotes: notes.trim() || undefined,
        conceptsUnderstood: cleanedConcepts.length > 0 ? cleanedConcepts : undefined,
        difficultiesEncountered: difficultiesFaced.length > 0 ? difficultiesFaced : undefined,
        followUpActions: followUpActions.length > 0 ? followUpActions : undefined,
        evidenceNotes: evidenceNotes.trim() || undefined,
        updateTopicStatus: targetTopicStatus,
        demonstratedProficiency: (targetTopicProficiency as StudyProficiencyLevel) || undefined,
      };

      await onConfirmComplete(payload);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete study session';
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
          if (!isCompleting) onClose();
        }}
        aria-hidden="true"
      />

      <div className="relative bg-card border border-border w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-5 my-8 z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Complete Study Session
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Topic: <strong className="text-foreground">{session.topicTitle || topic?.title}</strong>{' '}
              ({session.subjectName || topic?.subjectName})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCompleting}
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
          {/* Notes & Summary */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Session Reflections & Notes
            </label>
            <textarea
              rows={3}
              placeholder="What core mechanisms or exercises were covered in this session?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
            />
          </div>

          {/* Concepts Understood */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Concepts Understood / Validated
              </label>
              <button
                type="button"
                onClick={handleAddConcept}
                className="text-2xs text-presence hover:underline font-medium"
              >
                + Add Concept
              </button>
            </div>
            <div className="space-y-1.5">
              {conceptsUnderstood.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Leader election heartbeat mechanics"
                    value={c}
                    onChange={(e) => handleConceptChange(idx, e.target.value)}
                    className="flex-1 text-xs rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveConcept(idx)}
                    className="text-muted-foreground hover:text-danger text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Difficulties Encountered */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Difficulties & Friction Encountered
            </label>
            <p className="text-2xs text-muted-foreground">
              Recorded difficulties are tracked for targeted recall and revision.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. Distinguishing split-vote resolution from log reconciliation"
                value={newDifficultyInput}
                onChange={(e) => setNewDifficultyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDifficulty();
                  }
                }}
                className="flex-1 text-xs rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAddDifficulty}
              >
                Add
              </Button>
            </div>
            {difficultiesFaced.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {difficultiesFaced.map((d, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-surface border border-border text-foreground"
                  >
                    <span>{d}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDifficulty(idx)}
                      className="text-muted-foreground hover:text-danger text-2xs"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Follow-up actions */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Follow-up Actions / Next Study Step
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. Implement toy RPC follower log replication in Go"
                value={newActionInput}
                onChange={(e) => setNewActionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAction();
                  }
                }}
                className="flex-1 text-xs rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAddAction}
              >
                Add
              </Button>
            </div>
            {followUpActions.length > 0 && (
              <ul className="text-xs text-foreground/80 space-y-1 pt-1">
                {followUpActions.map((act, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2">
                    <span className="truncate">• {act}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAction(idx)}
                      className="text-muted-foreground hover:text-danger text-2xs"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Target Status Update */}
          <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Update Topic Status
              </label>
              <select
                value={targetTopicStatus}
                onChange={(e) => setTargetTopicStatus(e.target.value as TopicProgressStatus)}
                className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
              >
                <option value="practiced">Practiced</option>
                <option value="in_progress">Still in Progress</option>
                <option value="needs_review">Needs Review</option>
                <option value="demonstrated">Demonstrated Mastery</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Demonstrated Proficiency (Optional)
              </label>
              <select
                value={targetTopicProficiency}
                onChange={(e) => setTargetTopicProficiency(e.target.value as StudyProficiencyLevel)}
                className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
              >
                <option value="">Leave Unchanged</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
          </div>

          {/* Evidence Notes (Required if Demonstrated) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Evidence Notes {targetTopicStatus === 'demonstrated' && <span className="text-danger">*</span>}
              </label>
              <span className="text-2xs text-muted-foreground">
                Required for demonstrated mastery
              </span>
            </div>
            <textarea
              rows={2}
              placeholder="e.g. Correctly solved Raft candidate election state machine edge case without hints."
              value={evidenceNotes}
              onChange={(e) => setEvidenceNotes(e.target.value)}
              className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isCompleting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCompleting}
            >
              Save & Complete Session
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
