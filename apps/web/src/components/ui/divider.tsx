import React from 'react';
import { cn } from '@/lib/utils';

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
}

export function Divider({
  className,
  orientation = 'horizontal',
  label,
  ...props
}: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn('w-[1px] h-full bg-border self-stretch', className)}
        {...props}
      />
    );
  }

  if (label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        className={cn('relative flex items-center w-full my-4', className)}
        {...props}
      >
        <div className="flex-grow border-t border-border" />
        <span className="flex-shrink mx-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">
          {label}
        </span>
        <div className="flex-grow border-t border-border" />
      </div>
    );
  }

  return (
    <hr
      className={cn('w-full border-t border-border my-4', className)}
      {...props}
    />
  );
}
