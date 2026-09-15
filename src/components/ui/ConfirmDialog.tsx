import React, { useEffect, useRef } from 'react';

import { useI18n } from '../../app/i18n';

import { Button, type ButtonVariant } from './Button';
import { Modal } from './Modal';

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  description?: string;
  /** Backward-compatible alias. */
  message?: string;
  danger?: boolean;
  /** Backward-compatible explicit confirm button variant. */
  confirmVariant?: ButtonVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmLoading?: boolean;
  /** Backward-compatible alias. */
  loading?: boolean;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  /** Backward-compatible alias. */
  onClose?: () => void;
  children?: React.ReactNode;

  /** Optional test id for E2E / integration tests */
  testId?: string;
}) {
  const { t } = useI18n();
  const onCancel = props.onCancel ?? props.onClose ?? (() => {});
  const description = props.description ?? props.message;
  const confirmLoading = props.confirmLoading ?? props.loading;
  const confirmVariant = props.confirmVariant ?? (props.danger ? 'danger' : 'primary');
  const confirmDisabled = props.confirmDisabled;
  const cancelBlocked = Boolean(props.cancelDisabled || confirmLoading);
  const contentRef = useRef<HTMLDivElement>(null);
  const requestCancel = () => {
    if (cancelBlocked) return;
    onCancel();
  };

  useEffect(() => {
    if (!props.open || !cancelBlocked) return;

    const ownDialog = contentRef.current?.closest<HTMLElement>('[data-overlay="modal"]');
    if (!ownDialog) return;

    function blockPendingEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;

      const target = event.target instanceof Element ? event.target : null;
      const targetDialog = target?.closest('[data-overlay="modal"]');
      const openDialogs = document.querySelectorAll('[data-overlay="modal"]');
      const topmostDialog = openDialogs.item(openDialogs.length - 1);
      const targetsOwnDialog = targetDialog === ownDialog;
      const targetsPageBehindTopmostDialog = !targetDialog && topmostDialog === ownDialog;
      if (!targetsOwnDialog && !targetsPageBehindTopmostDialog) return;

      event.preventDefault();
      event.stopPropagation();
    }

    // Modal and Drawer own independent window listeners. Capture Escape at the
    // document when this pending confirmation owns the event (or is topmost
    // after a disabled button loses focus) so an underlying overlay cannot
    // close and unmount it. Newer overlays remain dismissible.
    document.addEventListener('keydown', blockPendingEscape, true);
    return () => document.removeEventListener('keydown', blockPendingEscape, true);
  }, [cancelBlocked, props.open]);

  return (
    <Modal
      open={props.open}
      testId={props.testId}
      title={props.title}
      onClose={requestCancel}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            testId={props.testId ? `${props.testId}.cancel` : undefined}
            variant="secondary"
            onClick={requestCancel}
            disabled={cancelBlocked}
          >
            {props.cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            testId={props.testId ? `${props.testId}.confirm` : undefined}
            variant={confirmVariant}
            onClick={props.onConfirm}
            loading={confirmLoading}
            disabled={confirmDisabled}
          >
            {props.confirmLabel ?? t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div ref={contentRef}>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
        {props.children ? <div className={description ? 'mt-3' : ''}>{props.children}</div> : null}
      </div>
    </Modal>
  );
}
