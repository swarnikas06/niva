'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAVIGATION_ITEMS } from './sidebar';
import { CompanionPresence } from './companion-presence';
import { ThemeToggle } from '../theme/theme-toggle';
import { useAuth } from '@/components/auth/auth-provider';

export function MobileDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
  }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Close drawer upon route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Content */}
      <div className="fixed inset-y-0 left-0 w-4/5 max-w-xs bg-surface border-r border-border p-5 shadow-elevated flex flex-col justify-between animate-in slide-in-from-left duration-200">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-border-subtle">
            <CompanionPresence size="md" showGreeting={true} />
            <button
              type="button"
              onClick={onClose}
              className="p-2 -mr-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-ring"
              aria-label="Close navigation menu"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="py-4 space-y-1">
            {NAVIGATION_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center justify-between py-2.5 rounded-lg text-sm font-medium transition-colors focus-ring',
                    isActive
                      ? 'bg-primary/15 text-primary font-semibold border-l-2 border-primary pl-3 pr-3.5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover pl-3.5 pr-3.5',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="tracking-tight">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Identity & Logout */}
        {user && (
          <div className="p-3 mb-3 rounded-lg bg-surface-muted/60 border border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#111606] border border-primary/30 flex items-center justify-center shrink-0 font-bold text-primary text-xs font-mono">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-foreground truncate tracking-tight">{user.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono truncate">{user.email}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-ring transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Theme Mode</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  // Primary 4 tabs for compact mobile bottom bar: Home, Conversation, Life, Growth
  const primaryTabs = NAVIGATION_ITEMS.slice(0, 4);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-border bg-surface/95 backdrop-blur-md flex items-center justify-around px-2"
      aria-label="Mobile Navigation"
    >
      {primaryTabs.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors focus-ring rounded-md',
              isActive
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className={cn('w-5 h-5 mb-1', isActive && 'text-primary')} />
            <span className="tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
