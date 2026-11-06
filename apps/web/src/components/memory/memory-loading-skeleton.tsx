import React from 'react';

export function MemoryLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex flex-col justify-between p-5 rounded-2xl border border-border/60 bg-surface/60 space-y-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-5 w-20 bg-surface-muted rounded-full" />
              <div className="h-4 w-16 bg-surface-muted rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-5/6 bg-surface-muted rounded" />
              <div className="h-4 w-3/4 bg-surface-muted rounded" />
            </div>
          </div>
          <div className="pt-3 border-t border-border-subtle/50 flex justify-between">
            <div className="h-3 w-24 bg-surface-muted rounded" />
            <div className="h-3 w-12 bg-surface-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
