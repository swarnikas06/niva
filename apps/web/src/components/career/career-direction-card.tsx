'use client';

import React from 'react';
import {
  CareerProfileDto,
  CareerTargetRoleDto,
  RoleFamily,
  SeniorityLevel,
  StatedReadiness,
} from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CareerDirectionCardProps {
  profile: CareerProfileDto | null;
  targetRoles: CareerTargetRoleDto[];
  activeRoleId: string | null;
  onSelectRole: (roleId: string) => void;
  onConfigureGoals: () => void;
}

const READINESS_LABEL: Record<StatedReadiness, { label: string; variant: 'default' | 'presence' | 'warning' | 'success' }> = {
  exploring: { label: 'Exploring Options', variant: 'default' },
  early_preparation: { label: 'Early Preparation', variant: 'default' },
  moderate_confidence: { label: 'Moderate Confidence', variant: 'presence' },
  interview_ready: { label: 'Interview Ready', variant: 'success' },
};

function formatRoleFamily(family?: RoleFamily): string {
  if (!family) return 'General';
  return family
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatSeniority(level?: SeniorityLevel): string {
  if (!level) return 'Unspecified';
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function CareerDirectionCard({
  profile,
  targetRoles,
  activeRoleId,
  onSelectRole,
  onConfigureGoals,
}: CareerDirectionCardProps) {
  const activeRole =
    targetRoles.find((r) => r.id === activeRoleId) ||
    targetRoles.find((r) => r.priority === 'primary') ||
    targetRoles[0] ||
    null;

  if (!profile && !activeRole) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-6 sm:p-8 text-center space-y-3 shadow-subtle">
        <div className="w-10 h-10 mx-auto rounded-lg bg-surface-muted border border-border flex items-center justify-center text-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground uppercase tracking-tight">No Target Role Configured</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
            Define your primary target role and seniority benchmark to unlock personalized placement strategy and realistic mock evaluation rounds.
          </p>
        </div>
        <div className="pt-1">
          <Button size="sm" variant="primary" onClick={onConfigureGoals} className="font-bold uppercase tracking-wider text-xs">
            Set Target Role & Goals
          </Button>
        </div>
      </div>
    );
  }

  const readinessInfo = profile?.statedReadiness
    ? READINESS_LABEL[profile.statedReadiness]
    : { label: 'Unspecified', variant: 'default' as const };

  return (
    <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-subtle">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
              CAREER TRAJECTORY
            </span>
            {activeRole?.priority === 'primary' && (
              <Badge variant="presence" size="sm">
                PRIMARY GOAL
              </Badge>
            )}
            <Badge variant={readinessInfo.variant} size="sm">
              {readinessInfo.label}
            </Badge>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground uppercase truncate">
            {activeRole?.title || 'Staff Software Engineer'}
          </h2>

          {profile?.headline && (
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              {profile.headline}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {targetRoles.length > 1 && (
            <select
              value={activeRoleId || ''}
              onChange={(e) => onSelectRole(e.target.value)}
              className="text-xs bg-surface border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Select Target Role"
            >
              {targetRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.title} {role.priority === 'primary' ? '(Primary)' : ''}
                </option>
              ))}
            </select>
          )}

          <Button variant="secondary" size="sm" onClick={onConfigureGoals} className="font-semibold text-xs">
            Edit Goals
          </Button>
        </div>
      </div>

      {/* Role Details Grid */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-surface-muted/60 border border-border">
          <span className="text-muted-foreground block text-[10px] font-mono uppercase tracking-widest font-bold">
            Role Family
          </span>
          <span className="font-bold text-foreground mt-0.5 block truncate">
            {formatRoleFamily(activeRole?.roleFamily)}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-surface-muted/60 border border-border">
          <span className="text-muted-foreground block text-[10px] font-mono uppercase tracking-widest font-bold">
            Seniority
          </span>
          <span className="font-bold text-foreground mt-0.5 block truncate">
            {formatSeniority(activeRole?.seniorityLevel)}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-surface-muted/60 border border-border">
          <span className="text-muted-foreground block text-[10px] font-mono uppercase tracking-widest font-bold">
            Timeline
          </span>
          <span className="font-bold text-foreground mt-0.5 block truncate font-mono">
            {profile?.targetTimelineMonths ? `${profile.targetTimelineMonths} Months` : '3-6 Months'}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-surface-muted/60 border border-border">
          <span className="text-muted-foreground block text-[10px] font-mono uppercase tracking-widest font-bold">
            Company Tiers
          </span>
          <span className="font-bold text-foreground mt-0.5 block truncate">
            {activeRole?.targetCompanyTypes && activeRole.targetCompanyTypes.length > 0
              ? activeRole.targetCompanyTypes.map((t) => t.replace(/_/g, ' ')).join(', ')
              : 'Tier 1 / High Growth'}
          </span>
        </div>
      </div>
    </div>
  );
}
