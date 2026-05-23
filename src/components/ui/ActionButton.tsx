import React, { useMemo, useState } from 'react';

import { useI18n, type TranslationKey } from '../../app/i18n';
import { Button } from './Button';
import { Modal } from './Modal';
import { buttonClassName, type ButtonSize, type ButtonVariant } from './buttonStyles';
import { clsx } from './clsx';

export type DisabledReason = {
  titleKey: TranslationKey | string;
  descriptionKey?: TranslationKey | string;
};

export function ActionButton(props: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  testId?: string;
  disabled?: boolean;
  loading?: boolean;
  disabledReason?: DisabledReason;
  className?: string;
  title?: string;
  ariaLabel?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [reasonOpen, setReasonOpen] = useState(false);

  const reasonModalTestId = props.testId ? `${props.testId}.reason` : undefined;
  const reasonCloseTestId = props.testId ? `${props.testId}.reason.close` : undefined;

  const reason = useMemo(() => {
    if (!props.disabledReason) return null;
    const title = t(props.disabledReason.titleKey);
    const description = props.disabledReason.descriptionKey ? t(props.disabledReason.descriptionKey) : undefined;
    return { title, description };
  }, [props.disabledReason, t]);

  const ariaDisabled = Boolean(props.disabled || props.loading);
  const nativeDisabled = Boolean(props.loading) || (Boolean(props.disabled) && !props.disabledReason);

  const cls = clsx(
    buttonClassName({ variant: props.variant, size: props.size, className: props.className }),
    ariaDisabled && !nativeDisabled ? 'cursor-not-allowed opacity-50' : undefined
  );

  const content = (
    <>
      {props.loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : null}
      {props.children}
    </>
  );

  const title = props.title ?? (ariaDisabled && reason ? reason.title : undefined);

  return (
    <>
      <button
        data-testid={props.testId}
        type={props.type ?? 'button'}
        className={cls}
        disabled={nativeDisabled}
        aria-disabled={ariaDisabled}
        onClick={() => {
          if (nativeDisabled) return;
          if (ariaDisabled) {
            if (reason) setReasonOpen(true);
            return;
          }
          props.onClick?.();
        }}
        title={title}
        aria-label={props.ariaLabel}
      >
        {content}
      </button>

      {reason ? (
        <Modal
          open={reasonOpen}
          onClose={() => setReasonOpen(false)}
          title={reason.title}
          size="sm"
          testId={reasonModalTestId}
          footer={
            <div className="flex items-center justify-end">
              <Button variant="secondary" onClick={() => setReasonOpen(false)} testId={reasonCloseTestId}>
                {t('common.close')}
              </Button>
            </div>
          }
        >
          {reason.description ? <p className="text-sm text-muted">{reason.description}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}
