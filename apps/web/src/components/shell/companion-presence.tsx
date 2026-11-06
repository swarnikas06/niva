'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function CompanionPresence({
  size = 'md',
  showGreeting = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  showGreeting?: boolean;
  className?: string;
}) {
  const [timeGreeting, setTimeGreeting] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      let greeting = 'Good evening';
      if (hours >= 5 && hours < 12) greeting = 'Good morning';
      else if (hours >= 12 && hours < 17) greeting = 'Good afternoon';
      else if (hours >= 17 && hours < 22) greeting = 'Good evening';
      else greeting = 'Night hours';

      const timeStr = now.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
      setTimeGreeting(`${timeStr} • ${greeting}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const badgeSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <div className={cn('flex items-center gap-3 select-none', className)}>
      {/* Precision Presence Monogram Mark */}
      <div className="relative flex items-center justify-center flex-shrink-0">
        <div
          className={cn(
            'relative rounded-lg bg-[#111606] text-[#B1DD40] font-black border border-[#B1DD40]/30 flex items-center justify-center tracking-tighter shadow-subtle',
            badgeSizes[size],
          )}
        >
          <span>N</span>
          {/* Flashform Electric Lime Presence Indicator */}
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 rounded-full bg-[#B1DD40] ring-2 ring-background',
              dotSizes[size],
            )}
            title="Companion Active"
          />
        </div>
      </div>

      {showGreeting && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-tight text-foreground uppercase">
              NIVA
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-primary/15 border border-primary/30 text-[10px] font-mono font-bold text-primary tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              PRESENT
            </span>
          </div>
          {timeGreeting && (
            <span className="text-xs text-muted-foreground font-normal tracking-tight">
              {timeGreeting}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
