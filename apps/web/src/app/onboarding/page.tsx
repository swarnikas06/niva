'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { authFetch } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NivaIcon } from '@/components/ui/niva-logo';
import {
  CharacterArchetypeDto,
  PrimaryFocus,
  ResponseLength,
  UserPersonalizationDto,
} from '@niva/shared-types';

const FOCUS_OPTIONS: { id: PrimaryFocus; title: string; desc: string; icon: string }[] = [
  {
    id: 'technical_placement',
    title: 'Placement & Technical Prep',
    desc: 'Algorithms, system design, mock interview readiness, and consistent problem solving.',
    icon: '🎯',
  },
  {
    id: 'deep_work',
    title: 'Deep Work & Project Focus',
    desc: 'Architecture, shipping code, clean sprints, and focused build sessions.',
    icon: '⚡',
  },
  {
    id: 'academic_learning',
    title: 'Learning & Skill Mastery',
    desc: 'Coursework mastery, technical papers, and breaking down complex concepts.',
    icon: '📚',
  },
  {
    id: 'general_growth',
    title: 'Daily Clarity & Reflection',
    desc: 'Habit tracking, life rhythm, uncluttering thoughts, and mental equilibrium.',
    icon: '🌱',
  },
];

const ROLE_SUGGESTIONS = [
  'Computer Science Student',
  'Software Engineer',
  'Data Scientist / ML Engineer',
  'Researcher / Academic',
  'Career Switcher',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshPersonalization, setPersonalizationState } = useAuth();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [preferredName, setPreferredName] = useState<string>('');
  const [occupationRole, setOccupationRole] = useState<string>('');
  const [primaryFocus, setPrimaryFocus] = useState<PrimaryFocus>('technical_placement');
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string>('niva_anchor');
  const [archetypes, setArchetypes] = useState<CharacterArchetypeDto[]>([]);
  
  // UI 1-5 Scale for Tone
  const [warmthUi, setWarmthUi] = useState<number>(4); // default 4 -> 80
  const [directnessUi, setDirectnessUi] = useState<number>(3); // default 3 -> 60
  const [responseLength, setResponseLength] = useState<ResponseLength>('balanced');

  useEffect(() => {
    async function initOnboarding() {
      try {
        // 1. Fetch character archetypes
        const archData = await authFetch<CharacterArchetypeDto[]>('/characters');
        setArchetypes(archData || []);

        // 2. Fetch user personalization state
        const persData = await authFetch<UserPersonalizationDto>('/personalization/me');
        if (persData) {
          if (persData.onboardingCompleted) {
            router.push('/');
            return;
          }

          if (persData.preferredName) setPreferredName(persData.preferredName);
          else if (user?.name) setPreferredName(user.name);

          if (persData.occupationRole) setOccupationRole(persData.occupationRole);
          if (persData.primaryFocus) setPrimaryFocus(persData.primaryFocus);
          if (persData.selectedArchetypeId) setSelectedArchetypeId(persData.selectedArchetypeId);
          
          if (persData.warmth) setWarmthUi(Math.round(persData.warmth / 20));
          if (persData.directness) setDirectnessUi(Math.round(persData.directness / 20));
          if (persData.responseLength) setResponseLength(persData.responseLength);

          // Resume step
          if (persData.onboardingStep === 'focus') setCurrentStep(2);
          else if (persData.onboardingStep === 'archetype') setCurrentStep(3);
          else if (persData.onboardingStep === 'tone') setCurrentStep(4);
        } else if (user?.name) {
          setPreferredName(user.name);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to load onboarding context');
      } finally {
        setIsLoading(false);
      }
    }

    initOnboarding();
  }, [router, user]);

  const saveStep = async (stepNum: number, complete = false, skip = false) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const stepNameMap: Record<number, any> = {
      1: 'identity',
      2: 'focus',
      3: 'archetype',
      4: 'tone',
    };

    const payload = {
      step: skip ? 'skipped' : complete ? 'completed' : stepNameMap[stepNum],
      preferredName: preferredName.trim() || user?.name || 'Friend',
      occupationRole: occupationRole.trim() || undefined,
      primaryFocus,
      selectedArchetypeId,
      warmth: Math.min(100, Math.max(1, warmthUi * 20)),
      directness: Math.min(100, Math.max(1, directnessUi * 20)),
      responseLength,
      complete,
      skip,
    };

    try {
      const updated = await authFetch<UserPersonalizationDto>('/personalization/onboarding', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setPersonalizationState(updated);

      if (complete || skip) {
        await refreshPersonalization();
        router.push('/conversation');
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save progress');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!preferredName.trim()) {
        setErrorMessage('Please enter what NIVA should call you');
        return;
      }
      saveStep(1);
    } else if (currentStep === 2) {
      saveStep(2);
    } else if (currentStep === 3) {
      saveStep(3);
    } else if (currentStep === 4) {
      saveStep(4, true);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    saveStep(currentStep, false, true);
  };

  const handleStartImmediately = async () => {
    await saveStep(currentStep, true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <LoadingState message="Preparing your companion setup..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-8">
      {/* Top Bar */}
      <header className="w-full max-w-2xl mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <NivaIcon className="w-8 h-8 rounded-lg shadow-subtle shrink-0" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#10B981] ring-1 ring-background" />
          </div>
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-foreground">NIVA ONBOARDING</span>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1.5" aria-label={`Step ${currentStep} of 4`}>
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step === currentStep
                  ? 'w-6 bg-primary'
                  : step < currentStep
                  ? 'w-3 bg-primary/60'
                  : 'w-3 bg-border'
              }`}
            />
          ))}
          <span className="text-[11px] font-mono text-muted-foreground ml-2 uppercase font-semibold">Step {currentStep}/4</span>
        </div>
      </header>

      {/* Main Flow Content Container */}
      <main className="w-full max-w-2xl mx-auto my-auto py-6 space-y-6">
        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-xl border border-danger/20 bg-danger/10 text-danger text-sm flex items-start gap-2.5 animate-fadeIn"
          >
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
              <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: IDENTITY */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fadeIn">
            {/* 1-Click Fast Start Companion Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5 shadow-subtle">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase font-mono tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Fast-Track 1-Click Start
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Want to skip onboarding questions? NIVA is ready immediately and will adapt naturally during conversation.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleStartImmediately}
                disabled={isSubmitting}
                className="shrink-0"
              >
                Start Talking Immediately →
              </Button>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                How should NIVA address you?
              </h1>
              <p className="text-sm text-muted-foreground">
                NIVA is a personal presence that builds durable continuity with you over time.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-xl border border-border bg-surface shadow-subtle space-y-5">
              <Input
                id="onboarding-preferred-name"
                label="Preferred Name"
                placeholder="What should NIVA call you?"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                autoFocus
                required
              />

              <div className="space-y-2">
                <Input
                  id="onboarding-occupation-role"
                  label="Current Stage / Role (Optional)"
                  placeholder="e.g. Computer Science Student, Software Engineer"
                  value={occupationRole}
                  onChange={(e) => setOccupationRole(e.target.value)}
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ROLE_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setOccupationRole(sug)}
                      className={`text-xs px-2.5 py-1 rounded-md border font-mono transition-all ${
                        occupationRole === sug
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PRIMARY FOCUS */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground uppercase">
                What is your main focus right now?
              </h1>
              <p className="text-xs text-muted-foreground">
                This helps NIVA frame daily interactions, open loops, and coaching priorities.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {FOCUS_OPTIONS.map((opt) => {
                const isSelected = primaryFocus === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPrimaryFocus(opt.id)}
                    className={`p-5 rounded-xl border text-left transition-all focus-ring relative ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-subtle'
                        : 'border-border bg-surface hover:bg-surface-hover shadow-subtle'
                    }`}
                  >
                    <span className="text-2xl block mb-2">{opt.icon}</span>
                    <h2 className="text-sm font-bold text-foreground mb-1 uppercase tracking-tight">
                      {opt.title}
                    </h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: CHARACTER ARCHETYPE */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground uppercase">
                Choose your companion&apos;s baseline archetype
              </h1>
              <p className="text-xs text-muted-foreground">
                Each archetype has distinct behavioral characteristics. You can customize traits or change this anytime in Settings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {archetypes.map((arch) => {
                const isSelected = selectedArchetypeId === arch.id;
                return (
                  <button
                    key={arch.id}
                    type="button"
                    onClick={() => setSelectedArchetypeId(arch.id)}
                    className={`p-5 rounded-xl border text-left transition-all focus-ring flex flex-col justify-between ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-subtle'
                        : 'border-border bg-surface hover:bg-surface-hover shadow-subtle'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-foreground tracking-tight">{arch.name}</span>
                        {isSelected && (
                          <span className="text-[9px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 rounded bg-primary text-primary-foreground">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-primary mb-2">{arch.tagline}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-4">
                        {arch.description}
                      </p>
                    </div>

                    {/* Trait Indicators */}
                    <div className="pt-3 border-t border-border-subtle grid grid-cols-2 gap-2 text-[11px] text-muted-foreground font-mono">
                      <div>
                        <span>Warmth: </span>
                        <span className="font-bold text-foreground">{arch.traits.warmth}%</span>
                      </div>
                      <div>
                        <span>Directness: </span>
                        <span className="font-bold text-foreground">{arch.traits.directness}%</span>
                      </div>
                      <div>
                        <span>Challenge: </span>
                        <span className="font-bold text-foreground">{arch.traits.challengeLevel}%</span>
                      </div>
                      <div>
                        <span>Brevity: </span>
                        <span className="font-bold text-foreground capitalize">{arch.traits.responseLength}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: COMMUNICATION TONE */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground uppercase">
                Fine-tune communication style
              </h1>
              <p className="text-xs text-muted-foreground">
                Set how direct, empathetic, and concise NIVA should be in daily responses.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-xl border border-border bg-surface shadow-subtle space-y-6">
              {/* Warmth Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-foreground uppercase tracking-tight">Warmth & Empathy</span>
                  <span className="text-muted-foreground font-mono font-bold">
                    {warmthUi === 1 ? 'Objective / Cool' : warmthUi === 3 ? 'Balanced' : warmthUi === 5 ? 'Deeply Empathetic' : `${warmthUi}/5`}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={warmthUi}
                  onChange={(e) => setWarmthUi(Number(e.target.value))}
                  className="w-full h-2 bg-surface-muted rounded appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>Pragmatic</span>
                  <span>Supportive</span>
                </div>
              </div>

              {/* Directness Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-foreground uppercase tracking-tight">Directness & Challenge</span>
                  <span className="text-muted-foreground font-mono font-bold">
                    {directnessUi === 1 ? 'Gentle Guidance' : directnessUi === 3 ? 'Clear' : directnessUi === 5 ? 'Unfiltered Rigor' : `${directnessUi}/5`}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={directnessUi}
                  onChange={(e) => setDirectnessUi(Number(e.target.value))}
                  className="w-full h-2 bg-surface-muted rounded appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>Gentle</span>
                  <span>High Challenge</span>
                </div>
              </div>

              {/* Response Length */}
              <div className="space-y-2 pt-2 border-t border-border-subtle">
                <span className="block text-xs font-bold text-foreground uppercase tracking-tight">Response Brevity</span>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['concise', 'balanced', 'thorough'] as ResponseLength[]).map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setResponseLength(len)}
                      className={`py-2 px-3 rounded-lg border text-xs font-mono uppercase font-bold transition-all focus-ring ${
                        responseLength === len
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-surface hover:bg-surface-hover text-muted-foreground'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation Controls */}
      <footer className="w-full max-w-2xl mx-auto flex items-center justify-between pt-6 border-t border-border-subtle">
        <div>
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={isSubmitting}
            >
              Skip for now
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={isSubmitting}
            >
              Skip for now
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleNext}
            isLoading={isSubmitting}
          >
            {currentStep === 4 ? 'Complete & Enter NIVA' : 'Continue'}
          </Button>
        </div>
      </footer>
    </div>
  );
}
