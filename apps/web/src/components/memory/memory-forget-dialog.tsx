'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { MemoryDto } from '@niva/shared-types';

export interface MemoryForgetDialogProps {
  memory: MemoryDto | null;
  isOpen: boolean;
  isForgetting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MemoryForgetDialog({
  memory,
  isOpen,
  isForgetting,
  onConfirm,
  onCancel,
}: MemoryForgetDialogProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isForgetting) {
        onCancel();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isForgetting, onCancel]);

  if (!isOpen || !memory) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="forget-dialog-title"
      aria-describedby="forget-dialog-description"
    >
      {/* Backdrop click */}
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!isForgetting) onCancel();
        }}
        aria-hidden="true"
      />

      {/* Dialog Content */}
      <div className="relative bg-surface border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 z-10">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-danger/10 text-danger flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg
              className="w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
              />
            </svg>
          </div>

          <div>
            <h3
              id="forget-dialog-title"
              className="text-base font-semibold text-foreground"
            >
              Forget this memory?
            </h3>
            <p
              id="forget-dialog-description"
              className="text-xs text-muted-foreground mt-1 leading-relaxed"
            >
              NIVA will immediately exclude this knowledge from active retrieval and will not use it in future responses.
            </p>
          </div>
        </div>

        {/* Quoted memory preview */}
        <div className="p-3 rounded-xl border border-border-subtle bg-surface-muted/30 text-xs italic text-foreground/90 leading-relaxed">
          &ldquo;{memory.content}&rdquo;
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isForgetting}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="danger"
            size="sm"
            isLoading={isForgetting}
            onClick={onConfirm}
          >
            Forget Memory
          </Button>
        </div>
      </div>
    </div>
  );
}
