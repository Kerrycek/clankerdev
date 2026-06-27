import React from 'react';
import { Link } from 'react-router-dom';

import { clsx } from './clsx';
import { buttonClassName, type ButtonSize, type ButtonVariant } from './buttonStyles';

export type { ButtonSize, ButtonVariant } from './buttonStyles';

type BaseProps = {
  testId?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  title?: string;
  /** Backward-compatible alias surfaced via title for disabled buttons. */
  disabledReason?: string;
  id?: string;
  ariaLabel?: string;
  'aria-label'?: string;
  'aria-controls'?: string;
  'aria-current'?: React.AriaAttributes['aria-current'];
  'aria-expanded'?: boolean;
  'aria-haspopup'?: React.AriaAttributes['aria-haspopup'];
  'aria-pressed'?: boolean;
  role?: React.AriaRole;
  children: React.ReactNode;
};

type ButtonProps = BaseProps & {
  as?: 'button';
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  href?: never;
  to?: never;
  target?: never;
  rel?: never;
};

type AnchorProps = BaseProps & {
  as?: 'a';
  href: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  type?: never;
  to?: never;
};

type RouterLinkProps = BaseProps & {
  /** Backward-compatible router-link usage used by older pages. */
  to: string;
  onClick?: () => void;
  type?: never;
  as?: never;
  href?: never;
  target?: never;
  rel?: never;
};

function ariaProps(props: BaseProps) {
  return {
    'aria-label': props.ariaLabel ?? props['aria-label'],
    'aria-controls': props['aria-controls'],
    'aria-current': props['aria-current'],
    'aria-expanded': props['aria-expanded'],
    'aria-haspopup': props['aria-haspopup'],
    'aria-pressed': props['aria-pressed'],
    role: props.role,
  };
}

export function Button(props: ButtonProps | AnchorProps | RouterLinkProps) {
  const cls = buttonClassName({ variant: props.variant, size: props.size, className: props.className });

  const title = props.title ?? props.disabledReason;
  const disabled = Boolean(props.disabled || props.loading);

  const content = (
    <>
      {props.loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : null}
      {props.children}
    </>
  );

  const sharedAriaProps = ariaProps(props);

  const to = 'to' in props ? props.to : undefined;
  if (to) {
    return (
      <Link
        id={props.id}
        data-testid={props.testId}
        to={to}
        onClick={props.onClick}
        title={title}
        aria-disabled={disabled}
        className={clsx(cls, disabled ? 'pointer-events-none cursor-not-allowed opacity-50' : undefined)}
        {...sharedAriaProps}
      >
        {content}
      </Link>
    );
  }

  if ('href' in props) {
    return (
      <a
        id={props.id}
        data-testid={props.testId}
        href={props.href}
        target={props.target}
        rel={props.rel}
        onClick={props.onClick}
        title={title}
        aria-disabled={disabled}
        className={clsx(cls, disabled ? 'pointer-events-none cursor-not-allowed opacity-50' : undefined)}
        {...sharedAriaProps}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      id={props.id}
      data-testid={props.testId}
      type={props.type ?? 'button'}
      className={cls}
      disabled={disabled}
      onClick={props.onClick}
      title={title}
      {...sharedAriaProps}
    >
      {content}
    </button>
  );
}
