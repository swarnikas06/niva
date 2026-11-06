import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'bracket' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus-ring disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer tracking-tight';

    const variants = {
      primary:
        'bg-primary text-primary-foreground hover:bg-[#9ec932] shadow-subtle active:scale-[0.98] font-bold uppercase tracking-wider',
      accent:
        'bg-primary text-primary-foreground hover:bg-[#9ec932] shadow-subtle active:scale-[0.98] font-bold uppercase tracking-wider',
      bracket:
        'bg-transparent text-foreground hover:text-primary border border-transparent hover:border-primary/40 px-3 py-1 font-mono uppercase tracking-wider',
      secondary:
        'bg-surface text-foreground hover:bg-surface-hover border border-border shadow-subtle active:scale-[0.98]',
      ghost:
        'text-foreground hover:bg-surface-hover active:bg-surface-muted',
      outline:
        'border border-border bg-transparent text-foreground hover:bg-surface-hover hover:border-primary/50 active:bg-surface-muted',
      danger:
        'bg-danger text-danger-foreground hover:bg-[#d42d2d] active:scale-[0.98] font-bold',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 font-medium',
      md: 'text-sm px-4 py-2 gap-2 font-medium',
      lg: 'text-base px-6 py-2.5 gap-2.5 font-semibold',
      icon: 'p-2 w-9 h-9',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {variant === 'bracket' ? (
          <span className="bracket-tag">{children}</span>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
