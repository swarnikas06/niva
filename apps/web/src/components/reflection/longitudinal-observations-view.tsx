'use client';

import React, { useState } from 'react';
import {
  LongitudinalObservationDto,
  ObservationCategory,
  ObservationStatus,
} from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface LongitudinalObservationsViewProps {
  observations: LongitudinalObservationDto[];
  onConfirm: (id: string) => Promise<void>;
  onOpenCorrectModal: (obs: LongitudinalObservationDto) => void;
  onDismiss: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function LongitudinalObservationsView({
  observations,
  onConfirm,
  onOpenCorrectModal,
  onDismiss,
  isLoading = false,
}: LongitudinalObservationsViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const statuses = [
    { label: 'Active', value: 'active' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Corrected', value: 'corrected' },
    { label: 'Dismissed', value: 'dismissed' },
    { label: 'All', value: 'all' },
  ];

  const categories = [
    { label: 'All Categories', value: 'all' },
    { label: 'Progress', value: 'progress' },
    { label: 'Learning', value: 'learning_development' },
    { label: 'Career', value: 'career_development' },
    { label: 'Unresolved Threads', value: 'unresolved_thread' },
    { label: 'Intentions vs. Outcomes', value: 'intention_vs_outcome' },
    { label: 'Recurrence', value: 'recurrence' },
    { label: 'Decisions', value: 'decision_follow_up' },
  ];

  const filteredObservations = observations.filter((obs) => {
    if (statusFilter !== 'all' && obs.status !== statusFilter) return false;
    if (selectedCategory !== 'all' && obs.category !== selectedCategory) return false;
    return true;
  });

  const handleConfirm = async (id: string) => {
    try {
      setProcessingId(id);
      await onConfirm(id);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      setProcessingId(id);
      await onDismiss(id);
    } finally {
      setProcessingId(null);
    }
  };

  const getCategoryBadgeVariant = (cat: ObservationCategory) => {
    switch (cat) {
      case 'progress':
        return 'success';
      case 'learning_development':
      case 'career_development':
        return 'presence';
      case 'unresolved_thread':
      case 'intention_vs_outcome':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const getStatusBadge = (status: ObservationStatus) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="success" size="sm">Confirmed</Badge>;
      case 'corrected':
        return <Badge variant="warning" size="sm">User Corrected</Badge>;
      case 'dismissed':
        return <Badge variant="neutral" size="sm">Dismissed</Badge>;
      default:
        return <Badge variant="outline" size="sm">Active Hypothesis</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card">
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {statuses.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                statusFilter === s.value
                  ? 'bg-foreground text-background shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground bg-muted/30'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Category Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Observations List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-card p-5 animate-pulse"></div>
          ))}
        </div>
      ) : filteredObservations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">No longitudinal observations found</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {statusFilter !== 'all'
              ? `No observations with status "${statusFilter}". Try switching filters or click "Synthesize Patterns" above.`
              : 'NIVA will automatically detect patterns across study sessions, tasks, and conversations as you work.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredObservations.map((obs) => {
            const isExpanded = expandedEvidenceId === obs.id;
            const isProcessing = processingId === obs.id;

            return (
              <div
                key={obs.id}
                className="rounded-xl border border-border bg-card p-5 space-y-4 hover:border-foreground/20 transition-colors shadow-xs"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getCategoryBadgeVariant(obs.category)} size="sm">
                        {obs.category.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                      {getStatusBadge(obs.status)}
                      <span className="text-[11px] text-muted-foreground">
                        {Math.round(obs.confidence * 100)}% confidence •{' '}
                        {obs.confidenceType.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-foreground tracking-tight pt-0.5">
                      {obs.title}
                    </h3>
                  </div>

                  <span className="text-[11px] text-muted-foreground self-start shrink-0">
                    Window: {obs.windowDays}d • {new Date(obs.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Fact vs. Interpretation Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Objective Fact */}
                  <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                      Objective Recorded Fact
                    </div>
                    <p className="text-foreground leading-relaxed">{obs.fact}</p>
                  </div>

                  {/* Calibrated Interpretation */}
                  <div className="rounded-lg border border-border bg-muted/10 p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                      Calibrated Interpretation
                    </div>
                    <p className="italic text-muted-foreground leading-relaxed">
                      {obs.interpretation}
                    </p>
                  </div>
                </div>

                {/* User Correction Notes Callout (if corrected) */}
                {obs.status === 'corrected' && obs.userCorrectionNotes && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      Your Explicit Clarification (Inviolable Constraint):
                    </span>
                    <p className="text-foreground font-medium">{obs.userCorrectionNotes}</p>
                    <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 italic">
                      NIVA will strictly avoid repeating assumptions contradicted by this note.
                    </p>
                  </div>
                )}

                {/* Supporting Evidence Drawer */}
                {obs.supportingEvidence && obs.supportingEvidence.length > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setExpandedEvidenceId(isExpanded ? null : obs.id)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-medium transition"
                    >
                      <span className="text-[10px] font-mono">{isExpanded ? '▼' : '▶'}</span>
                      {isExpanded ? 'Hide' : 'View'} Supporting Evidence ({obs.supportingEvidence.length})
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 rounded-lg border border-border bg-muted/20 p-3 space-y-2 text-xs">
                        {obs.supportingEvidence.map((ev, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1.5 border-b border-border/50 last:border-0 last:pb-0"
                          >
                            <div className="space-y-0.5">
                              <span className="font-semibold text-foreground">
                                [{ev.sourceType.replace(/_/g, ' ')}] {ev.label}
                              </span>
                              {ev.snippet && (
                                <p className="text-muted-foreground italic text-[11px]">
                                  &quot;{ev.snippet}&quot;
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(ev.occurredAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                  <div className="text-[11px] text-muted-foreground">
                    Surfaced in context {obs.surfacedCount} time(s)
                    {obs.lastSurfacedAt && (
                      <> • Last: {new Date(obs.lastSurfacedAt).toLocaleDateString()}</>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {obs.status === 'active' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDismiss(obs.id)}
                          disabled={isProcessing}
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenCorrectModal(obs)}
                          disabled={isProcessing}
                        >
                          Correct
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleConfirm(obs.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? 'Confirming...' : 'Confirm Insight'}
                        </Button>
                      </>
                    )}

                    {obs.status === 'confirmed' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ Confirmed on {obs.confirmedAt ? new Date(obs.confirmedAt).toLocaleDateString() : 'earlier'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenCorrectModal(obs)}
                        >
                          Revise Note
                        </Button>
                      </div>
                    )}

                    {obs.status === 'corrected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenCorrectModal(obs)}
                      >
                        Update Correction
                      </Button>
                    )}

                    {obs.status === 'dismissed' && (
                      <span className="text-xs text-muted-foreground italic">
                        Dismissed on {obs.dismissedAt ? new Date(obs.dismissedAt).toLocaleDateString() : 'earlier'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
