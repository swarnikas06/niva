'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { MemoryCategory } from '@niva/shared-types';

export type CategoryFilterOption = 'all' | MemoryCategory;

interface CategoryTab {
  id: CategoryFilterOption;
  label: string;
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: 'all', label: 'All memories' },
  { id: 'user_preference', label: 'Preferences' },
  { id: 'semantic_fact', label: 'Facts' },
  { id: 'episodic_event', label: 'Experiences' },
  { id: 'open_loop', label: 'Things to revisit' },
];

export interface MemoryFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedCategory: CategoryFilterOption;
  onSelectCategory: (category: CategoryFilterOption) => void;
  isSearching?: boolean;
}

export function MemoryFilters({
  search,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  isSearching = false,
}: MemoryFiltersProps) {
  return (
    <div className="space-y-4 mb-6">
      {/* Search Input */}
      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
          {isSearching ? (
            <svg
              className="w-4 h-4 animate-spin text-accent"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          )}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search what NIVA remembers..."
          className="w-full pl-10 pr-9 py-2 rounded-xl text-sm bg-surface text-foreground border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />

        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground text-xs"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
        role="tablist"
        aria-label="Memory categories"
      >
        {CATEGORY_TABS.map((tab) => {
          const isSelected = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectCategory(tab.id)}
              className={cn(
                'whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer select-none',
                isSelected
                  ? 'bg-primary text-primary-foreground font-semibold shadow-subtle'
                  : 'bg-surface-muted text-muted-foreground hover:text-foreground hover:bg-surface-hover border border-border-subtle',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
