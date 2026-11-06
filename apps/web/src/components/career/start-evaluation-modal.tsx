'use client';

import React, { useState, useEffect } from 'react';
import {
  MockEvaluationType,
  EvaluationDifficulty,
  CareerTargetRoleDto,
  TargetRoleSkillDto,
} from '@niva/shared-types';
import { Button } from '@/components/ui/button';

interface StartEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRole: CareerTargetRoleDto | null;
  roleSkills: TargetRoleSkillDto[];
  onStartSession: (params: {
    targetRoleId: string;
    skillId?: string;
    evaluationType: MockEvaluationType;
    initialDifficulty: EvaluationDifficulty;
    totalPlannedQuestions: number;
  }) => Promise<void>;
  preselectedSkillId?: string;
}

const EVALUATION_TYPES: { value: MockEvaluationType; label: string; desc: string }[] = [
  {
    value: 'technical',
    label: 'Technical Deep-Dive',
    desc: 'Evaluates algorithmic efficiency, edge cases, and concurrency.',
  },
  {
    value: 'system_design',
    label: 'System Design & Architecture',
    desc: 'Focuses on scalability, partition tolerance, and storage engines.',
  },
  {
    value: 'behavioral',
    label: 'Behavioral & Leadership',
    desc: 'Tests cross-functional conflict, trade-off communication, and ownership.',
  },
  {
    value: 'skill_assessment',
    label: 'Domain Skill Assessment',
    desc: 'Focused scenario questions on a specific language or framework.',
  },
];

const DIFFICULTIES: { value: EvaluationDifficulty; label: string; desc: string }[] = [
  { value: 'foundation', label: 'Foundation', desc: 'Core principles and syntax idioms.' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Production trade-offs and failure scenarios.' },
  { value: 'advanced', label: 'Advanced', desc: 'Hard architectural edge-cases and distributed invariants.' },
];

export function StartEvaluationModal({
  isOpen,
  onClose,
  targetRole,
  roleSkills,
  onStartSession,
  preselectedSkillId,
}: StartEvaluationModalProps) {
  const [evaluationType, setEvaluationType] = useState<MockEvaluationType>('technical');
  const [difficulty, setDifficulty] = useState<EvaluationDifficulty>('intermediate');
  const [skillId, setSkillId] = useState<string>(preselectedSkillId || '');
  const [questionCount, setQuestionCount] = useState<number>(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedSkillId) {
      setSkillId(preselectedSkillId);
    }
  }, [preselectedSkillId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      setError(null);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !targetRole) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onStartSession({
        targetRoleId: targetRole.id,
        skillId: skillId || undefined,
        evaluationType,
        initialDifficulty: difficulty,
        totalPlannedQuestions: Number(questionCount),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to start evaluation round.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-eval-title"
    >
      <div className="fixed inset-0" onClick={() => !isSubmitting && onClose()} aria-hidden="true" />

      <div className="relative bg-surface border border-border w-full max-w-lg rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 id="start-eval-title" className="text-lg font-semibold text-foreground">
              Configure Mock Practice Round
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Grounded in {targetRole.title} benchmarks.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-muted-foreground hover:text-foreground text-sm font-medium p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 text-xs bg-danger/10 border border-danger/30 text-danger rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Evaluation Type */}
          <div className="space-y-1.5">
            <label className="font-medium text-foreground block">Round Format</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVALUATION_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setEvaluationType(t.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    evaluationType === t.value
                      ? 'bg-accent/10 border-accent text-foreground'
                      : 'bg-background border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <span className="font-semibold block text-foreground text-xs">{t.label}</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block leading-tight">
                    {t.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Targeted Skill */}
          <div className="space-y-1">
            <label className="font-medium text-foreground block">Focus Skill (Optional)</label>
            <select
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-xs"
            >
              <option value="">General Comprehensive Round (Across Target Role)</option>
              {roleSkills.map((s) => (
                <option key={s.skillId} value={s.skillId}>
                  {s.skillName} ({s.importance})
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Tier */}
          <div className="space-y-1.5">
            <label className="font-medium text-foreground block">Difficulty Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  type="button"
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  className={`p-2.5 rounded-lg border text-center transition-colors ${
                    difficulty === d.value
                      ? 'bg-accent/10 border-accent text-accent font-semibold'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="block capitalize text-xs">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Number of Questions */}
          <div className="space-y-1">
            <label className="font-medium text-foreground block">Session Length</label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-xs"
            >
              <option value={2}>2 Questions · Fast Calibration (~10 min)</option>
              <option value={3}>3 Questions · Standard Practice (~15 min)</option>
              <option value={5}>5 Questions · In-Depth Simulation (~25 min)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Starting Session...' : 'Begin Mock Round'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
