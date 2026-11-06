'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/auth-client';
import { ProactiveActionDto } from '@niva/shared-types';
import { Button } from '@/components/ui/button';

export function ProactiveBanner() {
  const [actions, setActions] = useState<ProactiveActionDto[]>([]);
  const [isDismissing, setIsDismissing] = useState<string | null>(null);

  const fetchActions = useCallback(async () => {
    try {
      const data = await authFetch<ProactiveActionDto[]>('/proactive/actions?status=delivered&limit=3');
      if (Array.isArray(data)) {
        setActions(data);
      }
    } catch {
      // Fail silently if not authenticated or network error
    }
  }, []);

  useEffect(() => {
    fetchActions();
    // Poll gently every 30 seconds for newly delivered proactive actions
    const interval = setInterval(fetchActions, 30000);
    return () => clearInterval(interval);
  }, [fetchActions]);

  const handleDismiss = async (actionId: string) => {
    setIsDismissing(actionId);
    try {
      await authFetch(`/proactive/actions/${actionId}/dismiss`, { method: 'POST' });
      setActions((prev) => prev.filter((a) => a.id !== actionId));
    } catch {
      // Keep in list on error
    } finally {
      setIsDismissing(null);
    }
  };

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="px-4 sm:px-6 pt-4 space-y-2.5">
      {actions.map((action) => (
        <div
          key={action.id}
          className="p-4 rounded-xl border border-primary/30 bg-surface shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-muted border border-border text-primary flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.822-.962 4.095 4.095 0 00.354-1.253A8.995 8.995 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-foreground tracking-tight">{action.title}</h4>
                <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-widest px-1.5 py-0.5 rounded bg-surface border border-primary/30">
                  Companion Check-in
                </span>
              </div>
              <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{action.content}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDismiss(action.id)}
              disabled={isDismissing === action.id}
              className="text-xs h-7 px-3"
            >
              {isDismissing === action.id ? 'Dismissing...' : 'Dismiss'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
