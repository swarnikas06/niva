'use client';

import React from 'react';
import { MemoryCard } from './memory-card';
import type { MemoryDto } from '@niva/shared-types';

export interface MemoryListProps {
  memories: MemoryDto[];
  onSelect: (memory: MemoryDto) => void;
  onForget: (memory: MemoryDto) => void;
}

export function MemoryList({ memories, onSelect, onForget }: MemoryListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
      {memories.map((memory) => (
        <MemoryCard
          key={memory.id}
          memory={memory}
          onSelect={onSelect}
          onForget={onForget}
        />
      ))}
    </div>
  );
}
