'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { authFetch } from '@/lib/auth-client';
import { PageContainer } from '@/components/ui/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import {
  CareerDirectionCard,
  ConfigureGoalsModal,
  SkillsEvidenceView,
  GapAnalysisView,
  EvaluationHistoryView,
  StartEvaluationModal,
  StrategySummary,
  MockInterviewSession,
} from '@/components/career';
import {
  CareerProfileDto,
  CareerTargetRoleDto,
  TargetRoleSkillDto,
  UserSkillDto,
  CareerGapAnalysisDto,
  CareerPlacementStrategyDto,
  MockEvaluationSessionDto,
  MockEvaluationType,
  EvaluationDifficulty,
  PlacementStrategyItemDto,
} from '@niva/shared-types';

type ActiveTab = 'strategy' | 'skills' | 'gaps' | 'history';

export default function GrowthPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Core Data State
  const [profile, setProfile] = useState<CareerProfileDto | null>(null);
  const [targetRoles, setTargetRoles] = useState<CareerTargetRoleDto[]>([]);
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<CareerPlacementStrategyDto | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<CareerGapAnalysisDto | null>(null);
  const [roleSkills, setRoleSkills] = useState<TargetRoleSkillDto[]>([]);
  const [userSkills, setUserSkills] = useState<UserSkillDto[]>([]);
  const [historySessions, setHistorySessions] = useState<MockEvaluationSessionDto[]>([]);
  const [activeSession, setActiveSession] = useState<MockEvaluationSessionDto | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<ActiveTab>('strategy');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals
  const [isConfiguringGoals, setIsConfiguringGoals] = useState(false);
  const [isStartingCustomMock, setIsStartingCustomMock] = useState(false);
  const [selectedPracticeSkillId, setSelectedPracticeSkillId] = useState<string | undefined>(undefined);
  const [isStartingMock, setIsStartingMock] = useState<boolean>(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState<boolean>(false);

  // Fetch all career intelligence
  const fetchAllData = useCallback(async (roleIdOverride?: string) => {
    if (!isAuthenticated) return;
    setError(null);

    try {
      // 1. Fetch Profile & Target Roles first
      const [profRes, rolesRes] = await Promise.all([
        authFetch<CareerProfileDto>('/career/profile').catch(() => null),
        authFetch<CareerTargetRoleDto[]>('/career/target-roles').catch(() => []),
      ]);

      const prof = profRes || null;
      const roles = rolesRes || [];
      setProfile(prof);
      setTargetRoles(roles);

      const resolvedRoleId =
        roleIdOverride ||
        (activeRoleId && roles.some((r) => r.id === activeRoleId) ? activeRoleId : null) ||
        roles.find((r) => r.priority === 'primary')?.id ||
        roles[0]?.id ||
        null;

      setActiveRoleId(resolvedRoleId);

      // 2. Fetch Strategy, Gap Analysis, Role Skills, User Skills, History, and Active Session
      const roleQuery = resolvedRoleId ? `?targetRoleId=${resolvedRoleId}` : '';

      const [stratRes, gapRes, roleSkillsRes, userSkillsRes, historyRes, activeRes] =
        await Promise.all([
          authFetch<CareerPlacementStrategyDto>(`/career/strategy${roleQuery}`).catch(() => null),
          authFetch<CareerGapAnalysisDto>(`/career/gap-analysis${roleQuery}`).catch(() => null),
          resolvedRoleId
            ? authFetch<TargetRoleSkillDto[]>(`/career/target-roles/${resolvedRoleId}/skills`).catch(() => [])
            : Promise.resolve([]),
          authFetch<UserSkillDto[]>('/career/user-skills').catch(() => []),
          authFetch<MockEvaluationSessionDto[]>('/career/evaluations/sessions').catch(() => []),
          authFetch<MockEvaluationSessionDto | null>('/career/evaluations/sessions/active').catch(() => null),
        ]);

      setStrategy(stratRes);
      setGapAnalysis(gapRes);
      setRoleSkills(roleSkillsRes);
      setUserSkills(userSkillsRes);
      setHistorySessions(historyRes);
      setActiveSession(activeRes || null);
    } catch (err: any) {
      setError(err.message || 'Failed to assemble career intelligence.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, activeRoleId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Handle switching target role
  const handleSelectRole = (newRoleId: string) => {
    setActiveRoleId(newRoleId);
    fetchAllData(newRoleId);
  };

  // Start a mock evaluation session
  const handleStartMock = async (skillId?: string, difficulty?: string) => {
    const roleId = activeRoleId || strategy?.targetRole?.id;
    if (!roleId) {
      setError('Please define or select a target role before starting a mock evaluation.');
      return;
    }

    setIsStartingMock(true);
    setError(null);
    try {
      const session = await authFetch<MockEvaluationSessionDto>('/career/evaluations/sessions', {
        method: 'POST',
        body: JSON.stringify({
          targetRoleId: roleId,
          skillId: skillId || undefined,
          initialDifficulty: difficulty || 'intermediate',
          totalPlannedQuestions: 3,
        }),
      });
      setActiveSession(session);
    } catch (err: any) {
      setError(err.message || 'Failed to start mock session.');
    } finally {
      setIsStartingMock(false);
    }
  };

  // Start custom practice round from modal
  const handleStartCustomSession = async (params: {
    targetRoleId: string;
    skillId?: string;
    evaluationType: MockEvaluationType;
    initialDifficulty: EvaluationDifficulty;
    totalPlannedQuestions: number;
  }) => {
    setError(null);
    try {
      const session = await authFetch<MockEvaluationSessionDto>('/career/evaluations/sessions', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      setActiveSession(session);
    } catch (err: any) {
      setError(err.message || 'Failed to start practice round.');
      throw err;
    }
  };

  // Submit answer in active session
  const handleSubmitAnswer = async (sessionId: string, answerText: string) => {
    setIsSubmittingAnswer(true);
    setError(null);
    try {
      const updated = await authFetch<MockEvaluationSessionDto>(
        `/career/evaluations/sessions/${sessionId}/answers`,
        {
          method: 'POST',
          body: JSON.stringify({ answerText }),
        },
      );
      setActiveSession(updated);

      // If completed, refresh strategy, skills, gap analysis, and history
      if (updated.status === 'completed') {
        fetchAllData();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate answer.');
      throw err;
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  // Cancel in-progress session
  const handleCancelSession = async (sessionId: string) => {
    try {
      await authFetch(`/career/evaluations/sessions/${sessionId}/cancel`, {
        method: 'POST',
      });
      setActiveSession(null);
      fetchAllData();
    } catch (err: any) {
      setError(err.message || 'Failed to abandon session.');
    }
  };

  // Done reviewing completed session
  const handleDoneSession = () => {
    setActiveSession(null);
    fetchAllData();
  };

  // Add operational task to Life Context
  const handleAddLifeTask = async (item: PlacementStrategyItemDto) => {
    setError(null);
    try {
      await authFetch('/life/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: `Practice: ${item.action}`,
          description: `${item.reason}. Recommended preparation: ${item.recommendedActivity.replace(/_/g, ' ')}`,
          priority: item.priority === 'critical' ? 'high' : 'medium',
        }),
      });

      setNotice(`Task added to Life Context: "Practice: ${item.action}"`);
      setTimeout(() => setNotice(null), 4000);

      // Refresh strategy to reflect newly linked task
      const roleQuery = activeRoleId ? `?targetRoleId=${activeRoleId}` : '';
      const refreshedStrat = await authFetch<CareerPlacementStrategyDto>(`/career/strategy${roleQuery}`).catch(() => null);
      if (refreshedStrat) setStrategy(refreshedStrat);
    } catch (err: any) {
      setError(err.message || 'Failed to add task to Life Context.');
    }
  };

  if (authLoading || isLoading) {
    return (
      <PageContainer maxWidth="lg" className="py-12">
        <LoadingState message="Assembling career trajectory & placement intelligence..." />
      </PageContainer>
    );
  }

  const activeTargetRole =
    targetRoles.find((r) => r.id === activeRoleId) ||
    targetRoles.find((r) => r.priority === 'primary') ||
    targetRoles[0] ||
    null;

  return (
    <PageContainer maxWidth="lg" className="py-8 sm:py-12 space-y-7">
      {/* 1. Header Banner & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="presence">CAREER HUB</Badge>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
              Placement & Technical Preparation
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground uppercase">
            {activeSession ? 'Technical Mock Round' : 'Career Intelligence & Practice'}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {activeSession
              ? 'Multi-turn technical evaluation evaluated across 5 core dimensions.'
              : 'Evidence-grounded trajectory, benchmark gap analysis, and interactive mock practice.'}
          </p>
        </div>

        {!activeSession && activeTargetRole && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setSelectedPracticeSkillId(undefined);
                setIsStartingCustomMock(true);
              }}
              className="font-bold uppercase tracking-wider text-xs"
            >
              Start Practice Round
            </Button>
          </div>
        )}
      </div>

      {notice && (
        <div className="p-3 text-xs bg-primary/10 border border-primary/30 text-foreground rounded-lg flex items-center justify-between font-mono">
          <span>✓ {notice}</span>
          <button onClick={() => setNotice(null)} className="text-xs opacity-70 hover:opacity-100 font-bold">✕</button>
        </div>
      )}

      {error && (
        <ErrorState
          title="Career Intelligence Notice"
          message={error}
          onRetry={() => fetchAllData()}
        />
      )}

      {/* 2. Main Content View: Active Session Runner OR Unified Hub Tabs */}
      {activeSession ? (
        <MockInterviewSession
          session={activeSession}
          onSubmitAnswer={handleSubmitAnswer}
          onCancelSession={handleCancelSession}
          onDone={handleDoneSession}
          isSubmitting={isSubmittingAnswer}
        />
      ) : (
        <div className="space-y-6">
          {/* Career Direction & Target Role Banner */}
          <CareerDirectionCard
            profile={profile}
            targetRoles={targetRoles}
            activeRoleId={activeRoleId}
            onSelectRole={handleSelectRole}
            onConfigureGoals={() => setIsConfiguringGoals(true)}
          />

          {/* If a target role exists, show segmented tabs navigation */}
          {activeTargetRole && (
            <div className="space-y-6">
              {/* Segmented Tab Controls */}
              <div className="flex items-center border-b border-border text-sm overflow-x-auto">
                {[
                  { id: 'strategy', label: 'Strategy & Practice', count: strategy?.priorities?.length },
                  { id: 'skills', label: 'Role & Skills', count: roleSkills.length },
                  { id: 'gaps', label: 'Gaps & Strengths', count: gapAnalysis?.gaps?.length },
                  { id: 'history', label: 'Practice History', count: historySessions.length },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as ActiveTab)}
                      className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                        isActive
                          ? 'border-primary text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count !== undefined && tab.count > 0 && (
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-surface-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Strategy & Actionable Recommendations */}
              {activeTab === 'strategy' && (
                <div>
                  {strategy ? (
                    <StrategySummary
                      strategy={strategy}
                      onStartMock={handleStartMock}
                      onAddLifeTask={handleAddLifeTask}
                      isStartingMock={isStartingMock}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                      No preparation strategy synthesized yet. Run gap analysis or refresh the hub.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Role Requirements & Skill Evidence */}
              {activeTab === 'skills' && (
                <SkillsEvidenceView
                  roleSkills={roleSkills}
                  userSkills={userSkills}
                  targetRoleTitle={activeTargetRole.title}
                  onPracticeSkill={(skillId) => {
                    setSelectedPracticeSkillId(skillId);
                    setIsStartingCustomMock(true);
                  }}
                  onRefresh={() => fetchAllData()}
                />
              )}

              {/* Tab 3: Gap Analysis & Strengths */}
              {activeTab === 'gaps' && (
                <GapAnalysisView
                  gapAnalysis={gapAnalysis}
                  targetRoleId={activeRoleId || undefined}
                  onPracticeSkill={(skillId) => {
                    setSelectedPracticeSkillId(skillId);
                    setIsStartingCustomMock(true);
                  }}
                  onRefresh={() => fetchAllData()}
                />
              )}

              {/* Tab 4: Evaluation History */}
              {activeTab === 'history' && (
                <EvaluationHistoryView
                  sessions={historySessions}
                  onResumeSession={(sessionId) => {
                    const session = historySessions.find((s) => s.id === sessionId);
                    if (session) setActiveSession(session);
                  }}
                  onStartNewMock={() => {
                    setSelectedPracticeSkillId(undefined);
                    setIsStartingCustomMock(true);
                  }}
                  onRefresh={() => fetchAllData()}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ConfigureGoalsModal
        isOpen={isConfiguringGoals}
        onClose={() => setIsConfiguringGoals(false)}
        onSaved={() => fetchAllData()}
        profile={profile}
        targetRole={activeTargetRole}
      />

      {activeTargetRole && (
        <StartEvaluationModal
          isOpen={isStartingCustomMock}
          onClose={() => setIsStartingCustomMock(false)}
          targetRole={activeTargetRole}
          roleSkills={roleSkills}
          onStartSession={handleStartCustomSession}
          preselectedSkillId={selectedPracticeSkillId}
        />
      )}
    </PageContainer>
  );
}
