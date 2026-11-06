'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { NivaIcon } from '@/components/ui/niva-logo';
import { Input } from '@/components/ui/input';
import { getApiBase } from '@/lib/auth-client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryToken = urlParams.get('token');
      if (queryToken) {
        setToken(queryToken);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Please provide the security reset token');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Password must contain at least one letter and one number');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${getApiBase()}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error?.message || 'Password reset failed');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Unable to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Flashform Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block focus-ring rounded-2xl mb-1">
            <div className="relative inline-flex items-center justify-center">
              <NivaIcon className="w-14 h-14 rounded-2xl shadow-elevated" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#10B981] ring-2 ring-background z-10" />
            </div>
          </Link>
          <p className="text-[10px] font-mono font-bold tracking-[0.2em] text-primary uppercase">
            [ CREDENTIAL RECOVERY ]
          </p>
          <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-foreground uppercase">
            Reset <span className="editorial-italic font-serif lowercase text-primary">Password</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Provide your security token and enter a strong new password
          </p>
        </div>

        {/* Card */}
        <div className="p-8 rounded-2xl border border-border bg-surface shadow-elevated space-y-6">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-lg border border-danger/30 bg-danger/10 text-danger text-xs font-medium flex items-start gap-2.5 animate-fadeIn"
            >
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/10 text-foreground text-xs space-y-2 text-center">
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary mx-auto flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-bold text-sm text-foreground">Password Successfully Updated</h2>
              <p className="text-muted-foreground">All active sessions have been securely revoked. Redirecting to login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="reset-token"
                label="Security Reset Token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.trim())}
                placeholder="Paste token received in recovery"
                required
                disabled={isSubmitting}
              />

              <Input
                id="reset-new-password"
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                disabled={isSubmitting}
              />

              <Input
                id="reset-confirm-password"
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                disabled={isSubmitting}
              />

              <p className="text-[11px] text-muted-foreground font-mono">
                Must contain at least 8 characters, 1 letter, and 1 number.
              </p>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2 font-bold uppercase tracking-wider text-xs"
                isLoading={isSubmitting}
              >
                Update Password & Invalidate Sessions
              </Button>
            </form>
          )}

          {/* Back to Sign In */}
          <div className="pt-4 border-t border-border text-center">
            <Link
              href="/login"
              className="text-xs font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 focus-ring rounded"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
