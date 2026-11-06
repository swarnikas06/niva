'use client';

import React, { useState, useEffect } from 'react';
import {
  UserSkillDto,
  SkillEvidenceDto,
  SkillProficiency,
  EvidenceType,
  EvidenceValidationStatus,
} from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/auth-client';

interface EvidenceTraceabilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  userSkill: UserSkillDto | null;
  skillName: string;
  category?: string;
  requiredProficiency?: string;
  importance?: string;
}

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  project_artifact: 'Project Artifact',
  production_experience: 'Production Experience',
  open_source_pr: 'Open Source PR',
  code_review_demo: 'Code Review Demo',
  system_design_doc: 'System Design Spec / RFC',
  mock_interview_score: 'Mock Interview Score',
  certification: 'Certification',
  verbal_explanation: 'Verbal Explanation',
};

const VALIDATION_VARIANT: Record<
  EvidenceValidationStatus,
  { label: string; variant: 'success' | 'presence' | 'default' | 'warning' }
> = {
  validated_by_niva: { label: 'Validated by NIVA', variant: 'success' },
  demonstrated: { label: 'Demonstrated Artifact', variant: 'presence' },
  unverified: { label: 'Unverified Claim', variant: 'default' },
  stale: { label: 'Stale Evidence', variant: 'warning' },
};

export function EvidenceTraceabilityDrawer({
  isOpen,
  onClose,
  onUpdated,
  userSkill,
  skillName,
  category,
  requiredProficiency,
  importance,
}: EvidenceTraceabilityDrawerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAssessForm, setShowAssessForm] = useState(false);

  // Add evidence state
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('project_artifact');
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);

  // Self assess state
  const [selfRating, setSelfRating] = useState<SkillProficiency>(userSkill?.selfRating || 'intermediate');
  const [confidenceScore, setConfidenceScore] = useState<number>(userSkill?.confidenceScore || 70);
  const [isSubmittingAssess, setIsSubmittingAssess] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      setShowAddForm(false);
      setShowAssessForm(false);
      setError(null);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSkill?.id) {
      setError('Please self-assess this skill first before attaching evidence.');
      return;
    }
    if (!evidenceTitle.trim() || !evidenceDesc.trim()) {
      setError('Title and description are required.');
      return;
    }

    setIsSubmittingEvidence(true);
    setError(null);

    try {
      await authFetch(`/career/user-skills/${userSkill.id}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          evidenceType,
          title: evidenceTitle.trim(),
          description: evidenceDesc.trim(),
          url: evidenceUrl.trim() || undefined,
        }),
      });

      setEvidenceTitle('');
      setEvidenceDesc('');
      setEvidenceUrl('');
      setShowAddForm(false);
      onUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to attach evidence.');
    } finally {
      setIsSubmittingEvidence(false);
    }
  };

  const handleSelfAssess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSkill?.skillId) {
      setError('Skill ID is required.');
      return;
    }

    setIsSubmittingAssess(true);
    setError(null);

    try {
      await authFetch('/career/user-skills', {
        method: 'POST',
        body: JSON.stringify({
          skillId: userSkill.skillId,
          selfRating,
          confidenceScore: Number(confidenceScore),
        }),
      });

      setShowAssessForm(false);
      onUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to update self-assessment.');
    } finally {
      setIsSubmittingAssess(false);
    }
  };

  const evidenceList = userSkill?.evidence || [];

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-drawer-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative bg-surface border-l border-border w-full max-w-lg h-full p-6 sm:p-7 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200 z-10">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-border">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Skill Evidence Traceability
              </span>
              <h3 id="evidence-drawer-title" className="text-xl font-semibold text-foreground">
                {skillName}
              </h3>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {category && (
                  <Badge variant="default" size="sm">
                    {category.replace(/_/g, ' ')}
                  </Badge>
                )}
                {importance && (
                  <Badge
                    variant={importance === 'mandatory' ? 'danger' : importance === 'high_priority' ? 'warning' : 'default'}
                    size="sm"
                  >
                    {importance.replace(/_/g, ' ')}
                  </Badge>
                )}
                {requiredProficiency && (
                  <span className="text-xs text-muted-foreground">
                    Target: {requiredProficiency}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
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

          {/* Current Assessment Summary */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current Assessment
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAssessForm(!showAssessForm)}
              >
                {showAssessForm ? 'Cancel' : 'Update Assessment'}
              </Button>
            </div>

            {showAssessForm ? (
              <form onSubmit={handleSelfAssess} className="space-y-3 pt-2 text-xs">
                <div className="space-y-1">
                  <label className="font-medium text-foreground block">Proficiency Level</label>
                  <select
                    value={selfRating}
                    onChange={(e) => setSelfRating(e.target.value as SkillProficiency)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-foreground text-xs"
                  >
                    <option value="beginner">Beginner (Foundations)</option>
                    <option value="intermediate">Intermediate (Working Knowledge)</option>
                    <option value="advanced">Advanced (Production Mastery)</option>
                    <option value="expert">Expert (Architectural Authority)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground block">
                    Confidence ({confidenceScore}/100)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={confidenceScore}
                    onChange={(e) => setConfidenceScore(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>

                <Button type="submit" size="sm" disabled={isSubmittingAssess}>
                  {isSubmittingAssess ? 'Saving...' : 'Save Assessment'}
                </Button>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-surface/50 border border-border/50">
                  <span className="text-muted-foreground block text-[11px]">Self Rating</span>
                  <span className="font-semibold text-foreground capitalize mt-0.5 block">
                    {userSkill?.selfRating || 'Not assessed'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface/50 border border-border/50">
                  <span className="text-muted-foreground block text-[11px]">Confidence</span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {userSkill?.confidenceScore !== undefined ? `${userSkill.confidenceScore}/100` : 'None'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Evidence List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">
                Verified Evidence Artifacts ({evidenceList.length})
              </h4>
              {userSkill && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAddForm(!showAddForm)}
                >
                  {showAddForm ? 'Cancel' : '+ Attach Artifact'}
                </Button>
              )}
            </div>

            {/* Add Evidence Form */}
            {showAddForm && (
              <form onSubmit={handleAddEvidence} className="rounded-xl border border-border bg-card p-4 space-y-3 text-xs">
                <h5 className="font-semibold text-foreground">Attach Proof of Competency</h5>

                <div className="space-y-1">
                  <label className="font-medium text-foreground block">
                    Evidence Title <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={evidenceTitle}
                    onChange={(e) => setEvidenceTitle(e.target.value)}
                    placeholder="e.g. Distributed Consensus Engine Implementation in Rust"
                    required
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-foreground text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground block">Evidence Type</label>
                  <select
                    value={evidenceType}
                    onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-foreground text-xs"
                  >
                    {Object.entries(EVIDENCE_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground block">
                    Description & Architectural Trade-offs <span className="text-danger">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={evidenceDesc}
                    onChange={(e) => setEvidenceDesc(e.target.value)}
                    placeholder="Describe how you built, designed, or tested this. Include concrete scale and constraints."
                    required
                    className="w-full bg-background border border-border rounded-lg p-2.5 text-foreground text-xs focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground block">Artifact URL (Optional)</label>
                  <input
                    type="url"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    placeholder="https://github.com/org/repo or RFC wiki link"
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-foreground text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button type="submit" size="sm" disabled={isSubmittingEvidence}>
                    {isSubmittingEvidence ? 'Attaching...' : 'Attach Evidence'}
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {/* Evidence Items */}
            {evidenceList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground space-y-2">
                <p>No tangible evidence artifacts recorded yet for this skill.</p>
                <p className="text-[11px] text-muted-foreground">
                  Unverified claims receive a 30% discount in readiness scoring until validated by NIVA mock evaluation or documented project artifacts.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {evidenceList.map((ev: SkillEvidenceDto) => {
                  const validInfo = VALIDATION_VARIANT[ev.validationStatus] || {
                    label: ev.validationStatus,
                    variant: 'default' as const,
                  };

                  return (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-border bg-card p-4 space-y-2.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={validInfo.variant} size="sm">
                              {validInfo.label}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {EVIDENCE_TYPE_LABELS[ev.evidenceType] || ev.evidenceType}
                            </span>
                          </div>
                          <h5 className="font-semibold text-foreground text-sm mt-1">
                            {ev.title}
                          </h5>
                        </div>
                      </div>

                      <p className="text-muted-foreground leading-relaxed">
                        {ev.description}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                        <span>
                          {ev.createdAt
                            ? new Date(ev.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Logged in session'}
                        </span>

                        {ev.url && (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline flex items-center gap-1 font-medium"
                          >
                            <span>Inspect Artifact</span>
                            <span>↗</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
