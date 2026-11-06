'use client';

import React, { useState } from 'react';
import { StudyTopicDto, TopicProgressStatus } from '@niva/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface StudyTopicsViewProps {
  topics: StudyTopicDto[];
  onStartStudy: (topicId: string) => void;
  onRecordDifficulty: (topic: StudyTopicDto) => void;
  onEditTopic: (topic: StudyTopicDto) => void;
  onDeleteTopic: (topicId: string) => void;
  onAddNewTopic: () => void;
  isLoading?: boolean;
}

const STATUS_BADGE_VARIANT: Record<
  TopicProgressStatus,
  { label: string; variant: 'default' | 'presence' | 'warning' | 'success' | 'danger' }
> = {
  not_started: { label: 'Not Started', variant: 'default' },
  in_progress: { label: 'In Progress', variant: 'presence' },
  practiced: { label: 'Practiced', variant: 'presence' },
  demonstrated: { label: 'Demonstrated', variant: 'success' },
  needs_review: { label: 'Needs Review', variant: 'warning' },
};

export function StudyTopicsView({
  topics,
  onStartStudy,
  onRecordDifficulty,
  onEditTopic,
  onDeleteTopic,
  onAddNewTopic,
}: StudyTopicsViewProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Extract unique subjects
  const subjects = Array.from(new Set(topics.map((t) => t.subjectName))).sort();

  // Filter topics
  const filteredTopics = topics.filter((t) => {
    if (selectedSubject !== 'all' && t.subjectName !== selectedSubject) return false;
    if (selectedStatus !== 'all' && t.status !== selectedStatus) return false;
    return true;
  });

  // Group by subject
  const groupedBySubject = new Map<string, StudyTopicDto[]>();
  for (const t of filteredTopics) {
    const list = groupedBySubject.get(t.subjectName) || [];
    list.push(t);
    groupedBySubject.set(t.subjectName, list);
  }

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Learning Domains & Topics
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Structured learning objectives, verified proficiencies, and prerequisite dependencies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onAddNewTopic} variant="primary">
            <svg
              className="w-3.5 h-3.5 mr-1.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Topic
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground mr-1">Subject:</span>
        <button
          type="button"
          onClick={() => setSelectedSubject('all')}
          className={`px-2.5 py-1 text-xs rounded-md font-mono transition-colors cursor-pointer ${
            selectedSubject === 'all'
              ? 'bg-primary text-white font-semibold shadow-xs'
              : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          All ({topics.length})
        </button>
        {subjects.map((sub) => (
          <button
            key={sub}
            type="button"
            onClick={() => setSelectedSubject(sub)}
            className={`px-2.5 py-1 text-xs rounded-md font-mono transition-colors cursor-pointer ${
              selectedSubject === sub
                ? 'bg-primary text-white font-semibold shadow-xs'
                : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {sub} ({topics.filter((t) => t.subjectName === sub).length})
          </button>
        ))}

        <div className="h-4 w-px bg-border mx-2 hidden sm:block"></div>

        <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground mr-1">Status:</span>
        {['all', 'in_progress', 'needs_review', 'demonstrated', 'not_started'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setSelectedStatus(st)}
            className={`px-2.5 py-1 text-xs rounded-md capitalize font-mono transition-colors cursor-pointer ${
              selectedStatus === st
                ? 'bg-brand-indigo text-white font-semibold shadow-xs'
                : 'bg-surface border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Topics List */}
      {filteredTopics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            No study topics match the selected filters.
          </p>
          <Button size="sm" onClick={onAddNewTopic} variant="secondary">
            Create First Topic
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedBySubject.entries()).map(([subject, subjectTopics]) => (
            <div key={subject} className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  {subject}
                </h4>
                <span className="text-xs text-muted-foreground">
                  ({subjectTopics.length} topic{subjectTopics.length === 1 ? '' : 's'})
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {subjectTopics.map((topic) => {
                  const statusInfo =
                    STATUS_BADGE_VARIANT[topic.status] || STATUS_BADGE_VARIANT.not_started;
                  const unmetPrereqs = (topic.prerequisites || []).filter(
                    (p) => p.status !== 'demonstrated' && p.status !== 'practiced',
                  );

                  return (
                    <div
                      key={topic.id}
                      className="rounded-xl border border-border bg-card p-4 sm:p-5 hover:border-border/80 transition-colors shadow-2xs space-y-3.5"
                    >
                      {/* Top Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-base font-semibold text-foreground">
                              {topic.title}
                            </h5>
                            <Badge variant={statusInfo.variant} size="sm">
                              {statusInfo.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Target: <strong className="capitalize">{topic.targetProficiency}</strong>
                            </span>
                            {topic.demonstratedProficiency && (
                              <Badge variant="success" size="sm" className="capitalize">
                                Verified {topic.demonstratedProficiency}
                              </Badge>
                            )}
                            {unmetPrereqs.length > 0 && (
                              <Badge variant="warning" size="sm">
                                {unmetPrereqs.length} Unmet Prereq{unmetPrereqs.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          {topic.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                              {topic.description}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => onStartStudy(topic.id)}
                          >
                            Study Now
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onRecordDifficulty(topic)}
                            title="Record a concept difficulty or confusion"
                          >
                            Log Difficulty
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onEditTopic(topic)}
                          >
                            Edit
                          </Button>
                          {onDeleteTopic && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onDeleteTopic(topic.id)}
                              className="text-muted-foreground hover:text-danger"
                              title="Delete topic"
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Learning Objectives */}
                      {topic.learningObjectives && topic.learningObjectives.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                          <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Learning Objectives:
                          </span>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-foreground/90">
                            {topic.learningObjectives.map((obj, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-muted-foreground shrink-0 mt-0.5">•</span>
                                <span>{obj}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Prerequisites & Linkages */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-2">
                          {topic.prerequisites && topic.prerequisites.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-2xs font-medium uppercase">Prerequisites:</span>
                              {topic.prerequisites.map((p) => {
                                const isMet = p.status === 'demonstrated' || p.status === 'practiced';
                                return (
                                  <Badge
                                    key={p.id}
                                    variant={isMet ? 'default' : 'warning'}
                                    size="sm"
                                  >
                                    {p.title} {isMet ? '✓' : '(Pending)'}
                                  </Badge>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-2xs text-muted-foreground">
                              No prerequisite dependencies
                            </span>
                          )}
                        </div>

                        {/* Linked Career Skill or Life Goal */}
                        <div className="flex items-center gap-2">
                          {topic.linkedSkillName && (
                            <span className="inline-flex items-center gap-1 text-2xs text-presence font-medium">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
                                />
                              </svg>
                              Career Skill: {topic.linkedSkillName}
                            </span>
                          )}
                          {topic.linkedGoalTitle && (
                            <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                              Goal: {topic.linkedGoalTitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
