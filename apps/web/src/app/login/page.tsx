'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function LoginPageContent() {
  const { login, error: authError, clearError } = useAuth();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const errParam = searchParams.get('error');
    if (errParam === 'oauth_unconfigured') {
      setLocalError('Google OAuth is not configured on this server. Please use email and password.');
    } else if (errParam === 'oauth_denied') {
      setLocalError('Google authentication was cancelled or access was denied.');
    } else if (errParam === 'oauth_failed') {
      setLocalError('Google authentication failed. Please try again or sign in with password.');
    } else if (errParam === 'oauth_invalid_state') {
      setLocalError('Invalid or expired OAuth security token. Please try signing in with Google again.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setLocalError(err.message || 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    window.location.href = `${apiUrl}/auth/google`;
  };

  const activeError = localError || authError;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Flashform Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block focus-ring rounded-lg">
            <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#111606] border border-primary/30 shadow-surface mb-2">
              <span className="font-black text-xl tracking-tighter text-primary font-mono">N</span>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary ring-2 ring-background" />
            </div>
          </Link>
          <p className="text-[10px] font-mono font-bold tracking-[0.2em] text-primary uppercase">
            [ PERSISTENT COMPANION ]
          </p>
          <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-foreground uppercase">
            Sign In to <span className="editorial-italic font-serif lowercase text-primary">NIVA</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Enter your credentials to access your continuous companion workspace
          </p>
        </div>

        {/* Card */}
        <div className="p-8 rounded-2xl border border-border bg-surface shadow-elevated space-y-6">
          {activeError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg border border-danger/30 bg-danger/10 text-danger text-xs font-medium flex items-start gap-2.5 animate-fadeIn"
            >
              <svg
                className="w-4 h-4 mt-0.5 shrink-0 text-danger"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{activeError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="login-email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              disabled={isSubmitting}
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">
                  Password
                </span>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline focus-ring rounded"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
                disabled={isSubmitting}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2 font-bold uppercase tracking-wider text-xs"
              isLoading={isSubmitting}
            >
              Sign In
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface px-2.5 text-[10px] font-mono text-muted-foreground font-bold tracking-widest">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2.5 text-xs font-bold uppercase tracking-wider"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Google
          </Button>
        </div>

        {/* Footer Navigation */}
        <p className="text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-bold text-primary hover:underline focus-ring rounded"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-background text-muted-foreground text-sm">
          Loading...
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

