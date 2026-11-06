'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { authFetch } from '@/lib/auth-client';
import { PageContainer } from '@/components/ui/page-container';
import { ErrorState } from '@/components/ui/error-state';
import {
  MemoryHeader,
  MemoryFilters,
  MemoryList,
  MemoryDetailDrawer,
  MemoryForgetDialog,
  MemoryEmptyState,
  MemoryLoadingSkeleton,
  CategoryFilterOption,
} from '@/components/memory';
import type { MemoryDto } from '@niva/shared-types';

export default function MemoryPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Data state
  const [memories, setMemories] = useState<MemoryDto[]>([]);
  const [overallTotal, setOverallTotal] = useState<number>(0);

  // Filter state
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterOption>('all');

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<MemoryDto | null>(null);
  const [memoryToForget, setMemoryToForget] = useState<MemoryDto | null>(null);
  const [isForgetting, setIsForgetting] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Debounce search input by 300ms
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setIsSearching(true);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setIsSearching(false);
    }, 300);
  };

  // Fetch memories from live NestJS API
  const fetchMemories = useCallback(async () => {
    if (!isAuthenticated) return;

    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', 'active');
      params.set('limit', '50');

      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }

      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }

      const res = await authFetch<{ items: MemoryDto[]; total: number }>(
        `/memory?${params.toString()}`,
      );

      setMemories(res.items || []);

      // Keep track of overall total count when no search & no category filter
      if (selectedCategory === 'all' && !debouncedSearch.trim()) {
        setOverallTotal(res.total || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load memories. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, selectedCategory, debouncedSearch]);

  // Load memories when filters change
  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Open detail drawer and fetch full enriched memory (with sourceConversationTitle)
  const handleSelectMemory = async (mem: MemoryDto) => {
    setSelectedMemory(mem);
    try {
      const enriched = await authFetch<MemoryDto>(`/memory/${mem.id}`);
      setSelectedMemory(enriched);
    } catch {
      // Use existing memory state if individual fetch fails
    }
  };

  // Initiate forget confirmation
  const handlePromptForget = (mem: MemoryDto) => {
    setMemoryToForget(mem);
  };

  // Execute forget action
  const handleConfirmForget = async () => {
    if (!memoryToForget) return;

    setIsForgetting(true);
    try {
      await authFetch<MemoryDto>(`/memory/${memoryToForget.id}`, {
        method: 'DELETE',
      });

      // Update local state immediately
      setMemories((prev) => prev.filter((m) => m.id !== memoryToForget.id));
      setOverallTotal((prev) => Math.max(0, prev - 1));

      // Close drawer if forgotten memory was selected
      if (selectedMemory?.id === memoryToForget.id) {
        setSelectedMemory(null);
      }

      // Close dialog
      setMemoryToForget(null);

      // Show calm feedback
      setToast({
        type: 'success',
        message: 'Memory forgotten. NIVA will no longer reference it in future conversations.',
      });
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to forget memory. Please try again.',
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsForgetting(false);
    }
  };

  const isFiltered = Boolean(debouncedSearch.trim() || selectedCategory !== 'all');

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedCategory('all');
  };

  if (authLoading) {
    return (
      <PageContainer maxWidth="lg" className="py-8 sm:py-10">
        <MemoryHeader />
        <MemoryLoadingSkeleton />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="lg" className="py-8 sm:py-10">
      {/* Calm Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 max-w-sm p-4 rounded-xl border border-border shadow-elevated bg-surface text-foreground text-xs flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200"
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full ${
                toast.type === 'success' ? 'bg-emerald-500' : 'bg-danger'
              }`}
            />
            <span className="leading-relaxed">{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-muted-foreground hover:text-foreground text-xs"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <MemoryHeader />

      {/* Search & Category Filter Controls */}
      <MemoryFilters
        search={search}
        onSearchChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        isSearching={isSearching}
      />

      {/* Main Content Area */}
      {isLoading ? (
        <MemoryLoadingSkeleton />
      ) : error ? (
        <ErrorState
          title="Could not load memories"
          message={error}
          onRetry={fetchMemories}
        />
      ) : memories.length === 0 ? (
        <MemoryEmptyState
          isFiltered={isFiltered || overallTotal > 0}
          onClearFilters={handleResetFilters}
        />
      ) : (
        <div className="space-y-4">
          <MemoryList
            memories={memories}
            onSelect={handleSelectMemory}
            onForget={handlePromptForget}
          />
        </div>
      )}

      {/* Memory Detail Drawer */}
      <MemoryDetailDrawer
        memory={selectedMemory}
        isOpen={Boolean(selectedMemory)}
        onClose={() => setSelectedMemory(null)}
        onForget={handlePromptForget}
      />

      {/* Forget Confirmation Dialog */}
      <MemoryForgetDialog
        memory={memoryToForget}
        isOpen={Boolean(memoryToForget)}
        isForgetting={isForgetting}
        onConfirm={handleConfirmForget}
        onCancel={() => setMemoryToForget(null)}
      />
    </PageContainer>
  );
}
