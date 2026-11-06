'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { authFetch } from '@/lib/auth-client';
import { PageContainer } from '@/components/ui/page-container';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import {
  ReflectionOverviewCard,
  LongitudinalObservationsView,
  CorrectObservationModal,
  IntentionsOutcomesView,
  UnresolvedThreadsView,
} from '@/components/reflection';
import {
  ReflectionOverviewDto,
  LongitudinalObservationDto,
} from '@niva/shared-types';

type ActiveTab = 'observations' | 'intentions' | 'unresolved';

export default function ReflectionPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Core Data
  const [overview, setOverview] = useState<ReflectionOverviewDto | null>(null);
  const [observations, setObservations] = useState<LongitudinalObservationDto[]>([]);
  const [selectedWindowDays, setSelectedWindowDays] = useState<number>(14);

  // UI State
  const [activeTab, setActiveTab] = useState<ActiveTab>('observations');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals
  const [correctingObservation, setCorrectingObservation] =
    useState<LongitudinalObservationDto | null>(null);

  const fetchReflectionData = useCallback(async (windowDays: number) => {
    if (!isAuthenticated) return;
    setError(null);

    try {
      const [overviewRes, obsRes] = await Promise.all([
        authFetch<ReflectionOverviewDto>(`/reflection/overview?windowDays=${windowDays}`).catch(() => null),
        authFetch<LongitudinalObservationDto[]>('/reflection/observations?status=all&limit=100').catch(() => []),
      ]);

      setOverview(overviewRes);
      setObservations(obsRes || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load reflection intelligence.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchReflectionData(selectedWindowDays);
    } else if (!authLoading && !isAuthenticated) {
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, selectedWindowDays, fetchReflectionData]);

  // Handlers
  const handleWindowChange = (days: number) => {
    setSelectedWindowDays(days);
    setIsLoading(true);
    fetchReflectionData(days);
  };

  const handleGenerateReflection = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      const res = await authFetch<ReflectionOverviewDto>('/reflection/generate', {
        method: 'POST',
        body: JSON.stringify({
          windowDays: selectedWindowDays,
          forceRefresh: true,
        }),
      });

      setOverview(res);
      const updatedObs = await authFetch<LongitudinalObservationDto[]>(
        '/reflection/observations?status=all&limit=100',
      ).catch(() => []);
      setObservations(updatedObs);
      setNotice('Longitudinal analysis generated successfully.');
      setTimeout(() => setNotice(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to synthesize patterns.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      const updated = await authFetch<LongitudinalObservationDto>(
        `/reflection/observations/${id}/confirm`,
        { method: 'POST' },
      );
      setObservations((prev) =>
        prev.map((o) => (o.id === id ? updated : o)),
      );
      fetchReflectionData(selectedWindowDays);
      setNotice('Observation confirmed as verified insight.');
      setTimeout(() => setNotice(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to confirm observation.');
    }
  };

  const handleSubmitCorrection = async (id: string, notes: string) => {
    try {
      const updated = await authFetch<LongitudinalObservationDto>(
        `/reflection/observations/${id}/correct`,
        {
          method: 'POST',
          body: JSON.stringify({ correctionNotes: notes }),
        },
      );
      setObservations((prev) =>
        prev.map((o) => (o.id === id ? updated : o)),
      );
      fetchReflectionData(selectedWindowDays);
      setNotice('Correction recorded. NIVA will avoid repeating contradicted assumptions.');
      setTimeout(() => setNotice(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit correction.');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const updated = await authFetch<LongitudinalObservationDto>(
        `/reflection/observations/${id}/dismiss`,
        { method: 'POST' },
      );
      setObservations((prev) =>
        prev.map((o) => (o.id === id ? updated : o)),
      );
      fetchReflectionData(selectedWindowDays);
      setNotice('Observation dismissed and excluded from active grounding.');
      setTimeout(() => setNotice(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss observation.');
    }
  };

  if (authLoading || isLoading) {
    return (
      <PageContainer>
        <LoadingState message="Loading reflection & longitudinal intelligence..." />
      </PageContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <h2 className="text-xl font-serif text-foreground">Authentication Required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Please sign in to access NIVA&apos;s reflection and longitudinal insights.
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Notifications and Alerts */}
        {error && (
          <ErrorState
            title="Reflection Error"
            message={error}
            onRetry={() => fetchReflectionData(selectedWindowDays)}
          />
        )}

        {notice && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-xs font-mono text-primary flex items-center justify-between shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>{notice}</span>
            </div>
            <button
              onClick={() => setNotice(null)}
              className="text-primary/70 hover:text-primary cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Overview KPI & Synthesis Trigger Card */}
        <ReflectionOverviewCard
          overview={overview}
          selectedWindowDays={selectedWindowDays}
          onWindowChange={handleWindowChange}
          onGenerateReflection={handleGenerateReflection}
          isGenerating={isGenerating}
          isLoading={isLoading}
        />

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('observations')}
            className={`px-4 py-2.5 text-xs font-mono rounded-t-lg transition-colors border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'observations'
                ? 'border-primary text-primary font-semibold bg-surface/50'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Longitudinal Observations</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface border border-border font-mono">
              {observations.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('intentions')}
            className={`px-4 py-2.5 text-xs font-mono rounded-t-lg transition-colors border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'intentions'
                ? 'border-primary text-primary font-semibold bg-surface/50'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Intentions vs. Outcomes</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface border border-border font-mono">
              {overview?.intentionsAndOutcomes.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('unresolved')}
            className={`px-4 py-2.5 text-xs font-mono rounded-t-lg transition-colors border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'unresolved'
                ? 'border-primary text-primary font-semibold bg-surface/50'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Unresolved Threads</span>
            {overview && overview.unresolvedThreads.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-red/20 text-brand-red font-mono">
                {overview.unresolvedThreads.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'observations' && (
          <LongitudinalObservationsView
            observations={observations}
            onConfirm={handleConfirm}
            onOpenCorrectModal={(obs) => setCorrectingObservation(obs)}
            onDismiss={handleDismiss}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'intentions' && (
          <IntentionsOutcomesView
            comparisons={overview?.intentionsAndOutcomes || []}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'unresolved' && (
          <UnresolvedThreadsView
            unresolvedThreads={overview?.unresolvedThreads || []}
            isLoading={isLoading}
          />
        )}

        {/* Correction Feedback Modal */}
        <CorrectObservationModal
          isOpen={!!correctingObservation}
          observation={correctingObservation}
          onClose={() => setCorrectingObservation(null)}
          onSubmitCorrection={handleSubmitCorrection}
        />
      </div>
    </PageContainer>
  );
}
