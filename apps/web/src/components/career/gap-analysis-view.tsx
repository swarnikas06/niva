'use client';

import React, { useState } from 'react';
import {
  CareerGapAnalysisDto,
  SkillGapDto,
  SkillStrengthDto,
  ReadinessDiscrepancy,
} from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/auth-client';

interface GapAnalysisViewProps {
  gapAnalysis: CareerGapAnalysisDto | null;
  targetRoleId?: string;
  onPracticeSkill: (skillId: string) => void;
  onRefresh: () => void;
}

const DISCREPANCY_INFO: Record<
  ReadinessDiscrepancy,
  { title: string; explanation: string; variant: 'warning' | 'presence' | 'success' | 'default' }
> = {
  overconfident: {
    title: 'Evidence Discrepancy (Overconfident)',
    explanation:
      'Your stated interview readiness is high, but your verified evidence base is lacking critical proof points. NIVA discounts unverified claims to prevent false confidence.',
    variant: 'warning',
  },
  underconfident: {
    title: 'Confidence Discrepancy (Underconfident)',
    explanation:
      'You possess solid demonstrated competency with tangible artifacts. NIVA recommends practicing technical communication to translate your depth into interview conviction.',
    variant: 'presence',
  },
  aligned: {
    title: 'Readiness Aligned',
    explanation:
      'Your stated readiness matches your demonstrated proof points and evaluated mock performances.',
    variant: 'success',
  },
  unassessed: {
    title: 'Unassessed Benchmark',
    explanation:
      'Self-assess your target role skills or complete a mock round to generate evidence-grounded readiness.',
    variant: 'default',
  },
};

export function GapAnalysisView({
  gapAnalysis,
  targetRoleId,
  onPracticeSkill,
  onRefresh,
}: GapAnalysisViewProps) {
  const [isReevaluating, setIsReevaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReevaluate = async () => {
    setIsReevaluating(true);
    setError(null);
    try {
      await authFetch('/career/gap-analysis/evaluate', {
        method: 'POST',
        body: JSON.stringify({ targetRoleId }),
      });
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to re-evaluate gap analysis.');
    } finally {
      setIsReevaluating(false);
    }
  };

  if (!gapAnalysis) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground space-y-3">
        <p>No career gap analysis generated yet.</p>
        <Button size="sm" onClick={handleReevaluate} disabled={isReevaluating}>
          {isReevaluating ? 'Evaluating...' : 'Run Gap Analysis'}
        </Button>
      </div>
    );
  }

  const discrepancy = DISCREPANCY_INFO[gapAnalysis.readinessDiscrepancy] || {
    title: 'Benchmark Assessment',
    explanation: 'Evaluated against target role benchmarks.',
    variant: 'default' as const,
  };

  const gaps = gapAnalysis.gaps || [];
  const strengths = gapAnalysis.strengths || [];

  return (
    <div className="space-y-6">
      {/* 1. Readiness & Evidence Alignment Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Readiness Score Card */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Evidence-Discounted Readiness
            </span>
            <Badge variant="presence" size="sm">
              Authoritative
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {gapAnalysis.readinessScore}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Calculated against mandatory and high-priority role requirements. Claims without verified proof points receive a 30% discount.
          </p>
        </div>

        {/* Evidence Alignment Card */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Evidence Alignment
            </span>
            <Badge variant="default" size="sm">
              Calibration
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {gapAnalysis.evidenceAlignmentScore}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Measures the proportion of self-assessed competencies backed by validated mock scores or project artifacts.
          </p>
        </div>
      </div>

      {/* 2. Discrepancy Diagnosis Banner */}
      <div
        className={`rounded-xl border p-4 sm:p-5 text-xs space-y-1.5 ${
          gapAnalysis.readinessDiscrepancy === 'overconfident'
            ? 'bg-warning/10 border-warning/30 text-warning-foreground'
            : gapAnalysis.readinessDiscrepancy === 'underconfident'
            ? 'bg-presence/10 border-presence/30 text-presence-foreground'
            : 'bg-surface border-border text-foreground'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            {discrepancy.title}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReevaluate}
            disabled={isReevaluating}
          >
            {isReevaluating ? 'Re-evaluating...' : 'Re-evaluate'}
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-foreground/80">
          {discrepancy.explanation}
        </p>
      </div>

      {error && (
        <div className="p-3 text-xs bg-danger/10 border border-danger/30 text-danger rounded-lg">
          {error}
        </div>
      )}

      {/* 3. Critical Gaps Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold text-foreground">
            Target Role Skill Gaps ({gaps.length})
          </h4>
          <span className="text-xs text-muted-foreground">
            Ranked by required proficiency and evidence absence
          </span>
        </div>

        {gaps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No critical skill gaps detected. All benchmark requirements have evidenced competencies.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {gaps.map((gap: SkillGapDto) => (
              <div
                key={gap.skillId}
                className="rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-colors shadow-2xs space-y-2 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {gap.skillName}
                      </span>
                      <Badge
                        variant={gap.gapSeverity === 'critical' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {gap.gapSeverity === 'critical' ? 'Critical Gap' : 'Moderate Gap'}
                      </Badge>
                      <Badge variant="default" size="sm">
                        {gap.importance}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground leading-relaxed">
                      {gap.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onPracticeSkill(gap.skillId)}
                    >
                      Practice Topic
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span>Required: <strong className="text-foreground capitalize">{gap.requiredProficiency}</strong></span>
                  <span>Current: <strong className="text-foreground capitalize">{gap.currentProficiency}</strong></span>
                  <span>Artifacts: <strong className="text-foreground">{gap.evidenceCount}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Demonstrated Strengths Breakdown */}
      {strengths.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-base font-semibold text-foreground">
            Demonstrated Strengths ({strengths.length})
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {strengths.map((str: SkillStrengthDto) => (
              <div
                key={str.skillId}
                className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    {str.skillName}
                  </span>
                  <Badge variant="success" size="sm">
                    Verified
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                  <span className="capitalize">Proficiency: {str.proficiency}</span>
                  <span>{str.evidenceCount} artifact(s)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
