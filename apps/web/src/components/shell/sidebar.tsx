'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CompanionPresence } from './companion-presence';
import { ThemeToggle } from '../theme/theme-toggle';
import { APP_CONFIG } from '@niva/config';
import { useAuth } from '@/components/auth/auth-provider';

export interface NavItem {
  label: string;
  href: string;
  icon: (props: { className?: string }) => React.ReactNode;
}

export const NAVIGATION_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: 'Conversation',
    href: '/conversation',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: 'Life',
    href: '/life',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Study',
    href: '/study',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M6 6h10" />
        <path d="M6 10h10" />
      </svg>
    ),
  },
  {
    label: 'Reflection',
    href: '/reflection',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    label: 'Growth',
    href: '/growth',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    ),
  },
  {
    label: 'Characters',
    href: '/characters',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: ({ className }) => (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export function Sidebar({
  className = '',
  isCollapsed,
  onToggleCollapse,
}: {
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Local fallback if not controlled from parent
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('niva-sidebar-collapsed');
      if (stored !== null) {
        setInternalCollapsed(stored === 'true');
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      const next = !internalCollapsed;
      setInternalCollapsed(next);
      try {
        localStorage.setItem('niva-sidebar-collapsed', String(next));
      } catch {
        // ignore
      }
    }
  };

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen border-r border-border bg-surface flex-shrink-0 select-none z-30 sticky top-0 transition-all duration-200 ease-in-out',
        collapsed ? 'w-20' : 'w-64 lg:w-72',
        className,
      )}
      aria-label="Main Navigation"
    >
      {/* Presence Brand Header & Collapse Toggle */}
      <div
        className={cn(
          'border-b border-border-subtle flex items-center justify-between transition-all duration-200',
          collapsed ? 'p-3 flex-col gap-3' : 'p-5',
        )}
      >
        <Link
          href="/"
          className="focus-ring rounded-lg p-1 -m-1 block"
          aria-label="NIVA Home"
          title="NIVA Home"
        >
          <CompanionPresence size={collapsed ? 'sm' : 'md'} showGreeting={!collapsed} />
        </Link>

        {/* Accessible Collapse Toggle Button */}
        <button
          type="button"
          onClick={handleToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-ring transition-colors"
        >
          <svg
            className={cn('w-4 h-4 transition-transform duration-200', collapsed && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1">
        {NAVIGATION_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              className={cn(
                'group flex items-center rounded-lg text-sm font-medium transition-colors duration-150 focus-ring',
                collapsed ? 'justify-center p-3' : 'justify-between py-2.5 pl-3.5 pr-3.5',
                isActive
                  ? 'bg-primary/15 text-primary font-semibold border-l-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover',
              )}
            >
              <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
                <Icon
                  className={cn(
                    'w-5 h-5 transition-colors shrink-0',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
                {!collapsed && (
                  <span className="tracking-tight truncate">{item.label}</span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Identity & Logout */}
      {user && (
        <div
          className={cn(
            'mx-2 mb-2 rounded-lg bg-surface-muted/60 border border-border flex items-center',
            collapsed ? 'p-2 justify-center' : 'p-2.5 justify-between',
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg bg-[#111606] border border-primary/30 flex items-center justify-center shrink-0 font-bold text-primary text-xs font-mono"
              title={user.name || user.email}
            >
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-foreground truncate tracking-tight">
                  {user.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                  {user.email}
                </span>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={() => logout()}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-ring transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Sidebar Footer */}
      <div
        className={cn(
          'p-3 border-t border-border-subtle flex items-center',
          collapsed ? 'flex-col gap-2 justify-center' : 'justify-between',
        )}
      >
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              {APP_CONFIG.name}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Persistent Companion
            </span>
          </div>
        )}
        <ThemeToggle />
      </div>
    </aside>
  );
}
