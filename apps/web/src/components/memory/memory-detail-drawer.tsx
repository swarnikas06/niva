'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MemoryDto, MemoryCategory } from '@niva/shared-types';

export interface MemoryDetailDrawerProps {
  memory: MemoryDto | null;
  isOpen: boolean;
  onClose: () => void;
  onForget: (memory: MemoryDto) => void;
}

function getCategoryDetails(category: MemoryCategory): { label: string; description: string } {
  switch (category) {
    case 'user_preference':
      return {
        label: 'User Preference',
        description: 'Personal habits, workflow choices, and communication styles.',
      };
    case 'semantic_fact':
      return {
        label: 'Semantic Fact',
        description: 'Persistent objective knowledge about your life and projects.',
      };
    case 'episodic_event':
      return {
        label: 'Episodic Experience',
        description: 'Events, milestones, and shared moments with NIVA.',
      };
    case 'open_loop':
      return {
        label: 'Open Loop / Revisit',
        description: 'Unresolved thoughts, follow-ups, or questions to revisit.',
      };
    default:
      return { label: category, description: 'Durable memory knowledge.' };
  }
}

function formatFullDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Not recorded';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function MemoryDetailDrawer({
  memory,
  isOpen,
  onClose,
  onForget,
}: MemoryDetailDrawerProps) {
  // Close drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
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
  }, [isOpen, onClose]);

  if (!isOpen || !memory) return null;

  const categoryMeta = getCategoryDetails(memory.category);
  const isExplicit = memory.confidenceType === 'explicit';
  const confidencePercent = Math.round(memory.confidence * 100);

  // Extract rationale or evaluation reason from metadata if present
  const meta = (memory.metadata as Record<string, any>) || {};
  const whyReason =
    meta.evaluationReason ||
    meta.rationale ||
    (isExplicit
      ? 'Explicitly shared by you during conversation. NIVA retains this so you do not need to repeat yourself.'
      : 'Inferred by NIVA based on conversation context to help personalize future dialogues.');

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="memory-drawer-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Body */}
      <div className="relative bg-surface border-l border-border w-full max-w-lg h-full p-6 sm:p-8 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200 z-10">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Badge variant="neutral" size="sm">
                {categoryMeta.label}
              </Badge>
              <span
                className={cn(
                  'text-[11px] font-medium px-2 py-0.5 rounded-full border',
                  isExplicit
                    ? 'bg-surface-muted text-muted-foreground border-border-subtle'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
                )}
              >
                {isExplicit ? 'Explicit statement' : 'Inferred context'}
              </span>
            </div>

            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover text-sm focus-ring"
              aria-label="Close details"
            >
              ✕
            </button>
          </div>

          {/* Statement */}
          <div>
            <h2
              id="memory-drawer-title"
              className="text-lg font-medium text-foreground leading-relaxed"
            >
              {memory.content}
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5">
              {categoryMeta.description}
            </p>
          </div>

          {/* Epistemic Grounding Section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Epistemic Grounding
            </h3>
            <div className="p-3.5 rounded-xl border border-border bg-surface-muted/30 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Epistemic Source</span>
                <span className="font-medium text-foreground">
                  {isExplicit ? 'Directly stated by user' : 'Inferred from context'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-medium text-foreground">{confidencePercent}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Reinforcement Count</span>
                <span className="font-medium text-foreground">
                  {memory.reinforcementCount > 0
                    ? `Reinforced ${memory.reinforcementCount}×`
                    : 'First observed'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Importance Rating</span>
                <span className="font-medium text-foreground">{memory.importance} / 10</span>
              </div>
            </div>
          </section>

          {/* Provenance & History Section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Continuity & Provenance
            </h3>
            <div className="p-3.5 rounded-xl border border-border bg-surface-muted/30 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Learned</span>
                <span className="text-foreground">{formatFullDateTime(memory.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Last Reinforced</span>
                <span className="text-foreground">{formatFullDateTime(memory.lastReinforcedAt)}</span>
              </div>
              {memory.sourceConversationId && (
                <div className="flex justify-between items-center pt-1 border-t border-border-subtle">
                  <span className="text-muted-foreground">Source Conversation</span>
                  <Link
                    href={`/conversation?id=${memory.sourceConversationId}`}
                    className="text-accent hover:underline font-medium truncate max-w-[200px]"
                    title={memory.sourceConversationTitle || 'Conversation'}
                  >
                    {memory.sourceConversationTitle || 'View conversation →'}
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* Why NIVA Remembers This */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Why NIVA Remembers This
            </h3>
            <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-muted/20 text-xs text-muted-foreground leading-relaxed">
              {whyReason}
            </div>
          </section>

          {/* Editorial Note */}
          <p className="text-[11px] text-muted-foreground/70 leading-normal">
            To preserve vector embedding alignment and candidate auditability, memories cannot be edited directly. To change this preference, choose <strong>Forget</strong> or mention your updated preference naturally in conversation.
          </p>
        </div>

        {/* Action Footer */}
        <div className="pt-6 border-t border-border flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => onForget(memory)}
          >
            Forget This Memory
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
