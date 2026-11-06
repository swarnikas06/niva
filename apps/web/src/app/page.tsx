'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { authFetch } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NivaIcon, NivaSymbol, NivaWordmark } from '@/components/ui/niva-logo';
import type {
  ConversationDto,
  ConversationPage as ConversationPageDto,
  CompanionStateDto,
  GoalDto,
} from '@niva/shared-types';

export default function RootPage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <NivaIcon className="w-12 h-12 rounded-xl shadow-subtle animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground">Initializing companion...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <AuthenticatedHomeView user={user} />;
  }

  return <PublicLandingView />;
}

/* ========================================================================= */
/* 1. PUBLIC LANDING PAGE (FLASHFORM INSPIRED)                                */
/* ========================================================================= */
function PublicLandingView() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How does NIVA differ from a standard chatbot?',
      a: 'Standard AI models reset their context every conversation. NIVA assembles a persistent, deterministic Cognitive Context Frame combining your goals, active projects, study difficulties, career benchmarks, and past reflections so it truly knows where you are in life.',
    },
    {
      q: 'How does memory and privacy work in NIVA?',
      a: 'NIVA retains durable facts, commitments, and feedback strictly scoped to your private user account. Memory extraction and retrieval run behind secure, validated boundaries without selling data or training public models.',
    },
    {
      q: 'Can I choose different companion archetypes?',
      a: 'Yes. NIVA supports multiple personas—such as The Balanced Anchor, The Focused Strategist, The Calm Guide, and The Energetic Catalyst—adapting tone and focus to what suits your mindset.',
    },
    {
      q: 'Does NIVA assist with technical placement and interviews?',
      a: 'Yes. NIVA includes a dedicated Growth & Placement intelligence system featuring a real-time Readiness Radar, mock technical evaluation simulations, and skill-gap analysis.',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground font-sans">
      {/* Floating Flashform Navbar */}
      <header className="sticky top-4 z-50 px-4 sm:px-8 max-w-6xl mx-auto">
        <nav
          className="bg-surface/85 backdrop-blur-md border border-border rounded-xl px-4 sm:px-6 py-3 flex items-center justify-between shadow-surface"
          aria-label="Public Navigation"
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 focus-ring rounded-lg">
            <NivaSymbol size="sm" />
            <NivaWordmark height={16} showTagline={false} />
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6 text-xs uppercase tracking-wider font-mono text-muted-foreground">
            <a href="#why" className="hover:text-foreground transition-colors">
              Why NIVA
            </a>
            <a href="#solution" className="hover:text-foreground transition-colors">
              Continuity
            </a>
            <a href="#pillars" className="hover:text-foreground transition-colors">
              Capabilities
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              FAQ
            </a>
          </div>

          {/* Auth Actions */}
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wider font-mono">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" size="sm" className="text-xs uppercase tracking-wider font-bold">
                Meet NIVA →
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-16 sm:pt-24 pb-16 px-4 sm:px-8 max-w-5xl mx-auto text-left">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-mono uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Continuous Personal AI Companion
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-normal tracking-tight text-foreground uppercase leading-[1.05]">
            We don&apos;t just chat.
            <br />
            We build <span className="editorial-italic font-serif lowercase text-primary">continuity</span>.
          </h1>

          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Most AI tools forget everything the moment you close the tab. NIVA stays grounded in your ongoing
            goals, active projects, technical learning, and career development across days, weeks, and months.
          </p>

          <div className="pt-4 flex flex-wrap items-center gap-4">
            <Link href="/register">
              <Button variant="primary" size="lg" className="px-8 font-bold">
                [ Meet NIVA Now ]
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="px-6 font-mono text-xs uppercase">
                [ Existing User Login ]
              </Button>
            </Link>
          </div>
        </div>

        {/* Interface Preview Wireframe */}
        <div className="mt-14 rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-elevated">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary/80" />
              <span className="w-3 h-3 rounded-full bg-border" />
              <span className="w-3 h-3 rounded-full bg-border" />
              <span className="ml-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Cognitive Context Assembly
              </span>
            </div>
            <span className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              Deterministic Grounding Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="p-4 rounded-xl border border-border-subtle bg-surface-muted/40 space-y-2">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                01 // Identity Ground Truth
              </span>
              <p className="text-xs text-foreground font-medium">
                Kai Sterling • Senior Systems Track
              </p>
              <p className="text-[11px] text-muted-foreground">
                Active Focus: Distributed consensus engine & placement mock practice.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border-subtle bg-surface-muted/40 space-y-2">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                02 // Token Budget Optimization
              </span>
              <p className="text-xs font-mono text-primary font-bold">
                705 / 4000 Budgeted Tokens
              </p>
              <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[25%]" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Zero AI hallucinations in context framing. Deterministic synthesis.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border-subtle bg-surface-muted/40 space-y-2">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                03 // Longitudinal Reflection
              </span>
              <p className="text-xs text-foreground font-medium">
                Intentions vs. Outcomes
              </p>
              <p className="text-[11px] text-muted-foreground">
                Tracks drift, identifies unresolved threads, and keeps high-leverage priorities top of mind.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee Banner */}
      <div className="w-full overflow-hidden py-4 border-y border-border bg-surface-muted/30">
        <div className="flex whitespace-nowrap gap-12 font-mono text-xs uppercase tracking-widest text-muted-foreground animate-none">
          <span>• Persistent Cognitive Continuity</span>
          <span>• Deterministic Context Assembly</span>
          <span>• Longitudinal Reflection & Pattern Detection</span>
          <span>• Career Strategy & Mock Evaluations</span>
          <span>• Private, Isolated User Data</span>
        </div>
      </div>

      {/* Flashform Inverted Rounded Section (Signature Lime Background) */}
      <section id="solution" className="py-20 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto rounded-3xl bg-[#B1DD40] text-[#111606] p-8 sm:p-14 shadow-elevated">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-4">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#111606]/80 block">
                [ Purpose of NIVA ]
              </span>
              <h2 className="text-3xl sm:text-5xl font-normal uppercase tracking-tight leading-[1.05]">
                Why we made <span className="editorial-italic font-serif lowercase">a companion</span> that remembers.
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-[#111606]/90">
                You shouldn&apos;t have to re-explain who you are, what projects you&apos;re building, or what
                technical difficulties you encountered yesterday.
              </p>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="p-6 rounded-2xl bg-[#111606]/10 border border-[#111606]/20 space-y-2">
                <h3 className="text-lg font-bold uppercase tracking-tight">The Ephemeral AI Problem</h3>
                <p className="text-sm leading-relaxed text-[#111606]/80">
                  Every modern LLM app begins with an empty screen. They don&apos;t know your deadlines, your
                  weakest algorithmic patterns, or the promises you made to yourself on Monday.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#111606]/10 border border-[#111606]/20 space-y-2">
                <h3 className="text-lg font-bold uppercase tracking-tight">The NIVA Solution</h3>
                <p className="text-sm leading-relaxed text-[#111606]/80">
                  A persistent companion that preserves your reality. Conversations inform memory; memory enriches
                  context; context drives coaching, study sprints, and career evaluations without starting from zero.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architectural Pillars */}
      <section id="pillars" className="py-20 px-4 sm:px-8 max-w-6xl mx-auto">
        <div className="space-y-4 mb-12 text-left">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary block">
            [ Cohesive Capabilities ]
          </span>
          <h2 className="text-3xl sm:text-4xl font-normal text-foreground uppercase tracking-tight">
            Integrated intelligence for your <span className="editorial-italic font-serif lowercase text-primary">entire life</span>.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          <div className="p-6 rounded-2xl border border-border bg-surface hover:border-primary/50 transition-colors shadow-subtle space-y-3">
            <span className="text-xs font-mono font-bold text-primary">01 // CONVERSATION</span>
            <h3 className="text-base font-bold text-foreground uppercase tracking-tight">Context-Driven Dialogue</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every message is dynamically budgeted alongside your active goals, upcoming commitments, and past lessons.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-surface hover:border-primary/50 transition-colors shadow-subtle space-y-3">
            <span className="text-xs font-mono font-bold text-primary">02 // CAREER</span>
            <h3 className="text-base font-bold text-foreground uppercase tracking-tight">Growth & Evaluations</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Placement readiness radar, skill-gap analysis, and simulated technical mock evaluations with structured rubrics.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-surface hover:border-primary/50 transition-colors shadow-subtle space-y-3">
            <span className="text-xs font-mono font-bold text-primary">03 // STUDY</span>
            <h3 className="text-base font-bold text-foreground uppercase tracking-tight">Mastery & Sprints</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Structured topics, cognitive difficulty tracking, and timed focused study sessions to overcome roadblocks.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-surface hover:border-primary/50 transition-colors shadow-subtle space-y-3">
            <span className="text-xs font-mono font-bold text-primary">04 // REFLECTION</span>
            <h3 className="text-base font-bold text-foreground uppercase tracking-tight">Longitudinal Synthesis</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Synthesizes patterns across conversations, detects drift between intentions and outcomes, and flags unresolved threads.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-8 max-w-4xl mx-auto">
        <div className="space-y-3 mb-10 text-left">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary block">
            [ Questions & Answers ]
          </span>
          <h2 className="text-3xl font-normal text-foreground uppercase tracking-tight">
            Frequently Asked <span className="editorial-italic font-serif lowercase text-primary">Questions</span>
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                onClick={() => setActiveFaq(isOpen ? null : idx)}
                className="p-5 rounded-xl border border-border bg-surface hover:border-primary/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground tracking-tight">{faq.q}</h3>
                  <span className="text-xs font-mono text-primary ml-4">
                    {isOpen ? '[-]' : '[+]'}
                  </span>
                </div>
                {isOpen && (
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed border-t border-border-subtle pt-3">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Call to Action & Minimalist Footer */}
      <footer className="border-t border-border bg-surface py-12 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <NivaSymbol size="sm" />
            <NivaWordmark height={20} showTagline={true} />
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="bracket" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" size="sm">
                Meet NIVA
              </Button>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ========================================================================= */
/* 2. AUTHENTICATED HOME VIEW (CALM, USEFUL STARTING POINT)                   */
/* ========================================================================= */
function AuthenticatedHomeView({ user }: { user: any }) {
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [companionState, setCompanionState] = useState<CompanionStateDto | null>(null);
  const [goals, setGoals] = useState<GoalDto[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState(true);

  useEffect(() => {
    async function loadHomeData() {
      setIsLoadingHome(true);
      try {
        const [convData, stateData, goalsData] = await Promise.all([
          authFetch<ConversationPageDto>('/conversations?limit=3').catch(() => null),
          authFetch<CompanionStateDto>('/companion-state').catch(() => null),
          authFetch<GoalDto[]>('/life/goals').catch(() => []),
        ]);

        if (convData?.items) setConversations(convData.items);
        if (stateData) setCompanionState(stateData);
        if (goalsData) setGoals(goalsData);
      } catch {
        // ignore load errors
      } finally {
        setIsLoadingHome(false);
      }
    }
    loadHomeData();
  }, []);

  const displayName = user.name || user.email.split('@')[0];

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 text-left font-sans">
      {/* Personalized Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-2xl border border-border bg-surface shadow-elevated flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-xs font-mono uppercase tracking-wider text-primary font-semibold">
              Companion Grounded
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-normal uppercase tracking-tight text-foreground">
            Welcome back, <span className="editorial-italic font-serif lowercase text-primary">{displayName}</span>.
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
            {companionState?.activeFocusGoal
              ? `Currently focusing on "${companionState.activeFocusGoal.title}". All recent dialogues, study sessions, and commitments remain synchronized.`
              : 'Grounded in your active priorities. Start or resume a conversation with your companion below.'}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          <Link href="/conversation">
            <Button variant="primary" size="md" className="font-bold">
              [ Open Conversation ]
            </Button>
          </Link>
        </div>
      </div>

      {/* Action Horizon: 3 Core Domains */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Life & Active Goals Card */}
        <div className="p-5 rounded-xl border border-border bg-surface hover:border-primary/40 transition-colors shadow-subtle space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                Life & Goals
              </span>
              <Badge variant="neutral" size="sm">
                {goals.length} Tracked
              </Badge>
            </div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-tight">Active Horizon</h2>
            <p className="text-xs text-muted-foreground">
              {goals.length > 0
                ? goals.slice(0, 2).map((g) => g.title).join(', ')
                : 'No active goals recorded. Organize your goals, tasks, and commitments in Life.'}
            </p>
          </div>
          <Link href="/life" className="pt-2">
            <span className="text-xs font-mono font-bold text-primary hover:underline">
              Manage Life Context →
            </span>
          </Link>
        </div>

        {/* Study Intelligence Card */}
        <div className="p-5 rounded-xl border border-border bg-surface hover:border-primary/40 transition-colors shadow-subtle space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                Study Intelligence
              </span>
              <Badge variant="neutral" size="sm">
                Focused
              </Badge>
            </div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-tight">Cognitive Sprints</h2>
            <p className="text-xs text-muted-foreground">
              Track mastery over technical concepts and log blockers to review during focused study sessions.
            </p>
          </div>
          <Link href="/study" className="pt-2">
            <span className="text-xs font-mono font-bold text-primary hover:underline">
              Enter Study Workspace →
            </span>
          </Link>
        </div>

        {/* Growth & Career Card */}
        <div className="p-5 rounded-xl border border-border bg-surface hover:border-primary/40 transition-colors shadow-subtle space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                Career Growth
              </span>
              <Badge variant="neutral" size="sm">
                Placement
              </Badge>
            </div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-tight">Readiness & Mocks</h2>
            <p className="text-xs text-muted-foreground">
              Review your readiness radar, target interview roles, and initiate structured technical evaluations.
            </p>
          </div>
          <Link href="/growth" className="pt-2">
            <span className="text-xs font-mono font-bold text-primary hover:underline">
              View Career Radar →
            </span>
          </Link>
        </div>
      </div>

      {/* Recent Dialogues */}
      <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-tight">Recent Dialogues</h2>
            <p className="text-xs text-muted-foreground">Active conversation threads with your companion</p>
          </div>
          <Link href="/conversation">
            <Button variant="ghost" size="sm" className="text-xs font-mono uppercase">
              View All Threads
            </Button>
          </Link>
        </div>

        {isLoadingHome ? (
          <div className="py-6 text-center text-xs font-mono text-muted-foreground">Loading recent dialogues...</div>
        ) : conversations.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground space-y-3">
            <p>No active conversations yet.</p>
            <Link href="/conversation">
              <Button variant="primary" size="sm">
                Start First Conversation
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href="/conversation"
                className="p-4 rounded-xl border border-border-subtle bg-surface-muted/40 hover:border-primary/40 hover:bg-surface-hover transition-all text-left flex flex-col justify-between space-y-2"
              >
                <div>
                  <span className="text-xs font-bold text-foreground tracking-tight block truncate">
                    {conv.title || `Dialogue with ${conv.character?.name || 'Companion'}`}
                  </span>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                    {conv.lastMessage?.content || conv.character?.tagline || 'Active continuity'}
                  </p>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-2 border-t border-border-subtle/60">
                  <span>{conv.character?.name || 'Companion'}</span>
                  <span>{new Date(conv.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
