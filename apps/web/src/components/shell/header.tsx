'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '../theme/theme-toggle';
import { CompanionPresence } from './companion-presence';
import { QuickTasksPopover } from './quick-tasks-popover';
import { NotificationsPopover } from './notifications-popover';
import { NAVIGATION_ITEMS } from './sidebar';
import { useAuth } from '@/components/auth/auth-provider';

export function Header({
  onMenuToggle,
  onSidebarToggle,
  isSidebarCollapsed,
  className = '',
}: {
  onMenuToggle?: () => void;
  onSidebarToggle?: () => void;
  isSidebarCollapsed?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const currentItem =
    NAVIGATION_ITEMS.find((item) => item.href === pathname) || {
      label: 'Companion',
    };

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex items-center justify-between h-16 px-4 sm:px-6 border-b border-border bg-surface/85 backdrop-blur-md',
        className,
      )}
      aria-label="Application Header"
    >
      {/* Left: Mobile trigger / Sidebar toggle + Route Title */}
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-ring"
            aria-label="Open navigation menu"
          >
            <svg
              className="w-5 h-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        )}

        {/* Desktop Sidebar Toggle in Header */}
        {onSidebarToggle && (
          <button
            type="button"
            onClick={onSidebarToggle}
            className="hidden md:flex p-1.5 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-ring transition-colors"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={cn('w-4 h-4 transition-transform duration-200', isSidebarCollapsed && 'rotate-180')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <Link href="/" className="md:hidden">
            <CompanionPresence size="sm" showGreeting={false} />
          </Link>
          <span className="font-bold text-base sm:text-lg text-foreground tracking-tight uppercase">
            {currentItem.label}
          </span>
        </div>
      </div>

      {/* Right: Companion Status Pill + ThemeToggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-surface-muted border border-border text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-[10px] uppercase tracking-wider font-semibold">Active Presence</span>
        </div>

        {user && <NotificationsPopover />}

        {user && <QuickTasksPopover />}

        <ThemeToggle />

        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-border-subtle">
            <div
              className="w-7 h-7 rounded-md bg-[#111606] border border-primary/30 flex items-center justify-center font-bold text-primary text-xs font-mono"
              title={user.name || user.email}
            >
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <button
              type="button"
              onClick={() => logout()}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-ring transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
