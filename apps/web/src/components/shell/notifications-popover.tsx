'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import type { NotificationRecordDto } from '@niva/shared-types';

export function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecordDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await authFetch<{ unreadCount: number }>('/notifications/unread-count');
      if (res && typeof res.unreadCount === 'number') {
        setUnreadCount(res.unreadCount);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch<{ items: NotificationRecordDto[]; unreadCount: number }>(
        '/notifications?limit=20',
      );
      if (res && Array.isArray(res.items)) {
        setNotifications(res.items);
        setUnreadCount(res.unreadCount);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll unread count every 20 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 20000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Load items on popover open
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await authFetch(`/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Fail silently
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await authFetch('/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Fail silently
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'yesterday';
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-ring transition-colors cursor-pointer',
          isOpen && 'bg-surface-hover text-foreground',
        )}
        title="Notifications"
        aria-label="Open notifications"
        aria-expanded={isOpen}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-error opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-status-error"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-surface shadow-high z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="p-3.5 border-b border-border-subtle flex items-center justify-between bg-surface-muted/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border-subtle">
            {isLoading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-8 h-8 mx-auto rounded-full bg-surface-muted flex items-center justify-center text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-foreground">You're all caught up!</p>
                <p className="text-[11px] text-muted-foreground">No recent alerts or reminders.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => !item.read && handleMarkAsRead(item.id)}
                  className={cn(
                    'p-3.5 text-xs transition-colors cursor-pointer hover:bg-surface-hover/70 flex gap-3',
                    !item.read && 'bg-primary/5',
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full block',
                        item.read ? 'bg-transparent border border-border' : 'bg-primary',
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'font-medium truncate',
                          item.read ? 'text-muted-foreground' : 'text-foreground font-semibold',
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {item.body}
                    </p>

                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-surface-muted border border-border-subtle text-muted-foreground">
                        {item.channel}
                      </span>
                      {item.actionUrl && (
                        <Link
                          href={item.actionUrl}
                          onClick={() => setIsOpen(false)}
                          className="text-[10px] text-primary hover:underline"
                        >
                          View →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-border-subtle bg-surface-muted/30 text-center">
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              Configure notification preferences →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
