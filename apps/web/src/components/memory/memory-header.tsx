import React from 'react';

export function MemoryHeader() {
  return (
    <header className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Memory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preferences, facts, and open loops NIVA has learned across your conversations.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/80" />
          <span>Active & Grounded</span>
        </div>
      </div>
    </header>
  );
}
