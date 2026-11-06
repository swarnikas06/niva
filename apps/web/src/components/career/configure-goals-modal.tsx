'use client';

import React, { useState, useEffect } from 'react';
import {
  CareerProfileDto,
  CareerTargetRoleDto,
  RoleFamily,
  SeniorityLevel,
  CareerLevel,
  StatedReadiness,
} from '@niva/shared-types';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/auth-client';

interface ConfigureGoalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  profile: CareerProfileDto | null;
  targetRole: CareerTargetRoleDto | null;
}

const ROLE_FAMILIES: { value: RoleFamily; label: string }[] = [
  { value: 'systems_infrastructure', label: 'Systems & Infrastructure' },
  { value: 'software_engineering', label: 'Software Engineering' },
  { value: 'data_ai_ml', label: 'Data, AI & ML Engineering' },
  { value: 'security', label: 'Security Engineering' },
  { value: 'engineering_management', label: 'Engineering Management' },
  { value: 'product_management', label: 'Product Management' },
  { value: 'other', label: 'Other' },
];

const SENIORITIES: { value: SeniorityLevel; label: string }[] = [
  { value: 'junior', label: 'Junior / Associate' },
  { value: 'mid', label: 'Mid-Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'staff', label: 'Staff' },
  { value: 'principal', label: 'Principal' },
];

const CAREER_LEVELS: { value: CareerLevel; label: string }[] = [
  { value: 'student', label: 'Student / New Grad' },
  { value: 'entry_level', label: 'Entry Level (0-2 yrs)' },
  { value: 'mid_level', label: 'Mid Level (3-5 yrs)' },
  { value: 'senior', label: 'Senior (6-9 yrs)' },
  { value: 'staff_plus', label: 'Staff+ (10+ yrs)' },
  { value: 'career_switcher', label: 'Career Switcher' },
];

const READINESS_OPTIONS: { value: StatedReadiness; label: string }[] = [
  { value: 'exploring', label: 'Exploring Options (Not Actively Prepping)' },
  { value: 'early_preparation', label: 'Early Preparation (Foundations)' },
  { value: 'moderate_confidence', label: 'Moderate Confidence (Practicing)' },
  { value: 'interview_ready', label: 'Interview Ready (Ready for Rounds)' },
];

export function ConfigureGoalsModal({
  isOpen,
  onClose,
  onSaved,
  profile,
  targetRole,
}: ConfigureGoalsModalProps) {
  const [roleTitle, setRoleTitle] = useState(targetRole?.title || 'Staff Infrastructure Architect');
  const [roleFamily, setRoleFamily] = useState<RoleFamily>(targetRole?.roleFamily || 'systems_infrastructure');
  const [seniorityLevel, setSeniorityLevel] = useState<SeniorityLevel>(targetRole?.seniorityLevel || 'staff');
  const [headline, setHeadline] = useState(profile?.headline || 'Senior engineer targeting staff infrastructure roles');
  const [currentLevel, setCurrentLevel] = useState<CareerLevel>(profile?.currentLevel || 'senior');
  const [timelineMonths, setTimelineMonths] = useState<number>(profile?.targetTimelineMonths || 3);
  const [statedReadiness, setStatedReadiness] = useState<StatedReadiness>(profile?.statedReadiness || 'moderate_confidence');
  const [companyTypes, setCompanyTypes] = useState<string[]>(
    targetRole?.targetCompanyTypes || ['faang_tier1', 'growth_unicorn']
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (targetRole) {
      setRoleTitle(targetRole.title);
      setRoleFamily(targetRole.roleFamily);
      setSeniorityLevel(targetRole.seniorityLevel);
      setCompanyTypes(targetRole.targetCompanyTypes || ['faang_tier1', 'growth_unicorn']);
    }
    if (profile) {
      setHeadline(profile.headline || '');
      setCurrentLevel(profile.currentLevel || 'senior');
      setTimelineMonths(profile.targetTimelineMonths || 3);
      setStatedReadiness(profile.statedReadiness || 'moderate_confidence');
    }
  }, [targetRole, profile, isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim()) {
      setError('Target role title is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Upsert Profile
      await authFetch('/career/profile', {
        method: 'PUT',
        body: JSON.stringify({
          headline: headline.trim(),
          currentLevel,
          targetTimelineMonths: Number(timelineMonths),
          targetCompanyTiers: companyTypes,
          statedReadiness,
        }),
      });

      // 2. Create or Update Target Role
      if (targetRole?.id) {
        await authFetch(`/career/target-roles/${targetRole.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: roleTitle.trim(),
            roleFamily,
            seniorityLevel,
            targetCompanyTypes: companyTypes,
          }),
        });
      } else {
        await authFetch('/career/target-roles', {
          method: 'POST',
          body: JSON.stringify({
            title: roleTitle.trim(),
            roleFamily,
            seniorityLevel,
            priority: 'primary',
            targetCompanyTypes: companyTypes,
          }),
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save career trajectory.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCompanyType = (type: string) => {
    setCompanyTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="career-goals-title"
    >
      <div className="fixed inset-0" onClick={() => !isSubmitting && onClose()} aria-hidden="true" />

      <div className="relative bg-surface border border-border w-full max-w-lg rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 id="career-goals-title" className="text-lg font-semibold text-foreground">
              Configure Career Trajectory & Target Role
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ground your preparation benchmarks and evaluation difficulty.
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
          {/* Target Role Title */}
          <div className="space-y-1">
            <label className="font-medium text-foreground block">
              Primary Target Role Title <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. Staff Infrastructure Architect"
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-accent text-xs"
            />
          </div>

          {/* Role Family & Seniority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-medium text-foreground block">Role Family</label>
              <select
                value={roleFamily}
                onChange={(e) => setRoleFamily(e.target.value as RoleFamily)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-accent text-xs"
              >
                {ROLE_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-foreground block">Target Seniority</label>
              <select
                value={seniorityLevel}
                onChange={(e) => setSeniorityLevel(e.target.value as SeniorityLevel)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-accent text-xs"
              >
                {SENIORITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-1">
            <label className="font-medium text-foreground block">Professional Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Senior Backend Engineer specializing in distributed storage"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-accent text-xs"
            />
          </div>

          {/* Experience Level & Target Timeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-medium text-foreground block">Current Experience Level</label>
              <select
                value={currentLevel}
                onChange={(e) => setCurrentLevel(e.target.value as CareerLevel)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-accent text-xs"
              >
                {CAREER_LEVELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-foreground block">Preparation Timeline</label>
              <select
                value={timelineMonths}
                onChange={(e) => setTimelineMonths(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-accent text-xs"
              >
                <option value={1}>1 Month (Immediate)</option>
                <option value={3}>3 Months (Quarterly Focus)</option>
                <option value={6}>6 Months (Comprehensive)</option>
                <option value={12}>12 Months (Long Horizon)</option>
              </select>
            </div>
          </div>

          {/* Stated Readiness */}
          <div className="space-y-1">
            <label className="font-medium text-foreground block">Stated Interview Readiness</label>
            <select
              value={statedReadiness}
              onChange={(e) => setStatedReadiness(e.target.value as StatedReadiness)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-accent text-xs"
            >
              {READINESS_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground block">
              NIVA compares your stated readiness against verified evidence to diagnose over/under-confidence.
            </span>
          </div>

          {/* Target Company Types */}
          <div className="space-y-1.5 pt-1">
            <label className="font-medium text-foreground block">Target Company Profiles</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'faang_tier1', label: 'Tier 1 / Big Tech' },
                { id: 'growth_unicorn', label: 'High-Growth Unicorn' },
                { id: 'enterprise', label: 'Enterprise / Fortune 500' },
                { id: 'early_stage', label: 'Early Stage Startup' },
              ].map((tier) => {
                const isSelected = companyTypes.includes(tier.id);
                return (
                  <button
                    type="button"
                    key={tier.id}
                    onClick={() => toggleCompanyType(tier.id)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      isSelected
                        ? 'bg-accent/15 border-accent text-accent font-medium'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tier.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving Goals...' : 'Save Trajectory'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
