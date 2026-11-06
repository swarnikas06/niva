'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export interface MemoryEmptyStateProps {
  isFiltered: boolean;
  onClearFilters?: () => void;
}

export function MemoryEmptyState({ isFiltered, onClearFilters }: MemoryEmptyStateProps) {
  if (isFiltered) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border bg-surface/50 max-w-md mx-auto my-8">
        <div className="w-11 h-11 rounded-xl bg-surface-muted border border-border flex items-center justify-center text-muted-foreground mb-3">
          <svg
            className="w-5 h-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>

        <h3 className="text-sm font-semibold text-foreground mb-1">
          No matching memories
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mb-5 leading-relaxed">
          We couldn&apos;t find any memories matching your search or selected filter.
        </p>

        {onClearFilters && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClearFilters}
          >
            Reset Filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border bg-surface/50 max-w-md mx-auto my-8">
      <div className="w-11 h-11 rounded-xl bg-surface-muted border border-border flex items-center justify-center text-muted-foreground mb-3">
        <svg
          className="w-5 h-5 text-accent"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
        </svg>
      </div>

      <h3 className="text-sm font-semibold text-foreground mb-1">
        No memories yet
      </h3>
      <p className="text-xs text-muted-foreground max-w-sm mb-5 leading-relaxed">
        As you talk with NIVA, your preferences, facts, and open loops will be remembered here to personalize future dialogues.
      </p>

      <Link href="/conversation">
        <Button variant="primary" size="sm">
          Start a Conversation
        </Button>
      </Link>
    </div>
  );
}
