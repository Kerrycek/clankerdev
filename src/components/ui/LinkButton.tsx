import React from 'react';
import { Link } from 'react-router-dom';

import { clsx } from './clsx';
import { buttonClassName, type ButtonSize, type ButtonVariant } from './buttonStyles';

export function LinkButton(props: {
  to: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  title?: string;
  testId?: string;
}) {
  const cls = buttonClassName({ variant: props.variant, size: props.size, className: props.className });

  return (
    <Link
      to={props.to}
      title={props.title}
      aria-disabled={props.disabled}
      data-testid={props.testId}
      className={clsx(
        cls,
        props.disabled ? 'pointer-events-none cursor-not-allowed opacity-50' : undefined
      )}
    >
      {props.children}
    </Link>
  );
}
