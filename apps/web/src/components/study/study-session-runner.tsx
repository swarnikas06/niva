'use client';

import React, { useState, useEffect, useRef } from 'react';
import { StudySessionDto, StudyTopicDto } from '@niva/shared-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { authFetch } from '@/lib/auth-client';

export interface StudySessionRunnerProps {
  session: StudySessionDto;
  topic?: StudyTopicDto | null;
  onFinishSession: () => void;
  onAbandonSession: () => void;
  isAbandoning?: boolean;
}

export function StudySessionRunner({
  session,
  topic,
  onFinishSession,
  onAbandonSession,
  isAbandoning = false,
}: StudySessionRunnerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [quickNote, setQuickNote] = useState<string>(session.userNotes || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Debounced auto-save scratchpad note to session
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!session?.id) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSaveStatus('saving');
    debounceTimerRef.current = setTimeout(async () => {
      if (!session?.id) return;
      try {
        await authFetch(`/study/sessions/${session.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ userNotes: quickNote }),
        });
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('error');
      }
    }, 700);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [quickNote, session.id]);

  useEffect(() => {
    const rawStartMs = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const startMs = isNaN(rawStartMs) ? Date.now() : rawStartMs;

    const updateTimer = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - startMs) / 1000));
      setElapsedSeconds(isNaN(diffSec) ? 0 : diffSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [session.startedAt]);

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  const formattedTime =
    hours > 0
      ? `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      : `${minutes.toString().padStart(2, '0')}:${seconds
          .toString()
          .padStart(2, '0')}`;

  return (
    <div className="rounded-xl border border-primary/40 bg-surface p-5 sm:p-6 shadow-subtle space-y-5 animate-in fade-in duration-200">
      {/* Top Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">
              ACTIVE STUDY SESSION
            </span>
            <Badge variant="presence" size="sm" className="font-mono text-xs">
              {formattedTime}
            </Badge>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground uppercase tracking-tight">
            {session.topicTitle || topic?.title || 'Active Topic'}
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            Domain: <strong className="text-foreground">{session.subjectName || topic?.subjectName}</strong>
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={onAbandonSession}
            disabled={isAbandoning}
            className="text-muted-foreground hover:text-danger text-xs font-semibold"
          >
            Abandon
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onFinishSession}
            className="font-bold uppercase tracking-wider text-xs"
          >
            Complete Session
          </Button>
        </div>
      </div>

      {/* Focus & Context Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Objectives */}
        <div className="md:col-span-2 space-y-2 rounded-lg border border-border bg-surface-muted/50 p-4">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground block">
            TARGET LEARNING OBJECTIVES
          </span>
          {topic?.learningObjectives && topic.learningObjectives.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-foreground">
              {topic.learningObjectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              No specific objectives defined. Focus on core conceptual clarity and practical implementation.
            </p>
          )}

          {/* Alignment */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-[10px] font-mono text-muted-foreground border-t border-border">
            {topic?.linkedSkillName && (
              <span className="inline-flex items-center gap-1 text-primary font-bold">
                🎯 Required for Career Skill: {topic.linkedSkillName}
              </span>
            )}
            {topic?.linkedGoalTitle && (
              <span className="inline-flex items-center gap-1 text-foreground">
                ⭐ Supports Life Goal: {topic.linkedGoalTitle}
              </span>
            )}
          </div>
        </div>

        {/* Study Scratchpad */}
        <div className="space-y-2 rounded-lg border border-border bg-surface-muted/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
              LIVE SCRATCHPAD
            </span>
            {saveStatus === 'saving' && (
              <span className="text-[9px] font-mono text-primary font-bold animate-pulse">Saving...</span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-[9px] font-mono text-primary">✓ Saved</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-[9px] font-mono text-danger">Save failed</span>
            )}
            {saveStatus === 'idle' && (
              <span className="text-[9px] font-mono text-muted-foreground">Auto-saved to session</span>
            )}
          </div>
          <textarea
            rows={4}
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="Jot down quick thoughts, formulas, or questions for NIVA (auto-saved to this session)..."
            className="w-full text-xs rounded-lg border border-border bg-surface px-2.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none font-mono"
          />
        </div>
      </div>
    </div>
  );
}
