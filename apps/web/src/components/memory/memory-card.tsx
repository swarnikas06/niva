'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { MemoryDto, MemoryCategory } from '@niva/shared-types';

export interface MemoryCardProps {
  memory: MemoryDto;
  onSelect: (memory: MemoryDto) => void;
  onForget: (memory: MemoryDto) => void;
}

function getCategoryLabel(category: MemoryCategory): string {
  switch (category) {
    case 'user_preference':
      return 'Preference';
    case 'semantic_fact':
      return 'Fact';
    case 'episodic_event':
      return 'Experience';
    case 'open_loop':
      return 'Revisit';
    default:
      return category;
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function MemoryCard({ memory, onSelect, onForget }: MemoryCardProps) {
  const categoryLabel = getCategoryLabel(memory.category);
  const isExplicit = memory.confidenceType === 'explicit';

  return (
    <article
      onClick={() => onSelect(memory)}
      className="group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border border-border bg-surface hover:border-border-subtle hover:bg-surface-hover/40 transition-all duration-150 cursor-pointer shadow-subtle focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent"
    >
      <div>
        {/* Header badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="neutral" size="sm" className="font-medium text-[11px]">
              {categoryLabel}
            </Badge>

            <span
              className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                isExplicit
                  ? 'bg-surface-muted text-muted-foreground border-border-subtle'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
              )}
            >
              {isExplicit ? 'Told directly' : 'Inferred'}
            </span>

            {memory.reinforcementCount > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/20">
                Reinforced {memory.reinforcementCount}×
              </span>
            )}
          </div>

          {/* Quick Forget button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onForget(memory);
            }}
            title="Forget this memory"
            aria-label={`Forget memory: ${memory.content}`}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 -mr-1.5 -mt-1.5 rounded-lg text-muted-foreground/70 hover:text-danger hover:bg-danger/10 transition-all"
          >
            <svg
              className="w-3.5 h-3.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
              />
            </svg>
          </button>
        </div>

        {/* Memory Content */}
        <p className="text-sm font-normal text-foreground leading-relaxed">
          {memory.content}
        </p>
      </div>

      {/* Footer Timestamp & inspect hint */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border-subtle/50">
        <span>Learned {formatDate(memory.createdAt)}</span>
        <span className="text-[10px] text-muted-foreground/60 group-hover:text-accent transition-colors flex items-center gap-1">
          Details →
        </span>
      </div>
    </article>
  );
}
