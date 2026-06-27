import React, { useEffect, useId, useState } from 'react';

import { useI18n } from '../../app/i18n';
import { useFocusTrap } from '../../lib/hooks/useFocusTrap';
import { createPortal } from 'react-dom';
import { clsx } from './clsx';

export function Drawer(props: {
  open: boolean;
  title?: string;
  side?: 'left' | 'right';
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';

  /** Optional test ids for E2E / integration testing */
  id?: string;
  testId?: string;
  closeTestId?: string;

  /** Use false for docked panels that should not dim or block the page. */
  modal?: boolean;
}) {
  const side = props.side ?? 'left';
  const modal = props.modal ?? true;
  const { t } = useI18n();

  const titleId = useId();
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  useFocusTrap(props.open && modal, containerEl);

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

  const widthClass =
    props.width === 'sm'
      ? 'w-full md:w-drawer-sm'
      : props.width === 'lg'
        ? 'w-full md:w-drawer-lg'
        : 'w-full md:w-drawer-md';

  const closeTestId = props.closeTestId ?? 'drawer.close';

  return createPortal(
    <div className={clsx('fixed inset-0 z-50', modal ? undefined : 'pointer-events-none')}>
      {modal ? (
        <div
          className="absolute inset-0 bg-backdrop"
          data-overlay-backdrop="true"
          onClick={props.onClose}
          aria-hidden="true"
        />
      ) : null}

      <div
        id={props.id}
        role="dialog"
        aria-modal={modal ? 'true' : 'false'}
        aria-labelledby={props.title ? titleId : undefined}
        data-testid={props.testId}
        data-overlay="drawer"
        data-overlay-surface="overlay"
        tabIndex={-1}
        ref={setContainerEl}
        className={clsx(
          'absolute top-0 h-full bg-overlay-surface shadow-panel ring-1 ring-border flex flex-col pointer-events-auto',
          widthClass,
          side === 'left' ? 'left-0' : 'right-0'
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1 text-base font-semibold">
            <span className="block truncate" id={titleId}>
              {props.title ?? ''}
            </span>
          </div>

          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-2"
            aria-label={t('common.close')}
            data-testid={closeTestId}
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">{props.children}</div>

        {props.footer ? (
          <div className="border-t border-border px-4 py-3">{props.footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
