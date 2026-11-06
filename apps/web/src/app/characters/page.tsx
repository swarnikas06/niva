'use client';

import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { useAuth } from '@/components/auth/auth-provider';
import { authFetch } from '@/lib/auth-client';
import { CharacterAvatar } from '@/components/character/character-avatar';
import { useSpeechSynthesis } from '@/hooks/use-speech';
import type { CharacterArchetypeDto, UserPersonalizationDto } from '@niva/shared-types';

export default function CharactersPage() {
  const { personalization, refreshPersonalization, setPersonalizationState } = useAuth();
  const [archetypes, setArchetypes] = useState<CharacterArchetypeDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { speak, stop, isSpeaking } = useSpeechSynthesis();

  useEffect(() => {
    async function loadCatalog() {
      try {
        const data = await authFetch<CharacterArchetypeDto[]>('/characters');
        setArchetypes(data || []);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to load character catalog');
      } finally {
        setIsLoading(false);
      }
    }
    loadCatalog();
  }, []);

  const handleSelectArchetype = async (archetypeId: string) => {
    setIsUpdating(archetypeId);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const updated = await authFetch<UserPersonalizationDto>('/personalization/me', {
        method: 'PATCH',
        body: JSON.stringify({ selectedArchetypeId: archetypeId }),
      });
      setPersonalizationState(updated);
      await refreshPersonalization();
      setSuccessMessage('Companion character activated successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update companion character');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleVoicePreview = (arch: CharacterArchetypeDto) => {
    if (isSpeaking && previewingVoice === arch.id) {
      stop();
      setPreviewingVoice(null);
      return;
    }

    setPreviewingVoice(arch.id);
    const greetingText = `Hello, I am ${arch.name}. ${arch.tagline}. How can I assist your focus today?`;
    speak(greetingText, arch.voicePreference);

    setTimeout(() => {
      setPreviewingVoice(null);
    }, 4500);
  };

  const rawSelectedId = personalization?.selectedArchetypeId || 'aria';
  // Map legacy IDs to modern characters
  const activeArchetypeId =
    rawSelectedId === 'niva_strategist'
      ? 'atlas'
      : rawSelectedId === 'niva_guide'
      ? 'mira'
      : rawSelectedId === 'niva_catalyst'
      ? 'nova'
      : rawSelectedId === 'niva_anchor'
      ? 'aria'
      : rawSelectedId;

  if (isLoading) {
    return (
      <PageContainer maxWidth="lg" className="py-12">
        <LoadingState message="Loading companion characters..." />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="lg" className="py-8 sm:py-12 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="presence">Character Identities</Badge>
          <span className="text-xs text-muted-foreground font-mono">Modern NIVA Intelligence System</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          Companion Personalities
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          NIVA companions are grounded in distinct behavioural, communication, and cognitive profiles. Select your preferred thinking partner—all characters share your authorised memories, commitments, and life context seamlessly.
        </p>
      </div>

      {/* Feedback Messages */}
      {successMessage && (
        <div
          role="status"
          className="p-3.5 rounded-xl border border-success/20 bg-success/10 text-success text-sm flex items-center gap-2 animate-fadeIn"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-danger/20 bg-danger/10 text-danger text-sm flex items-center gap-2 animate-fadeIn"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Character Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {archetypes.map((arch) => {
          const isActive = activeArchetypeId === arch.id;
          const accentColor = arch.accentColor || '#2563EB';

          return (
            <div
              key={arch.id}
              className={`p-6 sm:p-7 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                isActive
                  ? 'border-primary bg-card ring-2 ring-primary/20 shadow-md'
                  : 'border-border bg-card shadow-subtle hover:border-border/80'
              }`}
              style={{
                borderLeftWidth: '5px',
                borderLeftColor: accentColor,
              }}
            >
              {/* Header section with Avatar and Titles */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <CharacterAvatar characterId={arch.id} name={arch.name} size="lg" showPresence={isActive} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold tracking-tight text-foreground">{arch.name}</h2>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: accentColor }}
                          title={`Accent: ${accentColor}`}
                        />
                      </div>
                      <p className="text-xs font-mono font-medium mt-0.5" style={{ color: accentColor }}>
                        {arch.tagline}
                      </p>
                    </div>
                  </div>

                  {isActive && (
                    <span className="text-2xs font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-primary text-primary-foreground shrink-0 shadow-sm">
                      Active Companion
                    </span>
                  )}
                </div>

                {/* Short Description */}
                <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
                  {arch.description}
                </p>

                {/* Detailed Personality */}
                {arch.detailedPersonality && (
                  <div className="p-3.5 rounded-xl bg-surface/50 border border-border/70 text-xs text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground/80 block mb-1 font-mono uppercase tracking-wider text-2xs">
                      Personality & Mindset
                    </span>
                    {arch.detailedPersonality}
                  </div>
                )}

                {/* Communication & Response Structure */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {arch.communicationStyle && (
                    <div className="p-3 rounded-xl bg-surface/30 border border-border/50">
                      <span className="font-semibold text-foreground/80 block mb-0.5 font-mono text-2xs uppercase">
                        Communication Style
                      </span>
                      <p className="text-muted-foreground text-2xs leading-normal">{arch.communicationStyle}</p>
                    </div>
                  )}

                  {arch.preferredStructure && (
                    <div className="p-3 rounded-xl bg-surface/30 border border-border/50">
                      <span className="font-semibold text-foreground/80 block mb-0.5 font-mono text-2xs uppercase">
                        Response Blueprint
                      </span>
                      <p className="text-muted-foreground text-2xs leading-normal">{arch.preferredStructure}</p>
                    </div>
                  )}
                </div>

                {/* Behavioral Trait Matrix */}
                <div className="p-4 rounded-xl bg-surface/60 border border-border/80 space-y-2.5">
                  <span className="text-2xs font-mono font-semibold text-muted-foreground uppercase tracking-widest block mb-2">
                    Behavioral Characteristics
                  </span>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-muted-foreground text-2xs font-mono mb-1">
                        <span>Warmth</span>
                        <span className="font-semibold text-foreground">{arch.traits.warmth}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-border/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${arch.traits.warmth}%`, backgroundColor: accentColor }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-muted-foreground text-2xs font-mono mb-1">
                        <span>Directness</span>
                        <span className="font-semibold text-foreground">{arch.traits.directness}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-border/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${arch.traits.directness}%`, backgroundColor: accentColor }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-muted-foreground text-2xs font-mono mb-1">
                        <span>Challenge Level</span>
                        <span className="font-semibold text-foreground">{arch.traits.challengeLevel}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-border/40 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-muted-foreground rounded-full"
                          style={{ width: `${arch.traits.challengeLevel}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-muted-foreground text-2xs font-mono mb-1">
                        <span>Response Cadence</span>
                        <span className="font-semibold text-foreground capitalize">
                          {arch.traits.responseLength}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-border/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width:
                              arch.traits.responseLength === 'concise'
                                ? '33%'
                                : arch.traits.responseLength === 'balanced'
                                ? '66%'
                                : '100%',
                            backgroundColor: accentColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sample Dialogue Block */}
                {arch.sampleDialogue && arch.sampleDialogue.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-2xs font-mono font-semibold text-muted-foreground uppercase tracking-widest block">
                      Sample Dialogue Turn
                    </span>
                    <div className="p-3 rounded-xl bg-surface/40 border border-border/80 text-xs space-y-1.5">
                      <p className="text-muted-foreground">
                        <strong className="text-foreground">You:</strong> {arch.sampleDialogue[0]?.user}
                      </p>
                      <p className="text-foreground italic">
                        <strong className="not-italic" style={{ color: accentColor }}>
                          {arch.name}:
                        </strong>{' '}
                        &ldquo;{arch.sampleDialogue[0]?.companion}&rdquo;
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions: Voice Preview & Activation */}
              <div className="pt-6 mt-6 border-t border-border/80 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={() => handleVoicePreview(arch)}
                  title="Test spoken voice synthesized in your browser"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                  <span>{previewingVoice === arch.id ? 'Playing...' : 'Voice Preview'}</span>
                </Button>

                <Button
                  type="button"
                  variant={isActive ? 'secondary' : 'primary'}
                  className="flex-1"
                  disabled={isActive || isUpdating === arch.id}
                  isLoading={isUpdating === arch.id}
                  onClick={() => handleSelectArchetype(arch.id)}
                >
                  {isActive ? 'Currently Active' : `Activate ${arch.name}`}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Extensibility Footnote */}
      <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Extensible Architecture: </span>
        Personalized traits and voice models persist per user across all conversations. User-customized personas will plug into this same unified context and memory graph.
      </div>
    </PageContainer>
  );
}
