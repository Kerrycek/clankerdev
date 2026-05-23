import { clsx } from './clsx';

export const buttonVariants = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'bg-surface text-fg border border-border hover:bg-surface-2',
  ok: 'bg-ok text-bg hover:bg-ok/90',
  warn: 'bg-warn text-accent-fg hover:bg-warn/90',
  danger: 'bg-danger text-bg hover:bg-danger/90',
  ghost: 'bg-transparent text-fg hover:bg-surface-2',
} as const;

export const buttonSizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export function buttonClassName(opts: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}): string {
  const v = opts.variant ?? 'primary';
  const s = opts.size ?? 'md';

  return clsx(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg',
    // Note: `disabled:` only applies when we use the actual `disabled` attribute.
    'disabled:cursor-not-allowed disabled:opacity-50',
    buttonVariants[v],
    buttonSizes[s],
    opts.className
  );
}
