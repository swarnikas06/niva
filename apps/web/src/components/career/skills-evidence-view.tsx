'use client';

import React, { useState } from 'react';
import {
  TargetRoleSkillDto,
  UserSkillDto,
  SkillImportance,
} from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EvidenceTraceabilityDrawer } from './evidence-traceability-drawer';

interface SkillsEvidenceViewProps {
  roleSkills: TargetRoleSkillDto[];
  userSkills: UserSkillDto[];
  targetRoleTitle?: string;
  onPracticeSkill: (skillId: string) => void;
  onRefresh: () => void;
}

const IMPORTANCE_BADGE: Record<
  SkillImportance,
  { label: string; variant: 'danger' | 'warning' | 'default' }
> = {
  mandatory: { label: 'Mandatory', variant: 'danger' },
  high_priority: { label: 'High Priority', variant: 'warning' },
  nice_to_have: { label: 'Nice to Have', variant: 'default' },
};

const PROFICIENCY_RANK: Record<string, number> = {
  none: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

export function SkillsEvidenceView({
  roleSkills,
  userSkills,
  targetRoleTitle = 'Target Role',
  onPracticeSkill,
  onRefresh,
}: SkillsEvidenceViewProps) {
  const [filterImportance, setFilterImportance] = useState<string>('all');
  const [selectedSkillForDrawer, setSelectedSkillForDrawer] = useState<{
    skillId: string;
    skillName: string;
    category?: string;
    importance?: string;
    requiredProficiency?: string;
    userSkill: UserSkillDto | null;
  } | null>(null);

  // Map user skills by skillId
  const userSkillMap = new Map<string, UserSkillDto>();
  for (const us of userSkills) {
    userSkillMap.set(us.skillId, us);
  }

  // Filter skills
  const filteredSkills = roleSkills.filter((rs) => {
    if (filterImportance === 'all') return true;
    return rs.importance === filterImportance;
  });

  // Calculate status for each required skill
  const getSkillStatus = (rs: TargetRoleSkillDto, us: UserSkillDto | undefined) => {
    const requiredRank = PROFICIENCY_RANK[rs.minimumProficiency] ?? 2;
    const userRank = (us?.selfRating && PROFICIENCY_RANK[us.selfRating] !== undefined) ? PROFICIENCY_RANK[us.selfRating]! : 0;
    const evidenceList = us?.evidence || [];
    const hasNivaValidation = evidenceList.some((e) => e.validationStatus === 'validated_by_niva');
    const hasDemonstrated = evidenceList.some((e) => e.validationStatus === 'demonstrated' || e.validationStatus === 'validated_by_niva');

    if (hasNivaValidation) {
      return {
        badge: 'Validated by NIVA',
        variant: 'success' as const,
        description: 'Demonstrated mastery in evaluated mock rounds.',
      };
    }
    if (hasDemonstrated) {
      return {
        badge: 'Demonstrated',
        variant: 'presence' as const,
        description: 'Verified with tangible artifact or production spec.',
      };
    }
    if (userRank >= requiredRank && evidenceList.length === 0) {
      return {
        badge: 'Claimed (No Evidence)',
        variant: 'warning' as const,
        description: 'Self-assessed but discounted until evidence is provided.',
      };
    }
    if (userRank > 0 && userRank < requiredRank) {
      return {
        badge: 'Developing',
        variant: 'default' as const,
        description: `Current proficiency (${us?.selfRating}) below benchmark (${rs.minimumProficiency}).`,
      };
    }
    return {
      badge: 'Unassessed',
      variant: 'default' as const,
      description: 'Not yet self-assessed or benchmarked.',
    };
  };

  return (
    <div className="space-y-5">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Target Role Requirements & Evidence Base
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Benchmarks required for {targetRoleTitle}. Distinguishes claimed skills from verified artifacts.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Requirements' },
            { id: 'mandatory', label: 'Mandatory' },
            { id: 'high_priority', label: 'High Priority' },
            { id: 'nice_to_have', label: 'Nice to Have' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterImportance(tab.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filterImportance === tab.id
                  ? 'bg-surface border border-border text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requirements List */}
      {filteredSkills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground space-y-2">
          <p>No skill requirements linked for this filter.</p>
          <p className="text-[11px]">
            Requirements are derived from your target role configuration.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredSkills.map((rs) => {
            const userSkill = userSkillMap.get(rs.skillId);
            const status = getSkillStatus(rs, userSkill);
            const importanceBadge = IMPORTANCE_BADGE[rs.importance as SkillImportance] || {
              label: rs.importance,
              variant: 'default' as const,
            };
            const evidenceCount = userSkill?.evidence?.length || 0;

            return (
              <div
                key={rs.id}
                className="rounded-xl border border-border bg-card p-4 sm:p-5 hover:border-border/80 transition-colors shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-foreground truncate">
                        {rs.skillName || 'Target Requirement'}
                      </h4>
                      <Badge variant={importanceBadge.variant} size="sm">
                        {importanceBadge.label}
                      </Badge>
                      <Badge variant={status.variant} size="sm">
                        {status.badge}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {status.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setSelectedSkillForDrawer({
                          skillId: rs.skillId,
                          skillName: rs.skillName || 'Target Requirement',
                          category: rs.skillCategory,
                          importance: rs.importance,
                          requiredProficiency: rs.minimumProficiency,
                          userSkill: userSkill || null,
                        })
                      }
                    >
                      {evidenceCount > 0 ? `Evidence (${evidenceCount})` : 'Inspect / Add Proof'}
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => onPracticeSkill(rs.skillId)}
                    >
                      Practice with NIVA
                    </Button>
                  </div>
                </div>

                {/* Sub-grid with Benchmarks */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40 text-xs">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Required</span>
                    <span className="font-medium text-foreground capitalize">
                      {rs.minimumProficiency}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-muted-foreground block">Self Assessment</span>
                    <span className="font-medium text-foreground capitalize">
                      {userSkill?.selfRating || 'Not set'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-muted-foreground block">Evidence Base</span>
                    <span className="font-medium text-foreground">
                      {evidenceCount === 0 ? '0 artifacts' : `${evidenceCount} artifact(s)`}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-muted-foreground block">Category</span>
                    <span className="font-medium text-foreground truncate block">
                      {(rs.skillCategory || 'core_technical').replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Traceability Drawer */}
      {selectedSkillForDrawer && (
        <EvidenceTraceabilityDrawer
          isOpen={Boolean(selectedSkillForDrawer)}
          onClose={() => setSelectedSkillForDrawer(null)}
          onUpdated={() => {
            onRefresh();
            setSelectedSkillForDrawer(null);
          }}
          userSkill={selectedSkillForDrawer.userSkill}
          skillName={selectedSkillForDrawer.skillName}
          category={selectedSkillForDrawer.category}
          requiredProficiency={selectedSkillForDrawer.requiredProficiency}
          importance={selectedSkillForDrawer.importance}
        />
      )}
    </div>
  );
}
