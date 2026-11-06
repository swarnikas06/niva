'use client';

import React from 'react';
import { StudySessionDto } from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';

export interface StudyHistoryViewProps {
  sessions: StudySessionDto[];
  isLoading?: boolean;
}

export function StudyHistoryView({ sessions }: StudyHistoryViewProps) {
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">
          Study Session History
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Log of completed study sessions, duration, covered concepts, and demonstrated evidence.
        </p>
      </div>

      {completedSessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            No completed study sessions logged yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {completedSessions.map((session) => {
            const dateStr = session.completedAt
              ? new Date(session.completedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : new Date(session.startedAt).toLocaleDateString();

            return (
              <div
                key={session.id}
                className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-foreground">
                        {session.topicTitle || 'Study Session'}
                      </h4>
                      <Badge variant="default" size="sm">
                        {session.subjectName || 'Study'}
                      </Badge>
                      <Badge variant="outline" size="sm" className="font-mono">
                        {session.durationMinutes ? `${session.durationMinutes} min` : 'Completed'}
                      </Badge>
                    </div>
                    <span className="text-2xs text-muted-foreground">{dateStr}</span>
                  </div>
                </div>

                {/* Session Notes */}
                {session.userNotes && (
                  <p className="text-xs text-foreground/90 leading-relaxed bg-surface/60 rounded-lg p-3 border border-border/50">
                    {session.userNotes}
                  </p>
                )}

                {/* Concepts Understood */}
                {session.conceptsUnderstood && session.conceptsUnderstood.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Concepts Understood:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {session.conceptsUnderstood.map((c, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 rounded text-2xs bg-presence/10 text-presence font-medium"
                        >
                          ✓ {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Difficulties Encountered */}
                {session.difficultiesEncountered && session.difficultiesEncountered.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Difficulties Encountered:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {session.difficultiesEncountered.map((d, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 rounded text-2xs bg-danger/10 text-danger"
                        >
                          ! {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up Actions */}
                {session.followUpActions && session.followUpActions.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Follow-up Actions:
                    </span>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {session.followUpActions.map((act, i) => (
                        <li key={i}>→ {act}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Evidence Notes */}
                {session.evidenceNotes && (
                  <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-xs space-y-0.5">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-success">
                      Demonstrated Evidence
                    </span>
                    <p className="text-foreground/90 italic leading-relaxed">
                      {session.evidenceNotes}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
