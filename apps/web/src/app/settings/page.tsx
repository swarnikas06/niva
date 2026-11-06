'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/ui/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/components/theme/theme-provider';
import { useAuth } from '@/components/auth/auth-provider';
import { authFetch } from '@/lib/auth-client';
import { APP_CONFIG } from '@niva/config';
import {
  CharacterArchetypeDto,
  UserPersonalizationDto,
  UserProactivePreferencesDto,
  PrimaryFocus,
  ProactivityLevel,
  ResponseLength,
} from '@niva/shared-types';
import {
  checkPushSupport,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  sendTestPushNotification,
  getCurrentSubscription,
  PushPermissionState,
} from '@/lib/push-notifications';

const FOCUS_OPTIONS: { id: PrimaryFocus; label: string; desc: string }[] = [
  { id: 'technical_placement', label: 'Placement & Prep', desc: 'Technical prep, interview readiness, and discipline' },
  { id: 'deep_work', label: 'Deep Work & Shipping', desc: 'Engineering execution and project focus' },
  { id: 'academic_learning', label: 'Academic Mastery', desc: 'Deep-dive learning, theory, and study' },
  { id: 'general_growth', label: 'General Growth', desc: 'Holistic daily reflection, clarity, and habits' },
];

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, personalization, setPersonalizationState, refreshPersonalization } = useAuth();

  const [archetypes, setArchetypes] = useState<CharacterArchetypeDto[]>([]);
  const [preferredName, setPreferredName] = useState('');
  const [selectedArchetypeId, setSelectedArchetypeId] = useState('niva_anchor');
  const [primaryFocus, setPrimaryFocus] = useState<PrimaryFocus>('general_growth');
  const [warmthUi, setWarmthUi] = useState(3);
  const [directnessUi, setDirectnessUi] = useState(3);
  const [proactivity, setProactivity] = useState<ProactivityLevel>('medium');
  const [responseLength, setResponseLength] = useState<ResponseLength>('balanced');

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Phase 4: Proactive & Quiet Hours state
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  const [timezone, setTimezone] = useState('UTC');
  const [maxDailyInteractions, setMaxDailyInteractions] = useState(3);
  const [allowHighUrgencyInQuietHours, setAllowHighUrgencyInQuietHours] = useState(false);
  const [isSavingProactive, setIsSavingProactive] = useState(false);
  const [proactiveFeedback, setProactiveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Browser Push & Delivery Channels state
  const [pushPermission, setPushPermission] = useState<PushPermissionState>('default');
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [browserEnabled, setBrowserEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [advanceReminderDays, setAdvanceReminderDays] = useState(2);
  const [progressCheckHours, setProgressCheckHours] = useState(24);
  const [finalReminderHours, setFinalReminderHours] = useState(2);
  const [morningCheckinEnabled, setMorningCheckinEnabled] = useState(true);
  const [morningCheckinTime, setMorningCheckinTime] = useState('09:00');
  const [eveningCheckinEnabled, setEveningCheckinEnabled] = useState(true);
  const [eveningCheckinTime, setEveningCheckinTime] = useState('18:00');
  const [weeklyReflectionEnabled, setWeeklyReflectionEnabled] = useState(true);
  const [enabledCategories, setEnabledCategories] = useState<string[]>([
    'deadline_reminders',
    'study_checkins',
    'project_followups',
    'goal_progress',
    'daily_companion',
    'milestone_acknowledgements',
    'gentle_inactivity',
  ]);

  // Check browser push support & active subscription status on mount
  useEffect(() => {
    const support = checkPushSupport();
    setPushPermission(support.permission);
    if (support.supported) {
      getCurrentSubscription().then((sub) => {
        setIsPushSubscribed(Boolean(sub));
      });
    }
  }, []);

  // Load archetypes for archetype picker
  useEffect(() => {
    async function loadArchetypes() {
      try {
        const data = await authFetch<CharacterArchetypeDto[]>('/characters');
        if (data) setArchetypes(data);
      } catch {
        // Fallback gracefully
      }
    }
    loadArchetypes();
  }, []);

  // Load proactive companion preferences & notification timings
  useEffect(() => {
    async function loadProactivePreferences() {
      try {
        const prefs = await authFetch<UserProactivePreferencesDto>('/proactive/preferences');
        if (prefs) {
          setProactiveEnabled(prefs.proactiveEnabled);
          setQuietHoursEnabled(prefs.quietHoursEnabled);
          setQuietHoursStart(prefs.quietHoursStart);
          setQuietHoursEnd(prefs.quietHoursEnd);
          setTimezone(prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
          setMaxDailyInteractions(prefs.maxDailyInteractions);
          setAllowHighUrgencyInQuietHours(prefs.allowHighUrgencyInQuietHours);
          if (prefs.inAppEnabled !== undefined) setInAppEnabled(prefs.inAppEnabled);
          if (prefs.browserEnabled !== undefined) setBrowserEnabled(prefs.browserEnabled);
          if (prefs.emailEnabled !== undefined) setEmailEnabled(prefs.emailEnabled);
          if (prefs.advanceReminderDays !== undefined) setAdvanceReminderDays(prefs.advanceReminderDays);
          if (prefs.progressCheckHours !== undefined) setProgressCheckHours(prefs.progressCheckHours);
          if (prefs.finalReminderHours !== undefined) setFinalReminderHours(prefs.finalReminderHours);
          if (prefs.morningCheckinEnabled !== undefined) setMorningCheckinEnabled(prefs.morningCheckinEnabled);
          if (prefs.morningCheckinTime) setMorningCheckinTime(prefs.morningCheckinTime);
          if (prefs.eveningCheckinEnabled !== undefined) setEveningCheckinEnabled(prefs.eveningCheckinEnabled);
          if (prefs.eveningCheckinTime) setEveningCheckinTime(prefs.eveningCheckinTime);
          if (prefs.weeklyReflectionEnabled !== undefined) setWeeklyReflectionEnabled(prefs.weeklyReflectionEnabled);
          if (prefs.enabledCategories) setEnabledCategories(prefs.enabledCategories);
        }
      } catch {
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      }
    }
    loadProactivePreferences();
  }, []);

  const handleSaveProactivePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProactive(true);
    setProactiveFeedback(null);

    try {
      await authFetch<UserProactivePreferencesDto>('/proactive/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          proactiveEnabled,
          quietHoursEnabled,
          quietHoursStart,
          quietHoursEnd,
          timezone,
          maxDailyInteractions,
          allowHighUrgencyInQuietHours,
          inAppEnabled,
          browserEnabled,
          emailEnabled,
          advanceReminderDays,
          progressCheckHours,
          finalReminderHours,
          morningCheckinEnabled,
          morningCheckinTime,
          eveningCheckinEnabled,
          eveningCheckinTime,
          weeklyReflectionEnabled,
          enabledCategories,
        }),
      });
      setProactiveFeedback({ type: 'success', message: 'Preferences updated successfully.' });
      setTimeout(() => setProactiveFeedback(null), 4000);
    } catch (err: any) {
      setProactiveFeedback({ type: 'error', message: err.message || 'Failed to update preferences.' });
    } finally {
      setIsSavingProactive(false);
    }
  };

  const handleTogglePushNotifications = async () => {
    setPushFeedback(null);
    setIsSubscribingPush(true);

    if (isPushSubscribed) {
      // Unsubscribe
      const res = await unsubscribeFromPushNotifications();
      if (res.success) {
        setIsPushSubscribed(false);
        setPushFeedback({
          type: 'success',
          message: 'Browser push notifications have been disabled on this device.',
        });
      } else {
        setPushFeedback({
          type: 'error',
          message: res.error || 'Failed to unsubscribe.',
        });
      }
      setIsSubscribingPush(false);
    } else {
      // Subscribe
      const res = await subscribeToPushNotifications();
      const updatedSupport = checkPushSupport();
      setPushPermission(updatedSupport.permission);

      if (res.success) {
        setIsPushSubscribed(true);
        setBrowserEnabled(true);
        setPushFeedback({
          type: 'success',
          message: 'Browser push notifications connected! Your device is registered with NIVA.',
        });
        // Auto-persist browserEnabled = true in preferences
        authFetch('/proactive/preferences', {
          method: 'PUT',
          body: JSON.stringify({ browserEnabled: true }),
        }).catch(() => {});
      } else {
        setPushFeedback({
          type: 'error',
          message: res.error || 'Could not subscribe to push notifications.',
        });
      }
      setIsSubscribingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    setIsSendingTestPush(true);
    setPushFeedback(null);
    const res = await sendTestPushNotification();
    if (res.success) {
      setPushFeedback({
        type: 'success',
        message: 'Test notification dispatched! Check your desktop notification center or active browser tabs.',
      });
    } else {
      setPushFeedback({
        type: 'error',
        message: res.error || 'Failed to send test notification.',
      });
    }
    setIsSendingTestPush(false);
  };

  // Account & Security states
  const [profileName, setProfileName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [isRequestingEmailVerif, setIsRequestingEmailVerif] = useState(false);
  const [emailVerifFeedback, setEmailVerifFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [logoutAllFeedback, setLogoutAllFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [isExportingData, setIsExportingData] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Initialize form state when personalization/user is loaded
  useEffect(() => {
    if (personalization) {
      setPreferredName(personalization.preferredName || user?.name || '');
      setSelectedArchetypeId(personalization.selectedArchetypeId || 'niva_anchor');
      setPrimaryFocus(personalization.primaryFocus || 'general_growth');
      setWarmthUi(personalization.warmth ? Math.round(personalization.warmth / 20) : 3);
      setDirectnessUi(personalization.directness ? Math.round(personalization.directness / 20) : 3);
      setProactivity(personalization.proactivity || 'medium');
      setResponseLength(personalization.responseLength || 'balanced');
    }
    if (user) {
      setProfileName(user.name || '');
      if (!personalization) {
        setPreferredName(user.name || '');
      }
    }
  }, [personalization, user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    setIsSavingProfile(true);
    setProfileFeedback(null);
    try {
      await authFetch('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: profileName.trim() }),
      });
      setProfileFeedback({ type: 'success', message: 'Profile updated successfully.' });
      setTimeout(() => setProfileFeedback(null), 4000);
    } catch (err: any) {
      setProfileFeedback({ type: 'error', message: err.message || 'Failed to update profile.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRequestEmailVerification = async () => {
    setIsRequestingEmailVerif(true);
    setEmailVerifFeedback(null);
    try {
      const res = await authFetch<{ success: boolean; message: string; verificationToken?: string }>('/auth/verify-email/request', {
        method: 'POST',
      });
      setEmailVerifFeedback({
        type: 'success',
        message: res.message || 'Verification token dispatched. Check your email.',
      });
      setTimeout(() => setEmailVerifFeedback(null), 5000);
    } catch (err: any) {
      setEmailVerifFeedback({ type: 'error', message: err.message || 'Failed to request email verification.' });
    } finally {
      setIsRequestingEmailVerif(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    if (!currentPassword || !newPassword) {
      setPasswordFeedback({ type: 'error', message: 'Please provide both current and new password.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', message: 'New password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    setIsChangingPassword(true);
    try {
      await authFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordFeedback({
        type: 'success',
        message: 'Password changed successfully. Other active sessions have been invalidated.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordFeedback(null), 5000);
    } catch (err: any) {
      setPasswordFeedback({ type: 'error', message: err.message || 'Failed to change password.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogoutAll = async () => {
    setIsLoggingOutAll(true);
    setLogoutAllFeedback(null);
    try {
      await authFetch('/auth/logout-all', { method: 'POST' });
      window.location.href = '/login';
    } catch (err: any) {
      setLogoutAllFeedback({ type: 'error', message: err.message || 'Failed to sign out from all sessions.' });
      setIsLoggingOutAll(false);
    }
  };

  const handleExportData = async () => {
    setIsExportingData(true);
    setExportFeedback(null);
    try {
      const data = await authFetch<Record<string, any>>('/auth/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `niva-user-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportFeedback({ type: 'success', message: 'Personal data archive exported successfully.' });
      setTimeout(() => setExportFeedback(null), 4000);
    } catch (err: any) {
      setExportFeedback({ type: 'error', message: err.message || 'Failed to export account data.' });
    } finally {
      setIsExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm');
      return;
    }
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      await authFetch('/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirmText: 'DELETE', password: deletePassword || undefined }),
      });
      window.location.href = '/login';
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account. Please check your password.');
      setIsDeletingAccount(false);
    }
  };

  const handleSavePersonalization = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const payload = {
        preferredName: preferredName.trim() || undefined,
        selectedArchetypeId,
        primaryFocus,
        warmth: warmthUi * 20,
        directness: directnessUi * 20,
        proactivity,
        responseLength,
      };

      const updated = await authFetch<UserPersonalizationDto>('/personalization/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setPersonalizationState(updated);
      await refreshPersonalization();
      setFeedback({ type: 'success', message: 'Companion personalization updated successfully.' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update personalization settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer maxWidth="md" className="py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Companion personalization, appearance, and system foundation
        </p>
      </div>

      <div className="space-y-6">
        {/* Companion Personalization Card */}
        <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-6">
          <div className="flex items-center justify-between border-b border-border-subtle pb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Companion Personalization
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customize how NIVA addresses you, behaves, and communicates
              </p>
            </div>
            <Link
              href="/characters"
              className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
            >
              Browse Archetypes Catalog &rarr;
            </Link>
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium ${
                feedback.type === 'success'
                  ? 'bg-success/10 text-success border border-success/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {feedback.message}
            </div>
          )}

          <form onSubmit={handleSavePersonalization} className="space-y-6">
            {/* Preferred Name */}
            <div>
              <label htmlFor="settings-name" className="block text-xs font-medium text-foreground mb-1.5">
                Preferred Name
              </label>
              <Input
                id="settings-name"
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="What should NIVA call you?"
                className="max-w-md"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                The name NIVA uses when speaking to you.
              </p>
            </div>

            {/* Companion Archetype Selector */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Active Archetype
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {archetypes.map((arch) => {
                  const isSelected = selectedArchetypeId === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => setSelectedArchetypeId(arch.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-card ring-1 ring-primary/40 shadow-xs'
                          : 'border-border bg-surface hover:border-foreground/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-foreground">{arch.name}</span>
                        {isSelected && <Badge variant="presence" size="sm">Active</Badge>}
                      </div>
                      <p className="text-2xs text-muted-foreground line-clamp-2">{arch.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary Focus */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Primary Focus
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FOCUS_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPrimaryFocus(f.id)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      primaryFocus === f.id
                        ? 'border-primary bg-card text-foreground font-medium ring-1 ring-primary/40 shadow-xs'
                        : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="font-semibold text-foreground text-xs">{f.label}</div>
                    <div className="text-2xs text-muted-foreground mt-0.5 truncate">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Behavioral Sliders (Warmth & Directness) */}
            <div className="space-y-4 pt-2 border-t border-border-subtle">
              <h3 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                Behavioral Tone & Temperament
              </h3>

              {/* Warmth */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-foreground">Warmth</span>
                  <span className="text-muted-foreground font-mono">Level {warmthUi} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={warmthUi}
                  onChange={(e) => setWarmthUi(parseInt(e.target.value, 10))}
                  className="w-full accent-brand-indigo cursor-pointer"
                />
                <div className="flex justify-between text-2xs font-mono text-muted-foreground">
                  <span>Objective & Analytical</span>
                  <span>Deeply Empathetic & Warm</span>
                </div>
              </div>

              {/* Directness */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-foreground">Directness</span>
                  <span className="text-muted-foreground font-mono">Level {directnessUi} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={directnessUi}
                  onChange={(e) => setDirectnessUi(parseInt(e.target.value, 10))}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-2xs font-mono text-muted-foreground">
                  <span>Gentle & Exploratory</span>
                  <span>Candid & Unfiltered</span>
                </div>
              </div>
            </div>

            {/* Proactivity & Response Length */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Proactivity Level
                </label>
                <div className="flex rounded-xl border border-border p-1 bg-surface-subtle">
                  {(['low', 'medium', 'high'] as ProactivityLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setProactivity(lvl)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
                        proactivity === lvl
                          ? 'bg-surface text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Response Length
                </label>
                <div className="flex rounded-xl border border-border p-1 bg-surface-subtle">
                  {(['concise', 'balanced', 'thorough'] as ResponseLength[]).map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setResponseLength(len)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
                        responseLength === len
                          ? 'bg-surface text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving Changes...' : 'Save Personalization'}
              </Button>
            </div>
          </form>
        </div>

        {/* Appearance & Theming Card */}
        <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Appearance
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose your preferred visual theme for NIVA
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-3.5 rounded-xl border text-center transition-all focus-ring cursor-pointer ${
                theme === 'light'
                  ? 'border-primary bg-card ring-1 ring-primary/40 shadow-xs'
                  : 'border-border bg-surface hover:bg-surface-hover'
              }`}
            >
              <div className="w-6 h-6 mx-auto mb-2 text-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              </div>
              <span className="text-xs font-semibold block text-foreground">
                Light
              </span>
              <span className="text-2xs font-mono text-muted-foreground block">
                Architectural
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-3.5 rounded-xl border text-center transition-all focus-ring cursor-pointer ${
                theme === 'dark'
                  ? 'border-primary bg-card ring-1 ring-primary/40 shadow-xs'
                  : 'border-border bg-surface hover:bg-surface-hover'
              }`}
            >
              <div className="w-6 h-6 mx-auto mb-2 text-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 0 1 1-9-9Z" />
                </svg>
              </div>
              <span className="text-xs font-semibold block text-foreground">
                Dark
              </span>
              <span className="text-2xs font-mono text-muted-foreground block">
                Deep Black
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('system')}
              className={`p-3.5 rounded-xl border text-center transition-all focus-ring cursor-pointer ${
                theme === 'system'
                  ? 'border-primary bg-card ring-1 ring-primary/40 shadow-xs'
                  : 'border-border bg-surface hover:bg-surface-hover'
              }`}
            >
              <div className="w-6 h-6 mx-auto mb-2 text-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect width="20" height="14" x="2" y="3" rx="2" />
                  <line x1="8" x2="16" y1="21" y2="21" />
                  <line x1="12" x2="12" y1="17" y2="21" />
                </svg>
              </div>
              <span className="text-xs font-semibold block text-foreground">
                System
              </span>
              <span className="text-2xs font-mono text-muted-foreground block">
                Auto Detect
              </span>
            </button>
          </div>

          <div className="pt-2 text-xs text-muted-foreground flex items-center justify-between border-t border-border-subtle">
            <span>Currently active: <strong className="text-foreground capitalize">{resolvedTheme}</strong> mode</span>
          </div>
        </div>

        {/* Proactive Companion & Quiet Hours Card */}
        <form onSubmit={handleSaveProactivePreferences} className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-6">
          <div className="flex items-center justify-between border-b border-border-subtle pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  Proactive Companion & Quiet Hours
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deterministic policy guardrails, quiet hours, and daily interaction limits
              </p>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSavingProactive}
            >
              {isSavingProactive ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>

          {proactiveFeedback && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                proactiveFeedback.type === 'success'
                  ? 'bg-status-success/10 text-status-success border border-status-success/20'
                  : 'bg-status-error/10 text-status-error border border-status-error/20'
              }`}
            >
              {proactiveFeedback.message}
            </div>
          )}

          <div className="space-y-4">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border-subtle bg-surface-muted">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Proactive Companion Behavior
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  Allow NIVA to initiate thoughtful check-ins based on task changes and commitments
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={proactiveEnabled}
                  onChange={(e) => setProactiveEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>

            {/* Quiet Hours Section */}
            <div className="p-4 rounded-xl border border-border-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    Quiet Hours Protection
                  </span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    Suppress all non-critical proactive interventions during your downtime
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quietHoursEnabled}
                    onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {quietHoursEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Start Time (HH:mm)
                    </label>
                    <Input
                      type="text"
                      value={quietHoursStart}
                      onChange={(e) => setQuietHoursStart(e.target.value)}
                      placeholder="22:00"
                      className="text-xs h-8"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      End Time (HH:mm)
                    </label>
                    <Input
                      type="text"
                      value={quietHoursEnd}
                      onChange={(e) => setQuietHoursEnd(e.target.value)}
                      placeholder="08:00"
                      className="text-xs h-8"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Timezone (IANA)
                    </label>
                    <Input
                      type="text"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="e.g. Asia/Kolkata"
                      className="text-xs h-8"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="high-urgency-quiet"
                  checked={allowHighUrgencyInQuietHours}
                  onChange={(e) => setAllowHighUrgencyInQuietHours(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="high-urgency-quiet" className="text-[11px] text-muted-foreground cursor-pointer">
                  Allow high-urgency notifications during quiet hours (e.g. urgent commitments)
                </label>
              </div>
            </div>

            {/* Daily Interaction Cap */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border-subtle">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Daily Interaction Cap
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  Maximum proactive messages delivered per day (strictly prevents notification spam)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 5].map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setMaxDailyInteractions(cap)}
                    className={`w-8 h-8 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                      maxDailyInteractions === cap
                        ? 'bg-primary text-white shadow-xs'
                        : 'border border-border text-muted-foreground hover:bg-surface'
                    }`}
                  >
                    {cap}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        {/* Browser Push Notifications & Reminders Card */}
        <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-foreground">
                  Browser Push & Reminder Intelligence
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                    isPushSubscribed
                      ? 'bg-status-success/15 text-status-success border border-status-success/30'
                      : pushPermission === 'denied'
                      ? 'bg-status-error/15 text-status-error border border-status-error/30'
                      : pushPermission === 'unsupported'
                      ? 'bg-surface-muted text-muted-foreground border border-border'
                      : 'bg-status-warning/15 text-status-warning border border-status-warning/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isPushSubscribed
                        ? 'bg-status-success animate-pulse'
                        : pushPermission === 'denied'
                        ? 'bg-status-error'
                        : 'bg-status-warning'
                    }`}
                  />
                  {isPushSubscribed
                    ? 'Active & Subscribed'
                    : pushPermission === 'denied'
                    ? 'Blocked by Browser'
                    : pushPermission === 'unsupported'
                    ? 'Unsupported'
                    : 'Not Subscribed'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Stay on top of commitments, approaching deadlines, and study goals even when NIVA is closed or running in the background.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {isPushSubscribed && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestPush}
                  disabled={isSendingTestPush}
                >
                  {isSendingTestPush ? 'Sending...' : 'Send Test Alert'}
                </Button>
              )}

              <Button
                type="button"
                variant={isPushSubscribed ? 'outline' : 'primary'}
                size="sm"
                onClick={handleTogglePushNotifications}
                disabled={isSubscribingPush || pushPermission === 'unsupported'}
              >
                {isSubscribingPush
                  ? 'Connecting...'
                  : isPushSubscribed
                  ? 'Disable Push'
                  : 'Enable Push Notifications'}
              </Button>
            </div>
          </div>

          {pushFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium ${
                pushFeedback.type === 'success'
                  ? 'bg-status-success/10 text-status-success border border-status-success/20'
                  : 'bg-status-error/10 text-status-error border border-status-error/20'
              }`}
            >
              {pushFeedback.message}
            </div>
          )}

          {pushPermission === 'denied' && (
            <div className="p-3.5 rounded-xl bg-status-error/10 border border-status-error/20 text-xs text-status-error flex items-start gap-2.5">
              <span className="font-bold">⚠️</span>
              <div>
                <p className="font-semibold">Browser Notifications are Blocked</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Your browser has denied notification permission for this site. Click the lock or settings icon next to the URL in your browser address bar, change Notifications to <strong>Allow</strong>, and refresh the page.
                </p>
              </div>
            </div>
          )}

          {/* Delivery Channels Grid */}
          <div className="border-t border-border-subtle pt-5 space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Delivery Channels
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* In-App */}
              <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-muted/50 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground block">In-App Alerts</span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">Header bell & feed</span>
                </div>
                <input
                  type="checkbox"
                  checked={inAppEnabled}
                  onChange={(e) => setInAppEnabled(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              {/* Browser Push */}
              <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-muted/50 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground block">Desktop Push</span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">Web Notification API</span>
                </div>
                <input
                  type="checkbox"
                  checked={browserEnabled}
                  onChange={(e) => setBrowserEnabled(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              {/* Email */}
              <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-muted/50 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground block">Email Summaries</span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">Direct to {user?.email || 'your email'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Reminder Timing Intelligence */}
          <div className="border-t border-border-subtle pt-5 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Three-Tier Reminder Timing
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Configurable lead times for upcoming assignment and task deadlines. NIVA automatically scales intervals for urgent deadlines.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Advance Notice */}
              <div className="p-3.5 rounded-xl border border-border-subtle">
                <label className="text-xs font-semibold text-foreground block mb-1">
                  1. Advance Notice
                </label>
                <span className="text-[10px] text-muted-foreground block mb-2">Lead time for planning</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 5].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setAdvanceReminderDays(d)}
                      className={`flex-1 py-1 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                        advanceReminderDays === d
                          ? 'bg-primary text-white shadow-xs'
                          : 'border border-border text-muted-foreground hover:bg-surface'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress Check */}
              <div className="p-3.5 rounded-xl border border-border-subtle">
                <label className="text-xs font-semibold text-foreground block mb-1">
                  2. Progress Check
                </label>
                <span className="text-[10px] text-muted-foreground block mb-2">Check-in before due date</span>
                <div className="flex gap-1">
                  {[12, 24, 36, 48].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setProgressCheckHours(h)}
                      className={`flex-1 py-1 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                        progressCheckHours === h
                          ? 'bg-primary text-white shadow-xs'
                          : 'border border-border text-muted-foreground hover:bg-surface'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Final Alert */}
              <div className="p-3.5 rounded-xl border border-border-subtle">
                <label className="text-xs font-semibold text-foreground block mb-1">
                  3. Final Alert
                </label>
                <span className="text-[10px] text-muted-foreground block mb-2">Urgent countdown alert</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setFinalReminderHours(h)}
                      className={`flex-1 py-1 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                        finalReminderHours === h
                          ? 'bg-primary text-white shadow-xs'
                          : 'border border-border text-muted-foreground hover:bg-surface'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scheduled Companion Moments & Category Opt-Ins */}
            <div className="pt-4 border-t border-border-subtle space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Scheduled Companion Moments</h3>
                <p className="text-xs text-muted-foreground">Configurable, contextual daily check-ins and reflection moments</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Morning Check-in */}
                <div className="p-3.5 rounded-xl border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Morning Intentions</label>
                    <input
                      type="checkbox"
                      checked={morningCheckinEnabled}
                      onChange={(e) => setMorningCheckinEnabled(e.target.checked)}
                      className="rounded accent-primary cursor-pointer"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground block">Clarify daily focus and priority</span>
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-mono text-muted-foreground">Time:</span>
                    <input
                      type="time"
                      value={morningCheckinTime}
                      onChange={(e) => setMorningCheckinTime(e.target.value)}
                      disabled={!morningCheckinEnabled}
                      className="px-2 py-0.5 text-xs font-mono rounded border border-border bg-surface text-foreground"
                    />
                  </div>
                </div>

                {/* Evening Check-in */}
                <div className="p-3.5 rounded-xl border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Evening Decompression</label>
                    <input
                      type="checkbox"
                      checked={eveningCheckinEnabled}
                      onChange={(e) => setEveningCheckinEnabled(e.target.checked)}
                      className="rounded accent-primary cursor-pointer"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground block">Unwind and review day's progress</span>
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-mono text-muted-foreground">Time:</span>
                    <input
                      type="time"
                      value={eveningCheckinTime}
                      onChange={(e) => setEveningCheckinTime(e.target.value)}
                      disabled={!eveningCheckinEnabled}
                      className="px-2 py-0.5 text-xs font-mono rounded border border-border bg-surface text-foreground"
                    />
                  </div>
                </div>

                {/* Weekly Reflection */}
                <div className="p-3.5 rounded-xl border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Weekly Reflection</label>
                    <input
                      type="checkbox"
                      checked={weeklyReflectionEnabled}
                      onChange={(e) => setWeeklyReflectionEnabled(e.target.checked)}
                      className="rounded accent-primary cursor-pointer"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground block">Synthesize habits, milestones & lessons</span>
                  <span className="text-[10px] font-mono text-primary font-medium block pt-1">Every Sunday</span>
                </div>
              </div>

              {/* Notification Category Filters */}
              <div className="pt-2">
                <span className="text-xs font-semibold text-foreground block mb-1.5">Active Notification Categories</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'deadline_reminders', label: 'Deadlines' },
                    { id: 'study_checkins', label: 'Study Sprints' },
                    { id: 'project_followups', label: 'Projects' },
                    { id: 'daily_companion', label: 'Companion Moments' },
                    { id: 'milestone_acknowledgements', label: 'Milestones' },
                    { id: 'gentle_inactivity', label: 'Inactivity Check-in' },
                  ].map((cat) => {
                    const isChecked = enabledCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setEnabledCategories(enabledCategories.filter((c) => c !== cat.id));
                          } else {
                            setEnabledCategories([...enabledCategories, cat.id]);
                          }
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-all cursor-pointer ${
                          isChecked
                            ? 'border-primary bg-primary/10 text-primary font-bold'
                            : 'border-border text-muted-foreground hover:bg-surface'
                        }`}
                      >
                        {isChecked ? '✓ ' : '+ '}
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSaveProactivePreferences}
                disabled={isSavingProactive}
              >
                {isSavingProactive ? 'Saving...' : 'Save Notification Timings'}
              </Button>
            </div>
          </div>
        </div>

        {/* Account Management, Security & Data Privacy Card */}
        <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-6">
          <div className="border-b border-border-subtle pb-4">
            <h2 className="text-base font-semibold text-foreground">
              Account Management, Security & Privacy
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Profile details, email verification, session revocation, and data rights
            </p>
          </div>

          {/* Profile & Email Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-primary">
              Profile Identity & Verification
            </h3>

            {profileFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-medium ${
                  profileFeedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                }`}
              >
                {profileFeedback.message}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-muted-foreground block mb-1">
                  Full Name
                </label>
                <Input
                  id="settings-profile-name"
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your Name"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground block mb-1">
                  Email Address
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="settings-profile-email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="opacity-75 cursor-not-allowed flex-1"
                  />
                  {user?.isEmailVerified ? (
                    <Badge variant="success" className="shrink-0 h-10 px-3 flex items-center gap-1 font-mono text-[11px]">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Verified
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRequestEmailVerification}
                      disabled={isRequestingEmailVerif}
                      className="shrink-0 h-10 text-xs font-mono text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      {isRequestingEmailVerif ? 'Sending...' : 'Verify Email'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" variant="primary" size="sm" disabled={isSavingProfile}>
                  {isSavingProfile ? 'Saving...' : 'Update Name'}
                </Button>
              </div>
            </form>

            {emailVerifFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-medium ${
                  emailVerifFeedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                }`}
              >
                {emailVerifFeedback.message}
              </div>
            )}
          </div>

          <div className="border-t border-border-subtle pt-4 space-y-4">
            <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-primary">
              Change Password
            </h3>

            {passwordFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-medium ${
                  passwordFeedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                }`}
              >
                {passwordFeedback.message}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-mono text-muted-foreground block mb-1">
                    Current Password
                  </label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-muted-foreground block mb-1">
                    New Password
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-muted-foreground block mb-1">
                    Confirm New Password
                  </label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-mono text-muted-foreground">
                  Updating password revokes sessions on all other devices.
                </span>
                <Button type="submit" variant="secondary" size="sm" disabled={isChangingPassword}>
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </div>

          <div className="border-t border-border-subtle pt-4 space-y-3">
            <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-primary">
              Session Management & Privacy
            </h3>

            {logoutAllFeedback && (
              <div className="p-3 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                {logoutAllFeedback.message}
              </div>
            )}
            {exportFeedback && (
              <div className="p-3 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                {exportFeedback.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-muted/50 border border-border-subtle">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Active Device Sessions
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Instantly revoke access across all browsers and active logins.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLogoutAll}
                disabled={isLoggingOutAll}
                className="shrink-0"
              >
                {isLoggingOutAll ? 'Terminating...' : 'Sign Out Everywhere'}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-muted/50 border border-border-subtle">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Account Data Portability (GDPR Export)
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Download a machine-readable JSON archive of all your companion memories, tasks, and history.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportData}
                disabled={isExportingData}
                className="shrink-0"
              >
                {isExportingData ? 'Generating...' : 'Export Data (JSON)'}
              </Button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="border-t border-rose-500/20 pt-4 space-y-3">
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-rose-500">
                    Danger Zone: Permanent Account Deletion
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Irrevocably deletes your profile, conversation history, memories, tasks, and notifications.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                  className="text-rose-500 border-rose-500/30 hover:bg-rose-500/10 shrink-0"
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md p-6 rounded-2xl border border-rose-500/40 bg-surface shadow-elevated space-y-4">
              <div className="flex items-center gap-2.5 text-rose-500">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-base font-bold">Confirm Account Deletion</h3>
              </div>

              <p className="text-xs text-muted-foreground">
                This action is <strong className="text-foreground">permanent and cannot be undone</strong>. All your conversational memories, personal life context, and active reminder jobs will be deleted immediately.
              </p>

              {deleteError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                  {deleteError}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-mono text-muted-foreground block mb-1">
                    Type <strong className="text-rose-500">DELETE</strong> to confirm
                  </label>
                  <Input
                    id="delete-confirm-text"
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-muted-foreground block mb-1">
                    Enter your account password
                  </label>
                  <Input
                    id="delete-password"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Account password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                    setDeletePassword('');
                    setDeleteError(null);
                  }}
                  disabled={isDeletingAccount}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || deleteConfirmText !== 'DELETE'}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isDeletingAccount ? 'Deleting...' : 'Permanently Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* System & Architecture Info Card */}
        <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              System Architecture
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified local foundation and services
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
              <span className="text-muted-foreground">Product</span>
              <span className="font-medium text-foreground">{APP_CONFIG.name} — {APP_CONFIG.tagline}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
              <span className="text-muted-foreground">Frontend</span>
              <span className="font-medium text-foreground">Next.js 15.1.7 (Port {APP_CONFIG.ports.web})</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
              <span className="text-muted-foreground">Backend API</span>
              <span className="font-medium text-foreground">NestJS (Port {APP_CONFIG.ports.api})</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
              <span className="text-muted-foreground">AI Service</span>
              <span className="font-medium text-foreground">FastAPI (Port {APP_CONFIG.ports.ai})</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
              <span className="text-muted-foreground">Database</span>
              <span className="font-medium text-foreground">PostgreSQL 16 + pgvector (Port {APP_CONFIG.ports.postgres})</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">Cache & Queue</span>
              <span className="font-medium text-foreground">Redis 7.2 (Port {APP_CONFIG.ports.redis})</span>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
