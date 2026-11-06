'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { authFetch } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CharacterAvatar } from '@/components/character/character-avatar';
import { useSpeechRecognition, useSpeechSynthesis } from '@/hooks/use-speech';
import type {
  ConversationDto,
  ConversationMessageDto,
  CharacterArchetypeDto,
  MessagePage,
  ConversationPage as ConversationPageDto,
  CompanionStateDto,
  ContextFrameDto,
  CommitmentDto,
  TaskDto,
} from '@niva/shared-types';

function extractCandidateTasks(content: string): string[] {
  const tasks: string[] = [];
  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    // Match checklist format: [ ] Task or - [ ] Task or * [ ] Task
    const checkMatch = line.match(/^(?:[-*•]\s*)?\[\s*\]\s+(.+)$/);
    if (checkMatch && checkMatch[1]) {
      let clean = checkMatch[1].replace(/[*_`]/g, '').trim();
      if (clean.includes('—')) {
        clean = clean.split('—')[0]!.trim();
      } else if (clean.includes(' - ')) {
        clean = clean.split(' - ')[0]!.trim();
      }
      if (clean.length > 3 && clean.length < 200) {
        tasks.push(clean);
      }
      continue;
    }
    // Match numbered or bulleted actionable steps
    const stepMatch = line.match(/^(?:\d+[\.\)]|[-*•])\s+(.+)$/);
    if (stepMatch && stepMatch[1]) {
      let clean = stepMatch[1].replace(/[*_`]/g, '').trim();
      if (clean.includes('—')) {
        clean = clean.split('—')[0]!.trim();
      } else if (clean.includes(' - ')) {
        clean = clean.split(' - ')[0]!.trim();
      }
      if (
        clean.length > 6 &&
        clean.length < 200 &&
        /^(?:Review|Prepare|Implement|Study|Finish|Complete|Draft|Build|Schedule|Practice|Read|Set up|Configure|Audit|Deploy|Verify|Solve|Organize|Plan|Step)\b/i.test(clean)
      ) {
        tasks.push(clean);
      }
    }
  }
  return Array.from(new Set(tasks)).slice(0, 5);
}

export interface ConversationProcessingState {
  isSubmitting: boolean;
  isGenerating: boolean;
  isStreaming: boolean;
  error: string | null;
  failedMessage: { tempId: string; content: string } | null;
}

const DEFAULT_PROCESSING_STATE: ConversationProcessingState = {
  isSubmitting: false,
  isGenerating: false,
  isStreaming: false,
  error: null,
  failedMessage: null,
};

function ConversationPageContent() {
  const { user, personalization, isAuthenticated, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const queryCommitmentId = searchParams.get('commitmentId');
  const queryTaskId = searchParams.get('taskId');

  // State
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [archetypes, setArchetypes] = useState<CharacterArchetypeDto[]>([]);
  const [addedTaskTitles, setAddedTaskTitles] = useState<Set<string>>(new Set());

  // Conversation-isolated state maps (independent lifecycle per thread)
  const [messagesByConvId, setMessagesByConvId] = useState<Record<string, ConversationMessageDto[]>>({});
  const [processingByConvId, setProcessingByConvId] = useState<Record<string, ConversationProcessingState>>({});
  const [loadingConvs, setLoadingConvs] = useState<Record<string, boolean>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});
  const draftsByConvIdRef = useRef<Record<string, string>>({});
  const messageTextRef = useRef('');
  const prevConvIdRef = useRef<string | null>(null);

  // Derived state for the currently active thread
  const messages: ConversationMessageDto[] = activeConvId ? (messagesByConvId[activeConvId] || []) : [];
  const currentProcessing = activeConvId ? (processingByConvId[activeConvId] || DEFAULT_PROCESSING_STATE) : DEFAULT_PROCESSING_STATE;
  const isCurrentSending = currentProcessing.isSubmitting || currentProcessing.isGenerating;
  const failedMessage = currentProcessing.failedMessage;
  const isLoadingMessages = activeConvId ? Boolean(loadingConvs[activeConvId]) : false;

  // Notification Context Handover State
  const [linkedCommitment, setLinkedCommitment] = useState<CommitmentDto | null>(null);
  const [linkedTask, setLinkedTask] = useState<TaskDto | null>(null);
  const [contextHandoverNotice, setContextHandoverNotice] = useState<string | null>(null);

  // UI state
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isThreadDrawerOpen, setIsThreadDrawerOpen] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newConvCharacterId, setNewConvCharacterId] = useState('niva_anchor');
  const [newConvTitle, setNewConvTitle] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [companionState, setCompanionState] = useState<CompanionStateDto | null>(null);
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);
  const [contextFrame, setContextFrame] = useState<ContextFrameDto | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  // Keep messageTextRef synchronized for lossless draft preservation on tab switch
  useEffect(() => {
    messageTextRef.current = messageText;
  }, [messageText]);

  // Speech Recognition (Voice Input) & Speech Synthesis (Voice Output)
  const baseTextRef = useRef('');
  const {
    isListening,
    isSupported: isVoiceSupported,
    error: speechError,
    startListening,
    stopListening,
  } = useSpeechRecognition((sessionTranscript) => {
    const base = baseTextRef.current;
    const cleanSession = sessionTranscript.trim();
    if (!cleanSession) {
      setMessageText(base);
      return;
    }
    if (!base) {
      setMessageText(cleanSession);
      return;
    }
    const separator = /[\s]$/.test(base) ? '' : ' ';
    setMessageText(`${base}${separator}${cleanSession}`);
  });

  const { speak, stop: stopSpeaking, isSpeaking } = useSpeechSynthesis();
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const toggleSpeech = (msgId: string, content: string) => {
    if (isSpeaking && speakingMsgId === msgId) {
      stopSpeaking();
      setSpeakingMsgId(null);
      return;
    }
    setSpeakingMsgId(msgId);
    speak(content, (activeCharacter as any)?.voicePreference);
  };

  const handleToggleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      baseTextRef.current = messageText;
      startListening();
    }
  };

  const handleSwitchThreadCharacter = async (newCharId: string) => {
    if (!activeConvId) return;
    try {
      await authFetch<ConversationDto>(`/conversations/${activeConvId}`, {
        method: 'PATCH',
        body: JSON.stringify({ characterId: newCharId }),
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, characterId: newCharId } : c)),
      );
      const targetName = archetypes.find((a) => a.id === newCharId)?.name || 'new character';
      setFeedback({
        type: 'success',
        message: `Thread persona switched to ${targetName}.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to switch character.' });
    }
  };

  // Fetch commitment/task context securely upon notification handover
  useEffect(() => {
    if (!isAuthenticated) return;

    if (queryCommitmentId) {
      authFetch<CommitmentDto>(`/life/commitments/${queryCommitmentId}`)
        .then((comm) => {
          if (comm && comm.id) {
            setLinkedCommitment(comm);
            setContextHandoverNotice(null);
          } else {
            setContextHandoverNotice('Referenced commitment not found or already completed.');
          }
        })
        .catch(() => {
          setContextHandoverNotice('Referenced commitment is not available or belongs to another user.');
        });
    }

    if (queryTaskId) {
      authFetch<TaskDto>(`/life/tasks/${queryTaskId}`)
        .then((task) => {
          if (task && task.id) {
            setLinkedTask(task);
            setContextHandoverNotice(null);
          } else {
            setContextHandoverNotice('Referenced task not found or already completed.');
          }
        })
        .catch(() => {
          setContextHandoverNotice('Referenced task is not available or belongs to another user.');
        });
    }
  }, [queryCommitmentId, queryTaskId, isAuthenticated]);

  const handleAddTask = async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      await authFetch('/life/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: trimmed, priority: 'medium' }),
      });
      setAddedTaskTitles((prev) => new Set(prev).add(trimmed));
      setFeedback({ type: 'success', message: `Added to Life Tasks: "${trimmed}"` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to add task' });
    }
  };

  const handleAddAllTasks = async (titles: string[]) => {
    for (const title of titles) {
      if (!addedTaskTitles.has(title)) {
        await handleAddTask(title);
      }
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active conversation object
  const activeConversation = conversations.find((c) => c.id === activeConvId) || null;

  // Active character details with modern ID resolution
  const rawCharId = activeConversation?.characterId || personalization?.selectedArchetypeId || 'aria';
  const resolvedCharId =
    rawCharId === 'niva_strategist'
      ? 'atlas'
      : rawCharId === 'niva_guide'
      ? 'mira'
      : rawCharId === 'niva_catalyst'
      ? 'nova'
      : rawCharId === 'niva_anchor'
      ? 'aria'
      : rawCharId;

  const activeCharacter =
    archetypes.find((a) => a.id === resolvedCharId || a.id === rawCharId) ||
    activeConversation?.character ||
    archetypes[0];

  // 1. Load initial archetypes and conversations
  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadInitialData() {
      setIsLoadingConvs(true);
      try {
        // Load archetypes
        const archData = await authFetch<CharacterArchetypeDto[]>('/characters').catch(() => []);
        if (archData && archData.length > 0) {
          setArchetypes(archData);
          if (personalization?.selectedArchetypeId) {
            setNewConvCharacterId(personalization.selectedArchetypeId);
          } else {
            setNewConvCharacterId(archData[0]!.id);
          }
        }

        // Load conversations
        const convData = await authFetch<ConversationPageDto>('/conversations');
        const items = convData?.items || [];
        setConversations(items);

        if (items.length > 0) {
          setActiveConvId(items[0]!.id);
        }

        // Load companion operational state
        const stateData = await authFetch<CompanionStateDto>('/companion-state').catch(() => null);
        if (stateData) {
          setCompanionState(stateData);
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Failed to load conversations' });
      } finally {
        setIsLoadingConvs(false);
      }
    }

    loadInitialData();
  }, [isAuthenticated, personalization]);

  // Open deterministic context frame inspector
  const openContextInspector = async () => {
    setIsContextDrawerOpen(true);
    setIsLoadingContext(true);
    try {
      const url = activeConvId ? `/context/current?conversationId=${activeConvId}` : '/context/current';
      const frame = await authFetch<ContextFrameDto>(url);
      setContextFrame(frame);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to assemble context frame' });
    } finally {
      setIsLoadingContext(false);
    }
  };

  // 2. Thread switching lifecycle: preserve unsent drafts & load messages if not cached
  useEffect(() => {
    const prevId = prevConvIdRef.current;
    if (prevId && prevId !== activeConvId) {
      draftsByConvIdRef.current[prevId] = messageTextRef.current;
    }
    prevConvIdRef.current = activeConvId;

    if (!activeConvId) {
      setMessageText('');
      baseTextRef.current = '';
      messageTextRef.current = '';
      return;
    }

    // Restore draft for newly active thread
    const savedDraft = draftsByConvIdRef.current[activeConvId] || '';
    setMessageText(savedDraft);
    baseTextRef.current = savedDraft;
    messageTextRef.current = savedDraft;

    // Load messages if not already in cache
    if (messagesByConvId[activeConvId] === undefined) {
      setLoadingConvs((prev) => ({ ...prev, [activeConvId]: true }));
      authFetch<MessagePage>(`/conversations/${activeConvId}/messages?limit=100`)
        .then((page) => {
          setMessagesByConvId((prev) => {
            const existing = prev[activeConvId] || [];
            const serverItems = page?.items || [];
            if (existing.length === 0) {
              return { ...prev, [activeConvId]: serverItems };
            }
            // Preserve in-flight optimistic messages
            const serverIds = new Set(serverItems.map((m) => m.id));
            const unsavedOptimistic = existing.filter(
              (m) => (m.metadata as any)?.isOptimistic && !serverIds.has(m.id),
            );
            return { ...prev, [activeConvId]: [...serverItems, ...unsavedOptimistic] };
          });
        })
        .catch((err: any) => {
          setFeedback({ type: 'error', message: err.message || 'Failed to load messages' });
        })
        .finally(() => {
          setLoadingConvs((prev) => ({ ...prev, [activeConvId]: false }));
        });
    }
  }, [activeConvId]);

  // Cancel generation in a specific conversation thread
  const handleCancelGeneration = (convId: string) => {
    const controller = abortControllersRef.current[convId];
    if (controller) {
      controller.abort();
      delete abortControllersRef.current[convId];
    }
    setProcessingByConvId((prev) => ({
      ...prev,
      [convId]: DEFAULT_PROCESSING_STATE,
    }));
  };

  // Auto-scroll to bottom of message list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isCurrentSending, activeConvId]);

  // Handle Send Message (Conversation-Scoped Optimistic UI & Isolated Execution)
  const handleSendMessage = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const targetConvId = activeConvId;
    if (!targetConvId) return;

    const targetProcessing = processingByConvId[targetConvId] || DEFAULT_PROCESSING_STATE;
    if (targetProcessing.isSubmitting || targetProcessing.isGenerating) {
      return;
    }

    if (isListening) {
      stopListening();
    }

    const textToSend = (overrideText ?? messageText).trim();
    if (!textToSend) return;

    if (textToSend.length > 8000) {
      setFeedback({ type: 'error', message: 'Message exceeds 8,000 character limit' });
      return;
    }

    const targetConvObj = conversations.find((c) => c.id === targetConvId);
    const targetMessages = messagesByConvId[targetConvId] || [];

    // Clear composer draft for target thread
    draftsByConvIdRef.current[targetConvId] = '';
    if (activeConvId === targetConvId) {
      setMessageText('');
      baseTextRef.current = '';
      messageTextRef.current = '';
    }

    // If retrying a previously failed message, remove that failed message first
    if (overrideText && targetProcessing.failedMessage?.tempId) {
      const failedTempId = targetProcessing.failedMessage.tempId;
      setMessagesByConvId((prev) => ({
        ...prev,
        [targetConvId]: (prev[targetConvId] || []).filter((m) => m.id !== failedTempId),
      }));
    }

    // Generate unique temporary optimistic message ID
    const tempUserMsgId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nextSeq = targetMessages.length > 0 ? targetMessages[targetMessages.length - 1]!.sequenceNumber + 1 : 1;

    const optimisticMsg: ConversationMessageDto = {
      id: tempUserMsgId,
      conversationId: targetConvId,
      userId: targetConvObj?.userId || '',
      senderRole: 'user',
      content: textToSend,
      sequenceNumber: nextSeq,
      status: 'sent' as any,
      metadata: { isOptimistic: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Immediately append optimistic user message to target thread
    setMessagesByConvId((prev) => ({
      ...prev,
      [targetConvId]: [...(prev[targetConvId] || []), optimisticMsg],
    }));

    // 2. Set conversation-isolated processing state
    const controller = new AbortController();
    abortControllersRef.current[targetConvId] = controller;

    setProcessingByConvId((prev) => ({
      ...prev,
      [targetConvId]: {
        isSubmitting: true,
        isGenerating: true,
        isStreaming: false,
        error: null,
        failedMessage: null,
      },
    }));

    try {
      const turn = await authFetch<any>(
        `/conversations/${targetConvId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content: textToSend }),
          signal: controller.signal,
        },
      );

      const serverUserMsg: ConversationMessageDto | undefined = turn?.userMessage;
      const serverAssistantMsg: ConversationMessageDto | undefined =
        turn?.assistantMessage || (turn?.id && turn.senderRole === 'assistant' ? turn : undefined);

      // Reconcile optimistic user message with server-confirmed message in target thread only
      setMessagesByConvId((prev) => {
        const currentList = prev[targetConvId] || [];
        const withoutOptimistic = currentList.filter((m) => m.id !== tempUserMsgId);
        const resolved: ConversationMessageDto[] = [];
        if (serverUserMsg) {
          resolved.push(serverUserMsg);
        } else {
          resolved.push({ ...optimisticMsg, metadata: {} });
        }
        if (serverAssistantMsg) {
          resolved.push(serverAssistantMsg);
        }
        return {
          ...prev,
          [targetConvId]: [...withoutOptimistic, ...resolved],
        };
      });

      const latestMsg = serverAssistantMsg || serverUserMsg;
      if (latestMsg || turn?.conversationTitle) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetConvId
              ? {
                  ...c,
                  updatedAt: new Date().toISOString(),
                  ...(latestMsg ? { lastMessage: latestMsg } : {}),
                  ...(turn?.conversationTitle ? { title: turn.conversationTitle } : {}),
                }
              : c,
          ),
        );
      }

      // Mark target conversation as idle
      setProcessingByConvId((prev) => ({
        ...prev,
        [targetConvId]: DEFAULT_PROCESSING_STATE,
      }));
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        setProcessingByConvId((prev) => ({
          ...prev,
          [targetConvId]: DEFAULT_PROCESSING_STATE,
        }));
      } else {
        const errMsg = err.message || 'Failed to send message. Click Retry to send again.';
        if (activeConvId === targetConvId) {
          setFeedback({
            type: 'error',
            message: errMsg,
          });
        }
        setProcessingByConvId((prev) => ({
          ...prev,
          [targetConvId]: {
            isSubmitting: false,
            isGenerating: false,
            isStreaming: false,
            error: errMsg,
            failedMessage: {
              tempId: tempUserMsgId,
              content: textToSend,
            },
          },
        }));
      }
    } finally {
      delete abortControllersRef.current[targetConvId];
      if (activeConvId === targetConvId) {
        textareaRef.current?.focus();
      }
    }
  };

  // Handle Keyboard Submit (Enter without shift)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle Create Conversation
  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await authFetch<ConversationDto>('/conversations', {
        method: 'POST',
        body: JSON.stringify({
          characterId: newConvCharacterId,
          title: newConvTitle.trim() || undefined,
        }),
      });

      setConversations((prev) => [created, ...prev]);
      setActiveConvId(created.id);
      setShowNewModal(false);
      setNewConvTitle('');
      setIsMobileDrawerOpen(false);
      setFeedback({ type: 'success', message: 'Conversation started' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create conversation' });
    }
  };

  // Handle Archive Conversation
  const handleArchiveConversation = async (id: string) => {
    try {
      await authFetch(`/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      });

      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'archived' } : c)),
      );
      setFeedback({ type: 'success', message: 'Conversation archived' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to archive conversation' });
    }
  };

  // If not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-background font-sans">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl border border-border bg-surface shadow-elevated">
          <Badge variant="presence">Authentication Required</Badge>
          <h2 className="text-xl font-normal text-foreground uppercase tracking-tight">Sign In to Continue</h2>
          <p className="text-xs text-muted-foreground">
            Please sign in to access your continuous dialogues with your NIVA companion.
          </p>
          <div className="pt-2">
            <Link href="/login">
              <Button variant="primary">Sign In</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const preferredName = personalization?.preferredName || user?.name?.split(' ')[0] || 'there';

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-background font-sans">
      {/* ========================================================= */}
      {/* 1. LEFT SIDEBAR: CONVERSATION THREADS DRAWER              */}
      {/* ========================================================= */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 bg-surface border-r border-border transition-all duration-200 ease-in-out md:relative flex flex-col shrink-0',
          isMobileDrawerOpen
            ? 'translate-x-0 top-16 h-[calc(100vh-4rem)] w-72 shadow-2xl'
            : '-translate-x-full md:translate-x-0',
          isThreadDrawerOpen ? 'md:w-72' : 'md:w-0 md:border-r-0 md:overflow-hidden',
        )}
        aria-label="Conversation Threads"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
              Dialogues
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {conversations.filter((c) => c.status === 'active').length} active threads
            </p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setShowNewModal(true)}
            className="text-xs px-2.5 py-1 h-auto font-bold uppercase tracking-wider"
          >
            + New
          </Button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {isLoadingConvs ? (
            <div className="p-6 text-center text-xs font-mono text-muted-foreground">Loading threads...</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground space-y-3">
              <p>No conversations yet.</p>
              <Button size="sm" variant="outline" onClick={() => setShowNewModal(true)}>
                Start a Conversation
              </Button>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.id === activeConvId;
              const charName = conv.character?.name || 'Companion';
              const symbol = conv.character?.avatarSymbol || charName.charAt(0);

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    setIsMobileDrawerOpen(false);
                  }}
                  className={cn(
                    'group relative p-3 rounded-xl cursor-pointer transition-all border text-left flex items-start gap-3 select-none',
                    isSelected
                      ? 'bg-primary/10 border-primary/40 text-foreground shadow-subtle'
                      : 'border-transparent hover:bg-surface-hover hover:border-border text-muted-foreground',
                  )}
                >
                  {/* Avatar Icon */}
                  <div className="w-8 h-8 rounded-lg bg-[#111606] border border-primary/30 flex items-center justify-center text-xs font-bold text-primary font-mono shrink-0 mt-0.5">
                    {symbol}
                  </div>

                  {/* Title & Preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-foreground truncate tracking-tight">
                        {conv.title || `Chat with ${charName}`}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {Boolean(processingByConvId[conv.id]?.isGenerating) && (
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                            Thinking
                          </span>
                        )}
                        {conv.status === 'archived' && (
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded bg-surface-muted border border-border text-muted-foreground">
                            Archived
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-snug">
                      {conv.lastMessage?.content || conv.character?.tagline || 'New discussion'}
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground/80 block mt-1">
                      {new Date(conv.updatedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Archive button */}
                  {conv.status === 'active' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchiveConversation(conv.id);
                      }}
                      title="Archive conversation"
                      aria-label="Archive conversation"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[10px] text-muted-foreground hover:text-foreground rounded"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileDrawerOpen && (
        <div
          onClick={() => setIsMobileDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
        />
      )}

      {/* ========================================================= */}
      {/* 2. CENTER STAGE: CONVERSATION WORKSPACE (FULL-WIDTH READY) */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Companion Presence Header */}
        <header className="h-14 border-b border-border bg-surface/90 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Drawer Toggle */}
            <button
              onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
              className="md:hidden p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground"
              aria-label="Toggle threads drawer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Desktop Thread Drawer Toggle Button */}
            <button
              onClick={() => setIsThreadDrawerOpen(!isThreadDrawerOpen)}
              className="hidden md:flex p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
              title={isThreadDrawerOpen ? 'Collapse threads' : 'Show threads'}
              aria-label={isThreadDrawerOpen ? 'Collapse threads' : 'Show threads'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
              </svg>
            </button>

            {activeConversation ? (
              <>
                <CharacterAvatar
                  characterId={activeCharacter?.id || 'aria'}
                  name={activeCharacter?.name}
                  size="sm"
                  showPresence
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <select
                      value={activeCharacter?.id || 'aria'}
                      onChange={(e) => handleSwitchThreadCharacter(e.target.value)}
                      className="text-xs font-bold text-foreground uppercase tracking-tight bg-surface/80 border border-border/80 rounded-md px-2 py-0.5 focus:ring-1 focus:ring-primary cursor-pointer hover:border-primary/50 transition-colors"
                      title="Switch companion persona for this conversation"
                      aria-label="Switch companion persona"
                    >
                      {archetypes.map((arch) => (
                        <option key={arch.id} value={arch.id}>
                          {arch.name} — {arch.tagline}
                        </option>
                      ))}
                    </select>
                    {companionState?.activeFocusGoal && (
                      <span className="hidden lg:inline-flex items-center text-[9px] font-mono font-medium text-muted-foreground bg-surface-muted px-1.5 py-0.5 rounded border border-border truncate max-w-xs">
                        FOCUS: {companionState.activeFocusGoal.title}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {activeCharacter?.tagline || 'Autonomous Companion Presence'}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-xs font-bold text-foreground uppercase tracking-tight">
                Select or start a conversation
              </div>
            )}
          </div>

          {/* Right Header Status & Inspector Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={openContextInspector}
              className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-surface-hover transition-colors flex items-center gap-1.5"
              title="Inspect deterministic Cognitive Context Frame"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Context Frame
            </button>
            {activeConversation?.status === 'archived' && (
              <Badge variant="outline" className="text-[9px]">
                Archived
              </Badge>
            )}
          </div>
        </header>

        {/* ========================================================= */}
        {/* NOTIFICATION CONTEXT HANDOVER BANNERS                     */}
        {/* ========================================================= */}
        {linkedCommitment && (
          <div className="bg-primary/10 border-b border-primary/25 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-primary mt-1.5 sm:mt-0 shrink-0 animate-pulse" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-primary bg-primary/20 px-2 py-0.5 rounded">
                    Reminder Context Handover
                  </span>
                  <span className="text-xs font-bold text-foreground truncate">
                    {linkedCommitment.title}
                  </span>
                  {linkedCommitment.dueAt && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Due: {new Date(linkedCommitment.dueAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Responding to proactive deadline reminder. Ask NIVA for guidance, break down remaining work, or mark it completed.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  handleSendMessage(undefined, `I have completed "${linkedCommitment.title}".`);
                }}
                className="text-[10px] font-mono font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:opacity-90 px-2.5 py-1 rounded transition-opacity"
              >
                [ Mark Completed ]
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSendMessage(undefined, `I'm preparing for "${linkedCommitment.title}". What should I prioritize first?`);
                }}
                className="text-[10px] font-mono uppercase tracking-wider bg-surface border border-border hover:border-primary/40 text-foreground px-2.5 py-1 rounded transition-colors"
              >
                [ Ask Guidance ]
              </button>
              <button
                type="button"
                onClick={() => setLinkedCommitment(null)}
                className="text-xs text-muted-foreground hover:text-foreground p-1"
                title="Dismiss context banner"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {linkedTask && (
          <div className="bg-primary/10 border-b border-primary/25 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-primary mt-1.5 sm:mt-0 shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-primary bg-primary/20 px-2 py-0.5 rounded">
                    Task Context Handover
                  </span>
                  <span className="text-xs font-bold text-foreground truncate">
                    {linkedTask.title}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Priority: {linkedTask.priority}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  handleSendMessage(undefined, `I finished the task: "${linkedTask.title}".`);
                }}
                className="text-[10px] font-mono font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:opacity-90 px-2.5 py-1 rounded transition-opacity"
              >
                [ Mark Task Done ]
              </button>
              <button
                type="button"
                onClick={() => setLinkedTask(null)}
                className="text-xs text-muted-foreground hover:text-foreground p-1"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {contextHandoverNotice && (
          <div className="bg-muted/30 border-b border-border px-4 sm:px-6 py-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>{contextHandoverNotice}</span>
            <button onClick={() => setContextHandoverNotice(null)} className="text-xs font-bold ml-2">
              ✕
            </button>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={cn(
              'px-4 py-2 text-xs flex items-center justify-between border-b',
              feedback.type === 'error'
                ? 'bg-danger/10 text-danger border-danger/30'
                : 'bg-primary/10 text-primary border-primary/20',
            )}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="ml-2 text-xs font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Message Timeline */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5">
          {!activeConversation ? (
            /* No conversation selected */
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-[#111606] border border-primary/30 flex items-center justify-center text-lg font-black text-primary font-mono shadow-surface">
                N
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-normal text-foreground uppercase tracking-tight">
                  Your Companion Dialogue Space
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Select an active thread from the drawer or initiate a new dialogue with your chosen companion persona.
                </p>
              </div>
              <Button onClick={() => setShowNewModal(true)} variant="primary" size="sm">
                Start a Conversation
              </Button>
            </div>
          ) : isLoadingMessages ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-muted-foreground">
              Retrieving persisted messages...
            </div>
          ) : messages.length === 0 ? (
            /* Welcome / Seed State */
            <div className="max-w-2xl mx-auto my-8 p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-4">
              <div className="flex items-center gap-3">
                <CharacterAvatar characterId={activeCharacter?.id || 'aria'} name={activeCharacter?.name} size="md" />
                <div>
                  <span className="text-xs font-bold text-foreground block tracking-tight uppercase">
                    {activeCharacter?.name || 'Companion'}
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    {activeCharacter?.tagline || 'Personal Intelligence Anchor'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed pt-1">
                Hello {preferredName}. I am grounded in your ongoing goals, active builds, and daily focus. What is
                on your mind today?
              </p>
              <div className="pt-3 border-t border-border-subtle text-[10px] font-mono text-muted-foreground flex items-center justify-between">
                <span>Continuity Grounded • AI Companion Active</span>
                <span>Type below to converse</span>
              </div>
            </div>
          ) : (
            /* Persisted Messages List */
            <div className="max-w-4xl mx-auto space-y-5">
              {messages.map((msg) => {
                const isUser = msg.senderRole === 'user';
                const isSystem = msg.senderRole === 'system';

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center my-2">
                      <span className="text-[10px] font-mono text-muted-foreground bg-surface-muted px-2.5 py-1 rounded-md border border-border">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex flex-col',
                      isUser ? 'items-end ml-auto max-w-2xl' : 'items-start mr-auto max-w-3xl',
                    )}
                  >
                    <div className="flex items-baseline gap-2 mb-1 px-1">
                      <span className={cn('text-[10px] font-bold uppercase font-mono', isUser ? 'text-muted-foreground' : 'text-primary')}>
                        {isUser ? 'You' : activeCharacter?.name || 'Companion'}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground/70">
                        #{msg.sequenceNumber} •{' '}
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {!isUser && isVoiceSupported && (
                        <button
                          type="button"
                          onClick={() => toggleSpeech(msg.id, msg.content)}
                          className={cn(
                            'p-1 rounded-md transition-colors ml-1 inline-flex items-center gap-1 text-[9px] font-mono',
                            speakingMsgId === msg.id && isSpeaking
                              ? 'text-primary bg-primary/10'
                              : 'text-muted-foreground/60 hover:text-foreground hover:bg-surface-hover',
                          )}
                          title={speakingMsgId === msg.id && isSpeaking ? 'Stop speech' : 'Read aloud with companion voice'}
                          aria-label={speakingMsgId === msg.id && isSpeaking ? 'Stop speech' : 'Read aloud with companion voice'}
                        >
                          {speakingMsgId === msg.id && isSpeaking ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>

                    <div
                      className={cn(
                        'px-4 sm:px-5 py-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-subtle',
                        isUser
                          ? 'bg-surface-elevated border border-border-strong text-foreground font-normal rounded-tr-sm'
                          : 'bg-surface border border-border text-foreground rounded-tl-sm',
                        Boolean((msg.metadata as any)?.isOptimistic) && !failedMessage && 'opacity-85 border-dashed border-primary/50',
                        failedMessage?.tempId === msg.id && 'border-danger/60 bg-danger/5',
                      )}
                    >
                      {msg.content}
                    </div>

                    {isUser && failedMessage?.tempId === msg.id && (
                      <div className="mt-1 flex items-center gap-2 px-1">
                        <span className="text-[10px] font-mono text-danger font-bold">
                          Failed to send
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSendMessage(undefined, failedMessage.content)}
                          className="text-[10px] font-mono font-bold text-primary underline hover:opacity-80"
                        >
                          [ Click to Retry ]
                        </button>
                      </div>
                    )}

                    {!isUser && (() => {
                      const candidateTasks = extractCandidateTasks(msg.content);
                      if (candidateTasks.length === 0) return null;
                      return (
                        <div className="mt-2.5 p-3 sm:p-3.5 rounded-xl border border-primary/30 bg-surface-muted/70 space-y-2.5 w-full">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">
                                Proposed Life Tasks & Commitments
                              </span>
                              <span className="text-[9px] font-mono text-muted-foreground">({candidateTasks.length} detected)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddAllTasks(candidateTasks)}
                              className="text-[10px] font-mono font-bold uppercase text-primary hover:underline"
                            >
                              + Add All to Tasks
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {candidateTasks.map((task, idx) => {
                              const isAdded = addedTaskTitles.has(task);
                              return (
                                <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface border border-border text-xs">
                                  <span className="text-foreground truncate flex-1 font-medium">{task}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddTask(task)}
                                    disabled={isAdded}
                                    className={cn(
                                      'px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 transition-colors',
                                      isAdded
                                        ? 'bg-primary/20 text-primary border border-primary/40 cursor-default'
                                        : 'bg-surface-elevated hover:bg-primary hover:text-primary-foreground border border-border text-foreground',
                                    )}
                                  >
                                    {isAdded ? '✓ Added' : '+ Add to Tasks'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}

          {isCurrentSending && (
            <div className="max-w-4xl mx-auto flex flex-col items-start mr-auto animate-pulse">
              <div className="flex items-baseline gap-2 mb-1 px-1">
                <span className="text-[10px] font-bold text-primary font-mono uppercase">
                  {activeCharacter?.name || 'Companion'}
                </span>
                <span className="text-[9px] font-mono text-primary font-bold">thinking...</span>
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-xs leading-relaxed bg-surface border border-border text-muted-foreground flex items-center justify-between gap-4 shadow-subtle w-full max-w-md">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  <span className="text-foreground/80 font-mono text-[11px]">Reflecting on active context...</span>
                </div>
                {activeConvId && (
                  <button
                    type="button"
                    onClick={() => handleCancelGeneration(activeConvId)}
                    className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-danger/40 text-danger hover:bg-danger/10 transition-colors"
                    title="Stop response generation"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ========================================================= */}
        {/* 3. BOTTOM COMPOSER (CLEAN FLASHFORM AESTHETIC)            */}
        {/* ========================================================= */}
        {activeConversation && activeConversation.status !== 'archived' && (
          <div className="p-3 sm:p-5 border-t border-border bg-surface/90 backdrop-blur-sm shrink-0">
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto space-y-2">
              <div className="relative rounded-2xl border border-border bg-surface focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all shadow-subtle">
                <textarea
                  ref={textareaRef}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Speak with ${activeCharacter?.name || 'Companion'}... (Press Enter to send)`}
                  rows={2}
                  disabled={isCurrentSending}
                  className="w-full bg-transparent px-4 py-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
                />

                {speechError && (
                  <div className="px-4 py-1.5 text-[10px] text-rose-500 font-mono bg-rose-500/10 border-t border-rose-500/20 flex items-center gap-1">
                    <span>⚠️ {speechError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle text-[10px] text-muted-foreground font-mono">
                  <div className="flex items-center gap-2">
                    <span>
                      {messageText.length}/8000
                    </span>
                    <span className="hidden sm:inline text-muted-foreground/60">
                      • Enter to submit, Shift+Enter for newline
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Web Speech API Microphone Dictation Button */}
                    {isVoiceSupported && (
                      <button
                        type="button"
                        onClick={handleToggleVoiceInput}
                        className={cn(
                          'p-1.5 px-2.5 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-mono font-medium',
                          isListening
                            ? 'bg-rose-500 text-white border-rose-600 animate-pulse shadow-sm'
                            : 'border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover',
                        )}
                        title={isListening ? 'Listening... Click to stop dictation' : 'Dictate with voice (Web Speech API)'}
                        aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <span className="text-[10px] hidden sm:inline">{isListening ? 'Listening...' : 'Voice'}</span>
                      </button>
                    )}

                    {isCurrentSending ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => activeConvId && handleCancelGeneration(activeConvId)}
                        className="text-xs px-3 py-1.5 h-auto font-bold uppercase tracking-wider text-danger border-danger/40 hover:bg-danger/10"
                      >
                        Stop
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={!messageText.trim()}
                        className="text-xs px-4 py-1.5 h-auto font-bold uppercase tracking-wider"
                      >
                        Send
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* 4. MODAL: START NEW CONVERSATION                          */}
      {/* ========================================================= */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border p-6 sm:p-8 rounded-2xl max-w-md w-full shadow-elevated space-y-4">
            <h3 className="text-base font-semibold text-foreground uppercase tracking-tight">Initiate Dialogue</h3>
            <p className="text-xs text-muted-foreground">
              Select a companion archetype to anchor your conversational continuity.
            </p>

            <form onSubmit={handleCreateConversation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 uppercase font-mono">
                  Companion Persona
                </label>
                <select
                  value={newConvCharacterId}
                  onChange={(e) => setNewConvCharacterId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-1 focus:ring-primary"
                >
                  {archetypes.map((arch) => (
                    <option key={arch.id} value={arch.id}>
                      {arch.name} — {arch.tagline}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 uppercase font-mono">
                  Topic / Title (Optional)
                </label>
                <input
                  type="text"
                  value={newConvTitle}
                  onChange={(e) => setNewConvTitle(e.target.value)}
                  placeholder="e.g. Distributed Systems Architecture Review"
                  className="w-full text-xs p-2.5 rounded-xl border border-border bg-surface text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowNewModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Start Conversation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. SLIDE-OVER: CONTEXT FRAME INSPECTOR                    */}
      {/* ========================================================= */}
      {isContextDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="bg-surface border-l border-border w-full max-w-lg h-full p-6 sm:p-8 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-tight">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    Cognitive Context Frame
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Deterministic multi-domain synthesis • Zero AI hallucination
                  </p>
                </div>
                <button
                  onClick={() => setIsContextDrawerOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground text-xs"
                  aria-label="Close inspector"
                >
                  ✕
                </button>
              </div>

              {isLoadingContext ? (
                <div className="py-12 text-center text-xs font-mono text-muted-foreground">
                  Assembling deterministic context frame...
                </div>
              ) : contextFrame ? (
                <div className="space-y-5 text-xs">
                  {/* Token Budget Card */}
                  <div className="p-4 rounded-xl border border-border bg-surface-muted/40 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-foreground uppercase tracking-wider font-mono">
                        Estimated Token Budget
                      </span>
                      <span className="font-mono text-primary font-bold">
                        {contextFrame.tokenBudget.totalEstimatedTokens} / {contextFrame.tokenBudget.allocatedMaxTokens} est. tokens
                      </span>
                    </div>
                    <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full"
                        style={{
                          width: `${Math.min(100, (contextFrame.tokenBudget.totalEstimatedTokens / contextFrame.tokenBudget.allocatedMaxTokens) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] text-muted-foreground font-mono">
                      <div>Identity & Persona: {contextFrame.tokenBudget.identityAndPersona}</div>
                      <div>Life Ground Truth: {contextFrame.tokenBudget.lifeGroundTruth}</div>
                      <div>Dialogue Window: {contextFrame.tokenBudget.dialogueHistory}</div>
                      <div>Companion State: {contextFrame.tokenBudget.companionState}</div>
                    </div>
                  </div>

                  {/* Temporal Grounding */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                      Temporal Grounding
                    </div>
                    <div className="p-3.5 rounded-xl border border-border bg-surface-muted/20 space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time Awareness:</span>
                        <span className="font-medium text-foreground">
                          {contextFrame.temporalGrounding.timeOfDayGreeting} ({contextFrame.temporalGrounding.dayOfWeek})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Timestamp:</span>
                        <span className="font-mono text-muted-foreground">
                          {new Date(contextFrame.temporalGrounding.utcTimestamp).toLocaleTimeString()} UTC
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Companion Operational State */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                      Companion Operational State
                    </div>
                    <div className="p-3.5 rounded-xl border border-border bg-surface-muted/20 space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Presence & Mode:</span>
                        <span className="capitalize text-foreground font-medium">
                          {contextFrame.companion.presenceStatus} • {contextFrame.companion.interactionMode}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Continuity Streak:</span>
                        <span className="text-foreground">{contextFrame.companion.continuityStreakDays} days</span>
                      </div>
                      {contextFrame.companion.activeFocusGoalTitle && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Active Focus:</span>
                          <span className="text-primary truncate">{contextFrame.companion.activeFocusGoalTitle}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Life Ground Truth */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                      Life Context Horizon
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-3 rounded-xl border border-border bg-surface-muted/30">
                        <div className="font-medium text-foreground">{contextFrame.lifeGroundTruth.activeGoals.length} Active Goals</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {contextFrame.lifeGroundTruth.activeGoals[0]?.title || 'None active'}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-border bg-surface-muted/30">
                        <div className="font-medium text-foreground">{contextFrame.lifeGroundTruth.activeProjects.length} Active Projects</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {contextFrame.lifeGroundTruth.activeProjects[0]?.title || 'None active'}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-border bg-surface-muted/30">
                        <div className="font-medium text-foreground">{contextFrame.lifeGroundTruth.upcomingCommitments.length} 7-Day Commitments</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {contextFrame.lifeGroundTruth.upcomingCommitments[0]?.title || 'None upcoming'}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-border bg-surface-muted/30">
                        <div className="font-medium text-foreground">{contextFrame.lifeGroundTruth.relevantTasks.length} Open Tasks</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {contextFrame.lifeGroundTruth.relevantTasks[0]?.title || 'No tasks'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Dialogue Window */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                      Recent Dialogue Window
                    </div>
                    <div className="p-3.5 rounded-xl border border-border bg-surface-muted/20 text-[11px]">
                      <span className="text-foreground">
                        {contextFrame.dialogueContext.messageCount} messages budgeted from thread &quot;
                        {contextFrame.dialogueContext.title || 'Conversation'}&quot;
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pt-6 border-t border-border flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsContextDrawerOpen(false)}>
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConversationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background text-muted-foreground text-sm">
          Loading conversation...
        </div>
      }
    >
      <ConversationPageContent />
    </Suspense>
  );
}

