import React from 'react';

import { useI18n } from '../../app/i18n';

import { Button, type ButtonVariant } from './Button';
import { Input } from './Input';
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
  confirmationText?: string;
  confirmationValue?: string;
  confirmationLabel?: string;
  confirmationPlaceholder?: string;
  onConfirmationValueChange?: (value: string) => void;

  /** Optional test id for E2E / integration tests */
  testId?: string;
}) {
  const { t } = useI18n();
  const onCancel = props.onCancel ?? props.onClose ?? (() => {});
  const description = props.description ?? props.message;
  const confirmLoading = props.confirmLoading ?? props.loading;
  const confirmVariant = props.confirmVariant ?? (props.danger ? 'danger' : 'primary');
  const needsTypedConfirmation = typeof props.confirmationText === 'string' && props.confirmationText.length > 0;
  const typedConfirmationMatches = !needsTypedConfirmation || props.confirmationValue === props.confirmationText;
  const confirmDisabled = props.confirmDisabled || !typedConfirmationMatches;

  return (
    <Modal
      open={props.open}
      testId={props.testId}
      title={props.title}
      onClose={onCancel}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            testId={props.testId ? `${props.testId}.cancel` : undefined}
            variant="secondary"
            onClick={onCancel}
            disabled={props.cancelDisabled || confirmLoading}
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
      {description ? <p className="text-sm text-muted">{description}</p> : null}
      {needsTypedConfirmation ? (
        <label className={description ? 'mt-3 block' : 'block'}>
          <div className="text-xs font-medium text-muted">
            {props.confirmationLabel ?? t('confirm.type_to_confirm', { value: props.confirmationText })}
          </div>
          <Input
            value={props.confirmationValue ?? ''}
            onChange={(e) => props.onConfirmationValueChange?.(e.target.value)}
            placeholder={props.confirmationPlaceholder ?? props.confirmationText}
            autoComplete="off"
            testId={props.testId ? `${props.testId}.input` : undefined}
          />
        </label>
      ) : null}
      {props.children ? <div className={description || needsTypedConfirmation ? 'mt-3' : ''}>{props.children}</div> : null}
    </Modal>
  );
}
