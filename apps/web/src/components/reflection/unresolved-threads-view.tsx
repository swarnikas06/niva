'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface UnresolvedThreadsViewProps {
  unresolvedThreads: string[];
  isLoading?: boolean;
}

export function UnresolvedThreadsView({
  unresolvedThreads,
  isLoading = false,
}: UnresolvedThreadsViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-border bg-card p-5 animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-border bg-card space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          Unresolved Threads & Persistent Blockers
        </h3>
        <p className="text-xs text-muted-foreground">
          Items that have persisted across recent sessions without resolution. Surfaced for gentle awareness
          so recurring challenges don&apos;t quietly slip away.
        </p>
      </div>

      {unresolvedThreads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">No active unresolved threads</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            You currently have no persistent learning difficulties or overdue tasks flagged in this window.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {unresolvedThreads.map((thread, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-foreground/20 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold mt-0.5">
                  !
                </span>
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-medium text-foreground leading-relaxed">
                    {thread}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Persistent across current reflection horizon. Consider breaking this down or reviewing notes.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                {thread.includes('Learning difficulty') ? (
                  <Link href="/study">
                    <Button size="sm" variant="outline">
                      Review in Study
                    </Button>
                  </Link>
                ) : (
                  <Link href="/life">
                    <Button size="sm" variant="outline">
                      Manage in Life
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
