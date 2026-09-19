import React from 'react';

import { Button, type ButtonSize, type ButtonVariant } from './Button';

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
  return (
    <Button
      to={props.to}
      title={props.title}
      disabled={props.disabled}
      testId={props.testId}
      variant={props.variant}
      size={props.size}
      className={props.className}
    >
      {props.children}
    </Button>
  );
}
