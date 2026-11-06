'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface CharacterAvatarProps {
  characterId: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showPresence?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
  '2xl': 'w-24 h-24',
};

export function CharacterAvatar({
  characterId,
  name,
  size = 'md',
  className,
  showPresence = false,
}: CharacterAvatarProps) {
  const normId = (characterId || '').toLowerCase().trim();

  // Normalize IDs to the 4 modern characters
  const isAtlas = normId === 'atlas' || normId === 'niva_strategist' || normId.includes('strategist');
  const isMira = normId === 'mira' || normId === 'niva_guide' || normId.includes('guide');
  const isNova = normId === 'nova' || normId === 'niva_catalyst' || normId.includes('catalyst');

  const getAvatarConfig = () => {
    if (isAtlas) {
      return {
        key: 'atlas',
        name: name || 'ATLAS',
        tagline: 'The Strategic Mind',
        accentColor: '#2563EB',
        bgGradient: 'from-blue-600/20 via-blue-500/10 to-indigo-900/30',
        borderColor: 'border-blue-500/40',
        ringColor: 'ring-blue-500/30',
        icon: (
          <svg className="w-full h-full p-1.5" viewBox="0 0 32 32" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Hexagonal strategic nexus & architectural compass */}
            <polygon points="16 2 28 9 28 23 16 30 4 23 4 9" stroke="#3B82F6" strokeWidth="1.75" fill="#2563EB" fillOpacity="0.12" />
            <circle cx="16" cy="16" r="4.5" fill="#2563EB" fillOpacity="0.25" stroke="#60A5FA" strokeWidth="1.5" />
            <line x1="16" y1="2" x2="16" y2="11.5" stroke="#93C5FD" strokeWidth="1.5" />
            <line x1="16" y1="20.5" x2="16" y2="30" stroke="#93C5FD" strokeWidth="1.5" />
            <line x1="4" y1="16" x2="11.5" y2="16" stroke="#93C5FD" strokeWidth="1.5" />
            <line x1="20.5" y1="16" x2="28" y2="16" stroke="#93C5FD" strokeWidth="1.5" />
          </svg>
        ),
      };
    }

    if (isMira) {
      return {
        key: 'mira',
        name: name || 'MIRA',
        tagline: 'The Thoughtful Companion',
        accentColor: '#059669',
        bgGradient: 'from-emerald-600/20 via-teal-500/10 to-emerald-950/30',
        borderColor: 'border-emerald-500/40',
        ringColor: 'ring-emerald-500/30',
        icon: (
          <svg className="w-full h-full p-1.5" viewBox="0 0 32 32" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Organic harmonious ripple & serene petal */}
            <circle cx="16" cy="16" r="13" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
            <path d="M16 4C16 4 25 10 25 19C25 24 21 28 16 28C11 28 7 24 7 19C7 10 16 4 16 4Z" fill="#059669" fillOpacity="0.15" stroke="#10B981" strokeWidth="1.75" />
            <circle cx="16" cy="19" r="3.5" fill="#34D399" fillOpacity="0.3" stroke="#6EE7B7" strokeWidth="1.5" />
            <path d="M16 11V15.5" stroke="#A7F3D0" strokeWidth="1.5" />
          </svg>
        ),
      };
    }

    if (isNova) {
      return {
        key: 'nova',
        name: name || 'NOVA',
        tagline: 'The Momentum Builder',
        accentColor: '#D97706',
        bgGradient: 'from-amber-600/20 via-orange-500/10 to-amber-950/30',
        borderColor: 'border-amber-500/40',
        ringColor: 'ring-amber-500/30',
        icon: (
          <svg className="w-full h-full p-1.5" viewBox="0 0 32 32" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Dynamic kinetic starburst & momentum chevron */}
            <path d="M16 2L19.5 12.5L30 16L19.5 19.5L16 30L12.5 19.5L2 16L12.5 12.5L16 2Z" fill="#D97706" fillOpacity="0.18" stroke="#F59E0B" strokeWidth="1.75" />
            <polygon points="16 8 20 16 16 24 12 16" fill="#FBBF24" fillOpacity="0.35" stroke="#FDE68A" strokeWidth="1.25" />
            <circle cx="16" cy="16" r="2" fill="#FFFFFF" />
          </svg>
        ),
      };
    }

    // Default: ARIA
    return {
      key: 'aria',
      name: name || 'ARIA',
      tagline: 'The Balanced Intelligence',
      accentColor: '#7C3AED',
      bgGradient: 'from-purple-600/20 via-violet-500/10 to-indigo-950/30',
      borderColor: 'border-purple-500/40',
      ringColor: 'ring-purple-500/30',
      icon: (
        <svg className="w-full h-full p-1.5" viewBox="0 0 32 32" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {/* Interlocking orbital rings & harmonic balance anchor */}
          <circle cx="16" cy="16" r="12" stroke="#8B5CF6" strokeWidth="1.5" fill="#7C3AED" fillOpacity="0.12" />
          <ellipse cx="16" cy="16" rx="12" ry="5.5" stroke="#A78BFA" strokeWidth="1.5" transform="rotate(-30 16 16)" />
          <ellipse cx="16" cy="16" rx="12" ry="5.5" stroke="#C4B5FD" strokeWidth="1.5" transform="rotate(30 16 16)" />
          <circle cx="16" cy="16" r="3.5" fill="#8B5CF6" fillOpacity="0.4" stroke="#DDD6FE" strokeWidth="1.5" />
        </svg>
      ),
    };
  };

  const config = getAvatarConfig();

  return (
    <div className={cn('relative inline-flex items-center justify-center shrink-0', className)}>
      <div
        className={cn(
          'rounded-2xl border flex items-center justify-center transition-all bg-gradient-to-br shadow-sm',
          sizeClasses[size],
          config.bgGradient,
          config.borderColor,
        )}
        style={{ borderColor: `${config.accentColor}44` }}
        title={`${config.name} — ${config.tagline}`}
      >
        {config.icon}
      </div>

      {showPresence && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background bg-emerald-500"
          title="Companion Online & Active"
        />
      )}
    </div>
  );
}
