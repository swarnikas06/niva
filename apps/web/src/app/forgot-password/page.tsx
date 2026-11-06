'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ message: string; resetToken?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessInfo(null);

    if (!email) {
      setError('Please enter your account email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error?.message || 'Failed to request password reset');
      }

      setSuccessInfo({
        message: json.data?.message || 'If an account exists with this email, reset instructions have been sent.',
        resetToken: json.data?.resetToken,
      });
    } catch (err: any) {
      setError(err.message || 'Unable to connect to authentication server');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            [ PASSWORD RECOVERY ]
          </p>
          <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-foreground uppercase">
            Recover <span className="editorial-italic font-serif lowercase text-primary">Access</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Enter your account email to receive secure password recovery instructions
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

          {successInfo ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/10 text-foreground text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-primary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Recovery Instructions Dispatched</span>
                </div>
                <p className="text-muted-foreground">{successInfo.message}</p>
                {successInfo.resetToken && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Your Reset Token:</span>
                    <div className="mt-1 p-2 rounded bg-background border border-border font-mono text-[11px] select-all break-all text-primary">
                      {successInfo.resetToken}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Link
                  href={successInfo.resetToken ? `/reset-password?token=${encodeURIComponent(successInfo.resetToken)}` : '/reset-password'}
                  className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
                >
                  Proceed to Reset Password
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="recovery-email"
                label="Registered Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={isSubmitting}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2 font-bold uppercase tracking-wider text-xs"
                isLoading={isSubmitting}
              >
                Send Recovery Instructions
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
