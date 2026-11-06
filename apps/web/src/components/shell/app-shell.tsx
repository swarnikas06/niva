'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { MobileDrawer, MobileBottomNav } from './mobile-nav';
import { useAuth } from '@/components/auth/auth-provider';
import { LoadingState } from '@/components/ui/loading-state';
import { ProactiveBanner } from './proactive-banner';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, personalization, isLoading } = useAuth();

  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password';
  const isOnboardingRoute = pathname === '/onboarding';
  const isRootRoute = pathname === '/';

  // Read sidebar collapsed preference and handle responsive half-screen width
  useEffect(() => {
    try {
      const stored = localStorage.getItem('niva-sidebar-collapsed');
      if (stored !== null) {
        setIsSidebarCollapsed(stored === 'true');
      } else if (typeof window !== 'undefined' && window.innerWidth < 1200) {
        setIsSidebarCollapsed(true);
      }
    } catch {
      // ignore
    }

    const handleResize = () => {
      // If window is resized below 1024 (e.g. snapped to half screen) and no explicit preference set
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        if (!localStorage.getItem('niva-sidebar-collapsed')) {
          setIsSidebarCollapsed(true);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('niva-sidebar-collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isLoading) {
      // If not authenticated and attempting to visit a protected route (not auth, not public root)
      if (!isAuthenticated && !isAuthRoute && !isRootRoute) {
        router.push('/login');
      } else if (isAuthenticated) {
        if (isAuthRoute) {
          if (personalization && !personalization.onboardingCompleted) {
            router.push('/onboarding');
          } else {
            router.push('/');
          }
        } else if (!isOnboardingRoute && personalization && !personalization.onboardingCompleted) {
          router.push('/onboarding');
        } else if (isOnboardingRoute && personalization && personalization.onboardingCompleted) {
          router.push('/');
        }
      }
    }
  }, [isAuthenticated, personalization, isLoading, isAuthRoute, isOnboardingRoute, isRootRoute, router]);

  // Auth routes (login/register) render standalone without application shell
  if (isAuthRoute) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  // Onboarding route renders standalone focused viewport
  if (isOnboardingRoute) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  // Public root route when user is unauthenticated: renders the Public Landing Page standalone
  if (isRootRoute && !isAuthenticated && !isLoading) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  // Initial session loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <LoadingState message="Connecting to NIVA..." />
      </div>
    );
  }

  // Not authenticated on protected route redirecting state
  if (!isAuthenticated && !isRootRoute) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <LoadingState message="Redirecting to sign in..." />
      </div>
    );
  }

  // Unfinished onboarding state redirecting
  if (personalization && !personalization.onboardingCompleted) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <LoadingState message="Setting up your companion..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Skip to Main Content Link for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg shadow-elevated focus-ring"
      >
        Skip to main content
      </a>

      {/* Desktop & Tablet Collapsible Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
      />

      {/* Main Content Viewport — expands seamlessly when sidebar collapses */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 transition-all duration-200">
        <Header
          onMenuToggle={() => setMobileDrawerOpen(true)}
          onSidebarToggle={toggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
        />
        <ProactiveBanner />

        <main id="main-content" className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
}
