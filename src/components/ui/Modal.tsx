import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from './clsx';

import { useFocusTrap } from '../../lib/hooks/useFocusTrap';

function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

export function Modal(props: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';

  /**
   * When enabled, the modal becomes full-screen on small viewports.
   * This is used by mobile-first surfaces like the command palette.
   */
  mobileFullScreen?: boolean;

  /** Optional test id for E2E / integration tests */
  testId?: string;
}) {
  useLockBodyScroll(props.open);

  const titleId = useId();
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  useFocusTrap(props.open, containerEl);

  useEffect(() => {
    if (!props.open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        props.onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  const mobileFullScreen = Boolean(props.mobileFullScreen);

  const sizeClass =
    props.size === 'sm'
      ? mobileFullScreen
        ? 'max-w-none sm:max-w-sm'
        : 'max-w-sm'
      : props.size === 'lg'
        ? mobileFullScreen
          ? 'max-w-none sm:max-w-3xl'
          : 'max-w-3xl'
        : mobileFullScreen
          ? 'max-w-none sm:max-w-xl'
          : 'max-w-xl';

  return createPortal(
    <div className={clsx('fixed inset-0 z-50 flex items-center justify-center', mobileFullScreen ? 'p-0 sm:p-4' : 'p-4')}>
      <div
        className="absolute inset-0 bg-backdrop"
        data-overlay-backdrop="true"
        onClick={props.onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={props.title ? titleId : undefined}
        data-testid={props.testId}
        data-overlay="modal"
        data-overlay-surface="overlay"
        tabIndex={-1}
        ref={setContainerEl}
        className={clsx(
          'relative w-full bg-overlay-surface shadow-panel ring-1 ring-border',
          mobileFullScreen ? 'h-full rounded-none sm:h-auto sm:rounded-lg' : 'rounded-lg',
          sizeClass
        )}
      >
        {props.title ? (
          <div className="border-b border-border px-4 py-3">
            <div className="text-base font-semibold" id={titleId}>
              {props.title}
            </div>
          </div>
        ) : null}

        <div className="px-4 py-4">{props.children}</div>

        {props.footer ? (
          <div className="border-t border-border px-4 py-3">{props.footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
