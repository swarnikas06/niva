import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'presence'
    | 'lime'
    | 'neutral'
    | 'success'
    | 'warning'
    | 'danger'
    | 'outline'
    | 'bracket';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    'inline-flex items-center font-mono font-medium rounded select-none uppercase tracking-wider';

  const variants = {
    default:
      'bg-primary/15 text-primary border border-primary/30',
    presence:
      'bg-primary/15 text-primary border border-primary/40 shadow-subtle',
    lime:
      'bg-[#B1DD40]/15 text-[#B1DD40] dark:text-[#B1DD40] border border-[#B1DD40]/30',
    neutral:
      'bg-surface-muted text-muted-foreground border border-border',
    success:
      'bg-primary/15 text-primary border border-primary/30',
    warning:
      'bg-warning/15 text-warning border border-warning/30',
    danger:
      'bg-danger/15 text-danger border border-danger/30',
    outline:
      'bg-transparent text-foreground border border-border',
    bracket:
      'bg-transparent text-primary font-mono lowercase tracking-normal border-0 p-0',
  };

  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-[11px] px-2 py-0.5 gap-1.5',
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {variant === 'bracket' ? (
        <span className="bracket-tag">{children}</span>
      ) : (
        children
      )}
    </span>
  );
}
