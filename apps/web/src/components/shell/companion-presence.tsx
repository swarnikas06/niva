'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { NivaIcon } from '@/components/ui/niva-logo';

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
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <div className={cn('flex items-center gap-3 select-none', className)}>
      {/* Official NIVA Neural N App Icon Mark */}
      <div className="relative flex items-center justify-center flex-shrink-0">
        <div
          className={cn(
            'relative rounded-xl overflow-hidden shadow-subtle flex items-center justify-center shrink-0',
            badgeSizes[size],
          )}
        >
          <NivaIcon className="w-full h-full" />
          {/* Active Presence Dot */}
          <span
            className={cn(
              'absolute top-0.5 right-0.5 rounded-full bg-[#10B981] ring-2 ring-background z-10',
              dotSizes[size],
            )}
            title="Companion Active"
          />
        </div>
      </div>

      {showGreeting && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-[0.16em] text-foreground uppercase flex items-center">
              NIV
              <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-lime-400 bg-clip-text text-transparent">
                A
              </span>
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ONLINE
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
