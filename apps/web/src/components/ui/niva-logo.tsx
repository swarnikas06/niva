import React from 'react';

export interface NivaLogoProps extends React.SVGProps<SVGSVGElement> {
  variant?: 'symbol' | 'icon' | 'horizontal';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'dark' | 'light' | 'auto';
  className?: string;
  showTagline?: boolean;
}

const sizeMap = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
};

/**
 * Standalone Neural N Symbol (Flowing Geometric Ribbon)
 */
export function NivaSymbol({
  className = '',
  size = 'md',
  width,
  height,
  theme = 'auto',
  ...props
}: Omit<NivaLogoProps, 'variant'>) {
  const pixelSize = typeof size === 'string' ? sizeMap[size] || 32 : size;
  const w = width ?? pixelSize;
  const h = height ?? pixelSize;

  const idSuffix = React.useId().replace(/:/g, '');
  const leftId = `nivaSymbolLeft_${idSuffix}`;
  const diagId = `nivaSymbolDiag_${idSuffix}`;
  const rightId = `nivaSymbolRight_${idSuffix}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={w}
      height={h}
      className={`shrink-0 ${className}`}
      aria-label="NIVA Symbol"
      {...props}
    >
      <defs>
        <linearGradient id={leftId} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#047857" />
          <stop offset="60%" stopColor="#059669" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        <linearGradient id={diagId} x1="10%" y1="10%" x2="90%" y2="90%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="42%" stopColor="#06B6D4" />
          <stop offset="82%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        <linearGradient id={rightId} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#0D9488" />
          <stop offset="45%" stopColor="#10B981" />
          <stop offset="85%" stopColor="#84CC16" />
          <stop offset="100%" stopColor="#A3E635" />
        </linearGradient>
      </defs>

      {/* Left Pillar */}
      <path
        d="M 96 400 C 96 411, 105 420, 116 420 L 148 420 C 159 420, 168 411, 168 400 L 168 184 L 96 112 Z"
        fill={`url(#${leftId})`}
      />

      {/* Central Diagonal Traverse */}
      <path
        d="M 96 112 C 96 100, 106 92, 118 92 L 148 92 C 160 92, 172 98, 180 108 L 396 364 C 406 376, 416 388, 416 400 C 416 412, 406 420, 394 420 L 364 420 C 352 420, 340 414, 332 404 L 116 148 C 106 136, 96 124, 96 112 Z"
        fill={`url(#${diagId})`}
      />

      {/* Right Pillar */}
      <path
        d="M 344 328 L 416 400 L 416 112 C 416 101, 407 92, 396 92 L 364 92 C 353 92, 344 101, 344 112 Z"
        fill={`url(#${rightId})`}
      />
    </svg>
  );
}

/**
 * Application Icon with Rounded Container
 */
export function NivaIcon({
  className = '',
  size = 'md',
  width,
  height,
  ...props
}: Omit<NivaLogoProps, 'variant'>) {
  const pixelSize = typeof size === 'string' ? sizeMap[size] || 32 : size;
  const w = width ?? pixelSize;
  const h = height ?? pixelSize;

  const idSuffix = React.useId().replace(/:/g, '');
  const bgId = `nivaIconBg_${idSuffix}`;
  const borderId = `nivaIconBorder_${idSuffix}`;
  const leftId = `nivaIconLeft_${idSuffix}`;
  const diagId = `nivaIconDiag_${idSuffix}`;
  const rightId = `nivaIconRight_${idSuffix}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={w}
      height={h}
      className={`shrink-0 ${className}`}
      aria-label="NIVA Application Icon"
      {...props}
    >
      <defs>
        <linearGradient id={bgId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0D131F" />
          <stop offset="50%" stopColor="#070A10" />
          <stop offset="100%" stopColor="#04060A" />
        </linearGradient>

        <linearGradient id={borderId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#84CC16" stopOpacity="0.3" />
        </linearGradient>

        <linearGradient id={leftId} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#047857" />
          <stop offset="60%" stopColor="#059669" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        <linearGradient id={diagId} x1="10%" y1="10%" x2="90%" y2="90%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="42%" stopColor="#06B6D4" />
          <stop offset="82%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        <linearGradient id={rightId} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#0D9488" />
          <stop offset="45%" stopColor="#10B981" />
          <stop offset="85%" stopColor="#84CC16" />
          <stop offset="100%" stopColor="#A3E635" />
        </linearGradient>
      </defs>

      <rect
        x="8"
        y="8"
        width="496"
        height="496"
        rx="112"
        fill={`url(#${bgId})`}
        stroke={`url(#${borderId})`}
        strokeWidth="4"
      />

      <g transform="translate(32, 32) scale(0.875)">
        <path
          d="M 96 400 C 96 411, 105 420, 116 420 L 148 420 C 159 420, 168 411, 168 400 L 168 184 L 96 112 Z"
          fill={`url(#${leftId})`}
        />
        <path
          d="M 96 112 C 96 100, 106 92, 118 92 L 148 92 C 160 92, 172 98, 180 108 L 396 364 C 406 376, 416 388, 416 400 C 416 412, 406 420, 394 420 L 364 420 C 352 420, 340 414, 332 404 L 116 148 C 106 136, 96 124, 96 112 Z"
          fill={`url(#${diagId})`}
        />
        <path
          d="M 344 328 L 416 400 L 416 112 C 416 101, 407 92, 396 92 L 364 92 C 353 92, 344 101, 344 112 Z"
          fill={`url(#${rightId})`}
        />
      </g>
    </svg>
  );
}

/**
 * Full Horizontal Logo (Neural N Symbol + NIVA Wordmark + Optional Tagline)
 */
export function NivaLogo({
  variant = 'horizontal',
  size = 'md',
  theme = 'auto',
  className = '',
  showTagline = true,
  ...props
}: NivaLogoProps) {
  if (variant === 'symbol') {
    return <NivaSymbol size={size} theme={theme} className={className} {...props} />;
  }
  if (variant === 'icon') {
    return <NivaIcon size={size} className={className} {...props} />;
  }

  const idSuffix = React.useId().replace(/:/g, '');
  const leftId = `nivaHLeft_${idSuffix}`;
  const diagId = `nivaHDiag_${idSuffix}`;
  const rightId = `nivaHRight_${idSuffix}`;
  const accentAId = `nivaHAccentA_${idSuffix}`;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Symbol */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        className="w-8 h-8 shrink-0"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={leftId} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="60%" stopColor="#059669" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>

          <linearGradient id={diagId} x1="10%" y1="10%" x2="90%" y2="90%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="42%" stopColor="#06B6D4" />
            <stop offset="82%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>

          <linearGradient id={rightId} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#0D9488" />
            <stop offset="45%" stopColor="#10B981" />
            <stop offset="85%" stopColor="#84CC16" />
            <stop offset="100%" stopColor="#A3E635" />
          </linearGradient>

          <linearGradient id={accentAId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#A3E635" />
          </linearGradient>
        </defs>

        <path
          d="M 96 400 C 96 411, 105 420, 116 420 L 148 420 C 159 420, 168 411, 168 400 L 168 184 L 96 112 Z"
          fill={`url(#${leftId})`}
        />
        <path
          d="M 96 112 C 96 100, 106 92, 118 92 L 148 92 C 160 92, 172 98, 180 108 L 396 364 C 406 376, 416 388, 416 400 C 416 412, 406 420, 394 420 L 364 420 C 352 420, 340 414, 332 404 L 116 148 C 106 136, 96 124, 96 112 Z"
          fill={`url(#${diagId})`}
        />
        <path
          d="M 344 328 L 416 400 L 416 112 C 416 101, 407 92, 396 92 L 364 92 C 353 92, 344 101, 344 112 Z"
          fill={`url(#${rightId})`}
        />
      </svg>

      {/* Typography */}
      <div className="flex flex-col justify-center leading-none">
        <span className="font-extrabold text-lg tracking-[0.2em] text-foreground flex items-center">
          NIV
          <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-lime-400 bg-clip-text text-transparent">
            A
          </span>
        </span>
        {showTagline && (
          <span className="text-[9px] font-mono font-medium tracking-[0.22em] text-muted-foreground uppercase mt-0.5">
            AI Companion
          </span>
        )}
      </div>
    </div>
  );
}

export default NivaLogo;
