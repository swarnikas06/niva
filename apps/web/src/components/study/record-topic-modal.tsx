'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  StudyTopicDto,
  CreateStudyTopicDto,
  UpdateStudyTopicDto,
  TopicProgressStatus,
  StudyProficiencyLevel,
} from '@niva/shared-types';

export interface RecordTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic?: StudyTopicDto | null;
  existingTopics: StudyTopicDto[];
  careerSkills?: Array<{ id: string; name: string }>;
  lifeGoals?: Array<{ id: string; title: string }>;
  onSave: (data: CreateStudyTopicDto | UpdateStudyTopicDto) => Promise<void>;
  isSaving?: boolean;
}

export function RecordTopicModal({
  isOpen,
  onClose,
  topic,
  existingTopics,
  careerSkills = [],
  lifeGoals = [],
  onSave,
  isSaving = false,
}: RecordTopicModalProps) {
  const isEditing = !!topic;

  const [subjectName, setSubjectName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetProficiency, setTargetProficiency] = useState<StudyProficiencyLevel>('intermediate');
  const [status, setStatus] = useState<TopicProgressStatus>('not_started');
  const [demonstratedProficiency, setDemonstratedProficiency] = useState<StudyProficiencyLevel | ''>('');
  const [objectives, setObjectives] = useState<string[]>(['']);
  const [selectedPrereqIds, setSelectedPrereqIds] = useState<string[]>([]);
  const [linkedSkillId, setLinkedSkillId] = useState<string>('');
  const [linkedGoalId, setLinkedGoalId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (topic) {
      setSubjectName(topic.subjectName || '');
      setTitle(topic.title || '');
      setDescription(topic.description || '');
      setTargetProficiency(topic.targetProficiency || 'intermediate');
      setStatus(topic.status || 'not_started');
      setDemonstratedProficiency(topic.demonstratedProficiency || '');
      setObjectives(topic.learningObjectives && topic.learningObjectives.length > 0 ? topic.learningObjectives : ['']);
      setSelectedPrereqIds((topic.prerequisites || []).map((p) => p.id));
      setLinkedSkillId(topic.linkedSkillId || '');
      setLinkedGoalId(topic.linkedGoalId || '');
    } else {
      setSubjectName('');
      setTitle('');
      setDescription('');
      setTargetProficiency('intermediate');
      setStatus('not_started');
      setDemonstratedProficiency('');
      setObjectives(['']);
      setSelectedPrereqIds([]);
      setLinkedSkillId('');
      setLinkedGoalId('');
    }
    setErrorMsg(null);
  }, [topic, isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSaving) {
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
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const handleAddObjective = () => {
    setObjectives([...objectives, '']);
  };

  const handleObjectiveChange = (index: number, val: string) => {
    const updated = [...objectives];
    updated[index] = val;
    setObjectives(updated);
  };

  const handleRemoveObjective = (index: number) => {
    if (objectives.length <= 1) {
      setObjectives(['']);
      return;
    }
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  const handleTogglePrereq = (id: string) => {
    if (selectedPrereqIds.includes(id)) {
      setSelectedPrereqIds(selectedPrereqIds.filter((p) => p !== id));
    } else {
      setSelectedPrereqIds([...selectedPrereqIds, id]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!subjectName.trim()) {
      setErrorMsg('Subject name is required.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Topic title is required.');
      return;
    }

    const cleanedObjectives = objectives.map((o) => o.trim()).filter(Boolean);

    try {
      if (isEditing) {
        const updatePayload: UpdateStudyTopicDto = {
          subjectName: subjectName.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
          targetProficiency,
          status,
          demonstratedProficiency: (demonstratedProficiency as StudyProficiencyLevel) || undefined,
          learningObjectives: cleanedObjectives,
          prerequisiteTopicIds: selectedPrereqIds,
          linkedSkillId: linkedSkillId || undefined,
          linkedGoalId: linkedGoalId || undefined,
        };
        await onSave(updatePayload);
      } else {
        const createPayload: CreateStudyTopicDto = {
          subjectName: subjectName.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
          targetProficiency,
          learningObjectives: cleanedObjectives,
          prerequisiteTopicIds: selectedPrereqIds,
          linkedSkillId: linkedSkillId || undefined,
          linkedGoalId: linkedGoalId || undefined,
        };
        await onSave(createPayload);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save topic';
      setErrorMsg(msg);
    }
  };

  const availablePrereqs = existingTopics.filter((t) => !topic || t.id !== topic.id);

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!isSaving) onClose();
        }}
        aria-hidden="true"
      />

      <div className="relative bg-card border border-border w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-5 my-8 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {isEditing ? 'Edit Learning Topic' : 'Add Learning Topic'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define the domain, target proficiency, and learning objectives.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-md"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-xs text-danger">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subject & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Subject / Domain *</label>
              <input
                type="text"
                placeholder="e.g. Distributed Systems"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Topic Title *</label>
              <input
                type="text"
                placeholder="e.g. Raft Consensus Algorithm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Description & Context</label>
            <textarea
              rows={2}
              placeholder="What core mechanisms or principles need to be mastered?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
            />
          </div>

          {/* Target Proficiency & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Target Proficiency</label>
              <select
                value={targetProficiency}
                onChange={(e) => setTargetProficiency(e.target.value as StudyProficiencyLevel)}
                className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            {isEditing ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Progress Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TopicProgressStatus)}
                  className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="practiced">Practiced</option>
                  <option value="demonstrated">Demonstrated (Requires Evidence)</option>
                  <option value="needs_review">Needs Review</option>
                </select>
              </div>
            ) : null}
          </div>

          {/* Learning Objectives */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Learning Objectives</label>
              <button
                type="button"
                onClick={handleAddObjective}
                className="text-2xs text-presence hover:underline font-medium"
              >
                + Add Objective
              </button>
            </div>
            <div className="space-y-1.5">
              {objectives.map((obj, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Objective ${idx + 1}`}
                    value={obj}
                    onChange={(e) => handleObjectiveChange(idx, e.target.value)}
                    className="flex-1 text-xs rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveObjective(idx)}
                    className="text-muted-foreground hover:text-danger text-xs px-1"
                    title="Remove objective"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Prerequisites */}
          {availablePrereqs.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Prerequisite Topics</label>
              <div className="max-h-28 overflow-y-auto rounded-lg border border-border bg-surface/50 p-2.5 space-y-1.5">
                {availablePrereqs.map((prereq) => (
                  <label
                    key={prereq.id}
                    className="flex items-center gap-2 text-xs text-foreground cursor-pointer hover:text-foreground/90"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPrereqIds.includes(prereq.id)}
                      onChange={() => handleTogglePrereq(prereq.id)}
                      className="rounded border-border text-foreground focus:ring-0"
                    />
                    <span>
                      {prereq.title}{' '}
                      <span className="text-muted-foreground text-2xs">({prereq.subjectName})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Link to Career Skill & Life Goal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Link Career Skill (Optional)</label>
              <select
                value={linkedSkillId}
                onChange={(e) => setLinkedSkillId(e.target.value)}
                className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
              >
                <option value="">None</option>
                {careerSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Link Life Goal (Optional)</label>
              <select
                value={linkedGoalId}
                onChange={(e) => setLinkedGoalId(e.target.value)}
                className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
              >
                <option value="">None</option>
                {lifeGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSaving}
            >
              {isEditing ? 'Save Changes' : 'Create Topic'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
