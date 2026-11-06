'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { authFetch } from '@/lib/auth-client';
import { PageContainer } from '@/components/ui/page-container';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import {
  StudyOverviewCard,
  StudyTopicsView,
  RecordTopicModal,
  CompleteSessionModal,
  StudySessionRunner,
  LearningDifficultiesView,
  RecordDifficultyModal,
  StudyRecommendationsView,
  StudyHistoryView,
} from '@/components/study';
import {
  StudyOverviewSummaryDto,
  StudyTopicDto,
  StudySessionDto,
  LearningDifficultyDto,
  StudyRecommendationDto,
  CreateStudyTopicDto,
  UpdateStudyTopicDto,
  CompleteStudySessionDto,
  CreateLearningDifficultyDto,
} from '@niva/shared-types';

type ActiveTab = 'focus' | 'topics' | 'difficulties' | 'history';

export default function StudyPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Core Data
  const [overview, setOverview] = useState<StudyOverviewSummaryDto | null>(null);
  const [topics, setTopics] = useState<StudyTopicDto[]>([]);
  const [sessions, setSessions] = useState<StudySessionDto[]>([]);
  const [difficulties, setDifficulties] = useState<LearningDifficultyDto[]>([]);
  const [recommendations, setRecommendations] = useState<StudyRecommendationDto[]>([]);
  const [activeSession, setActiveSession] = useState<StudySessionDto | null>(null);
  const [careerSkills, setCareerSkills] = useState<Array<{ id: string; name: string }>>([]);
  const [lifeGoals, setLifeGoals] = useState<Array<{ id: string; title: string }>>([]);

  // UI State
  const [activeTab, setActiveTab] = useState<ActiveTab>('focus');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals & Action States
  const [isRecordTopicOpen, setIsRecordTopicOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<StudyTopicDto | null>(null);
  const [isCompleteSessionOpen, setIsCompleteSessionOpen] = useState(false);
  const [isRecordDifficultyOpen, setIsRecordDifficultyOpen] = useState(false);
  const [preselectedDifficultyTopicId, setPreselectedDifficultyTopicId] = useState<string | undefined>(undefined);
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [isCompletingSession, setIsCompletingSession] = useState(false);
  const [isSavingDifficulty, setIsSavingDifficulty] = useState(false);
  const [isAbandoningSession, setIsAbandoningSession] = useState(false);

  // Fetch all study intelligence data
  const fetchAllData = useCallback(async () => {
    if (!isAuthenticated) return;
    setError(null);

    try {
      const [
        overviewRes,
        topicsRes,
        sessionsRes,
        difficultiesRes,
        recsRes,
        activeRes,
        skillsRes,
        goalsRes,
      ] = await Promise.all([
        authFetch<StudyOverviewSummaryDto>('/study/overview').catch(() => null),
        authFetch<StudyTopicDto[]>('/study/topics').catch(() => []),
        authFetch<StudySessionDto[]>('/study/sessions').catch(() => []),
        authFetch<LearningDifficultyDto[]>('/study/difficulties').catch(() => []),
        authFetch<StudyRecommendationDto[]>('/study/recommendations').catch(() => []),
        authFetch<StudySessionDto | null>('/study/sessions/active').catch(() => null),
        authFetch<Array<{ id: string; name: string }>>('/career/user-skills').catch(() => []),
        authFetch<Array<{ id: string; title: string }>>('/life/goals').catch(() => []),
      ]);

      setOverview(overviewRes);
      setTopics(topicsRes || []);
      setSessions(sessionsRes || []);
      setDifficulties(difficultiesRes || []);
      setRecommendations(recsRes || []);
      setActiveSession(activeRes || overviewRes?.activeSession || null);
      setCareerSkills(
        (skillsRes || []).map((s: any) => ({
          id: s.id,
          name: s.skill?.name || s.name || 'Skill',
        })),
      );
      setLifeGoals(
        (goalsRes || []).map((g: any) => ({
          id: g.id,
          title: g.title,
        })),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load study intelligence.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    }
  }, [isAuthenticated, fetchAllData]);

  // Notice helper
  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4500);
  };

  // Start study session
  const handleStartStudy = async (topicId?: string) => {
    try {
      const targetTopicId = topicId || (recommendations[0]?.topicId) || (topics[0]?.id);
      if (!targetTopicId) {
        showNotice('Please create a topic first to start a study session.');
        setIsRecordTopicOpen(true);
        return;
      }

      const session = await authFetch<StudySessionDto>('/study/sessions', {
        method: 'POST',
        body: JSON.stringify({ topicId: targetTopicId }),
      });

      setActiveSession(session);
      showNotice(`Study session started for "${session.topicTitle || 'Topic'}".`);
      fetchAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not start study session.';
      setError(msg);
    }
  };

  // Abandon active session
  const handleAbandonSession = async () => {
    if (!activeSession) return;
    if (!window.confirm('Are you sure you want to abandon the current study session?')) return;

    try {
      setIsAbandoningSession(true);
      await authFetch(`/study/sessions/${activeSession.id}/cancel`, {
        method: 'POST',
      });
      setActiveSession(null);
      showNotice('Study session abandoned.');
      fetchAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not cancel study session.';
      setError(msg);
    } finally {
      setIsAbandoningSession(false);
    }
  };

  // Complete active session
  const handleCompleteSession = async (data: CompleteStudySessionDto) => {
    if (!activeSession) return;
    try {
      setIsCompletingSession(true);
      await authFetch(`/study/sessions/${activeSession.id}/complete`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setIsCompleteSessionOpen(false);
      setActiveSession(null);
      showNotice('Study session completed and recorded to knowledge history.');
      fetchAllData();
    } finally {
      setIsCompletingSession(false);
    }
  };

  // Topic Save
  const handleSaveTopic = async (payload: CreateStudyTopicDto | UpdateStudyTopicDto) => {
    try {
      setIsSavingTopic(true);
      if (editingTopic) {
        await authFetch(`/study/topics/${editingTopic.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showNotice(`Topic "${payload.title}" updated.`);
      } else {
        await authFetch('/study/topics', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showNotice(`Topic "${payload.title}" created.`);
      }
      setIsRecordTopicOpen(false);
      setEditingTopic(null);
      fetchAllData();
    } finally {
      setIsSavingTopic(false);
    }
  };

  // Delete Topic
  const handleDeleteTopic = async (topicId: string) => {
    if (!window.confirm('Are you sure you want to delete this topic and its history?')) return;
    try {
      await authFetch(`/study/topics/${topicId}`, {
        method: 'DELETE',
      });
      showNotice('Topic deleted.');
      fetchAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not delete topic.';
      setError(msg);
    }
  };

  // Record Difficulty
  const handleSaveDifficulty = async (payload: CreateLearningDifficultyDto) => {
    try {
      setIsSavingDifficulty(true);
      await authFetch('/study/difficulties', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setIsRecordDifficultyOpen(false);
      setPreselectedDifficultyTopicId(undefined);
      showNotice(`Difficulty recorded for "${payload.concept}".`);
      fetchAllData();
    } finally {
      setIsSavingDifficulty(false);
    }
  };

  // Resolve Difficulty
  const handleResolveDifficulty = async (id: string, resolutionNotes?: string) => {
    try {
      await authFetch(`/study/difficulties/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolutionNotes }),
      });
      showNotice('Difficulty resolved and archived.');
      fetchAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not resolve difficulty.';
      setError(msg);
    }
  };

  // Add recommendation to Life Tasks (Life Context single authority)
  const handleAddToLifeTasks = async (rec: StudyRecommendationDto) => {
    try {
      await authFetch('/life/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: `Study: ${rec.topicTitle}`,
          description: `${rec.what} — ${rec.why}`,
          priority: rec.priority === 'critical' ? 'high' : rec.priority === 'high' ? 'medium' : 'low',
        }),
      });
      showNotice(`Added "${rec.topicTitle}" to Life Tasks.`);
      fetchAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not add to life tasks.';
      setError(msg);
    }
  };

  if (authLoading || (isLoading && !overview)) {
    return (
      <PageContainer>
        <LoadingState message="Loading study intelligence and learning models..." />
      </PageContainer>
    );
  }

  if (error && !overview) {
    return (
      <PageContainer>
        <ErrorState
          title="Could not load study intelligence"
          message={error}
          onRetry={fetchAllData}
        />
      </PageContainer>
    );
  }

  const activeTopicObj = activeSession
    ? topics.find((t) => t.id === activeSession.topicId) || null
    : null;

  return (
    <PageContainer>
      <div className="space-y-6 pb-12">
        {/* Notice Banner */}
        {notice && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-xs text-primary font-mono flex items-center justify-between animate-in fade-in duration-150">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-primary/70 hover:text-primary ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Active Session Runner (prominently displayed when session is running) */}
        {activeSession && (
          <StudySessionRunner
            session={activeSession}
            topic={activeTopicObj}
            onFinishSession={() => setIsCompleteSessionOpen(true)}
            onAbandonSession={handleAbandonSession}
            isAbandoning={isAbandoningSession}
          />
        )}

        {/* Study Overview Summary Card */}
        <StudyOverviewCard
          overview={overview}
          onStartStudy={() => handleStartStudy()}
          onResumeSession={() => {
            if (activeSession) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          isLoading={isLoading}
        />

        {/* Tab Navigation */}
        <div className="border-b border-border flex items-center gap-1 sm:gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('focus')}
            className={`px-3.5 py-2.5 text-xs sm:text-sm transition-colors border-b-2 font-mono whitespace-nowrap cursor-pointer ${
              activeTab === 'focus'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Overview & Recommendations
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('topics')}
            className={`px-3.5 py-2.5 text-xs sm:text-sm transition-colors border-b-2 font-mono whitespace-nowrap cursor-pointer ${
              activeTab === 'topics'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Topics ({topics.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('difficulties')}
            className={`px-3.5 py-2.5 text-xs sm:text-sm transition-colors border-b-2 font-mono whitespace-nowrap cursor-pointer ${
              activeTab === 'difficulties'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Difficulties ({difficulties.filter((d) => d.status === 'active').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2.5 text-xs sm:text-sm transition-colors border-b-2 font-mono whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            History ({sessions.filter((s) => s.status === 'completed').length})
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'focus' && (
          <div className="space-y-6">
            <StudyRecommendationsView
              recommendations={recommendations}
              onStartStudy={handleStartStudy}
              onAddToLifeTasks={handleAddToLifeTasks}
              isLoading={isLoading}
            />
          </div>
        )}

        {activeTab === 'topics' && (
          <StudyTopicsView
            topics={topics}
            onStartStudy={handleStartStudy}
            onRecordDifficulty={(t) => {
              setPreselectedDifficultyTopicId(t.id);
              setIsRecordDifficultyOpen(true);
            }}
            onEditTopic={(t) => {
              setEditingTopic(t);
              setIsRecordTopicOpen(true);
            }}
            onDeleteTopic={handleDeleteTopic}
            onAddNewTopic={() => {
              setEditingTopic(null);
              setIsRecordTopicOpen(true);
            }}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'difficulties' && (
          <LearningDifficultiesView
            difficulties={difficulties}
            onResolve={handleResolveDifficulty}
            onAddNew={() => {
              setPreselectedDifficultyTopicId(undefined);
              setIsRecordDifficultyOpen(true);
            }}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'history' && (
          <StudyHistoryView
            sessions={sessions}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Modals */}
      <RecordTopicModal
        isOpen={isRecordTopicOpen}
        onClose={() => {
          setIsRecordTopicOpen(false);
          setEditingTopic(null);
        }}
        topic={editingTopic}
        existingTopics={topics}
        careerSkills={careerSkills}
        lifeGoals={lifeGoals}
        onSave={handleSaveTopic}
        isSaving={isSavingTopic}
      />

      <CompleteSessionModal
        isOpen={isCompleteSessionOpen}
        onClose={() => setIsCompleteSessionOpen(false)}
        session={activeSession}
        topic={activeTopicObj}
        onConfirmComplete={handleCompleteSession}
        isCompleting={isCompletingSession}
      />

      <RecordDifficultyModal
        isOpen={isRecordDifficultyOpen}
        onClose={() => setIsRecordDifficultyOpen(false)}
        topics={topics}
        preselectedTopicId={preselectedDifficultyTopicId}
        onSave={handleSaveDifficulty}
        isSaving={isSavingDifficulty}
      />
    </PageContainer>
  );
}
