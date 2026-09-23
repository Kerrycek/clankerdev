import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useI18n, type TranslationKey } from '../../../app/i18n';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { ButtonVariant } from '../../../components/ui/buttonStyles';
import type { GateDecision } from '../../../lib/gates/types';
import { VpsConfirmTarget } from './VpsPowerConfirmation';

export type ActionChecklistItem = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  testId?: string;
  disabled?: boolean;
};

export function Field(props: { label: ReactNode; help?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted">{props.label}</div>
      <div className="mt-1">{props.children}</div>
      {props.help ? <div className="mt-1 text-xs text-faint">{props.help}</div> : null}
    </label>
  );
}

export function ImpactItem(props: { label: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3" data-testid={props.testId}>
      <div className="text-xs font-medium text-muted">{props.label}</div>
      <div className="mt-1 text-sm">{props.children}</div>
    </div>
  );
}

export function ActionImpactSummary(props: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <div className={props.className ?? 'grid gap-3 md:grid-cols-3'} data-testid={props.testId}>
      {props.children}
    </div>
  );
}

export function ActionGateAlert(props: { gate: GateDecision; onOpenTasks?: () => void; testId?: string }) {
  const { t } = useI18n();
  if (props.gate.allowed) return null;

  return (
    <Alert variant="warn" title={t(props.gate.reason.titleKey)} testId={props.testId}>
      {props.gate.reason.descriptionKey ? <p>{t(props.gate.reason.descriptionKey)}</p> : null}
      {props.onOpenTasks ? (
        <Button variant="secondary" onClick={props.onOpenTasks}>
          {t('common.open_tasks')}
        </Button>
      ) : null}
    </Alert>
  );
}

export function ActionConfirmChecklist(props: { items: ActionChecklistItem[]; className?: string; testId?: string }) {
  if (props.items.length === 0) return null;

  return (
    <div className={props.className ?? 'space-y-2'} data-testid={props.testId}>
      {props.items.map((item) => (
        <Checkbox
          key={item.testId ?? String(item.label)}
          checked={item.checked}
          onChange={item.onChange}
          label={item.label}
          description={item.description}
          testId={item.testId}
          disabled={item.disabled}
        />
      ))}
    </div>
  );
}

export function DangerConfirmationNotice(props: {
  label: ReactNode;
  help: ReactNode;
  testId?: string;
}) {
  return (
    <Alert variant="warn" title={props.label} testId={props.testId}>
      {props.help}
    </Alert>
  );
}

export function AsyncActionResult(props: {
  succeeded?: boolean;
  successTitle?: ReactNode;
  successBody?: ReactNode;
  errorMessage?: ReactNode;
  errorTitle?: ReactNode;
}) {
  return (
    <>
      {props.succeeded && props.successTitle ? (
        <Alert variant="ok" title={props.successTitle}>
          {props.successBody}
        </Alert>
      ) : null}

      {props.errorMessage ? (
        <Alert title={props.errorTitle} variant="danger">
          {props.errorMessage}
        </Alert>
      ) : null}
    </>
  );
}

export function LifecycleActionShell(props: {
  testId: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card testId={props.testId}>
      {props.title || props.subtitle ? <CardHeader title={props.title} subtitle={props.subtitle} /> : null}
      <CardBody className="space-y-4">
        {props.children}
        {props.footer ? <div className="flex justify-end">{props.footer}</div> : null}
      </CardBody>
    </Card>
  );
}

export function LifecycleSubmitButton(props: {
  variant: ButtonVariant;
  testId: string;
  disabled: boolean;
  gate: GateDecision;
  loading: boolean;
  errorMessage?: string;
  onClick: () => void;
  children: ReactNode;
  confirmation?: {
    title: string;
    description: string;
    target?: {
      vpsId: number;
      objectLabel: string;
    };
  };
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const sawPendingRef = useRef(false);
  const disabled = props.disabled || !props.gate.allowed;

  useEffect(() => {
    if (!confirmOpen) {
      sawPendingRef.current = false;
      return;
    }
    if (props.loading) {
      sawPendingRef.current = true;
      return;
    }
    if (!sawPendingRef.current) return;

    sawPendingRef.current = false;
    if (!props.errorMessage) {
      setConfirmOpen(false);
      setAttempted(false);
    }
  }, [confirmOpen, props.errorMessage, props.loading]);

  const closeConfirmation = () => {
    sawPendingRef.current = false;
    setAttempted(false);
    setConfirmOpen(false);
  };

  return (
    <>
      <ActionButton
        variant={props.variant}
        testId={props.testId}
        disabled={disabled}
        disabledReason={!props.gate.allowed ? props.gate.reason : undefined}
        loading={props.loading}
        onClick={() => {
          if (props.confirmation) {
            sawPendingRef.current = false;
            setAttempted(false);
            setConfirmOpen(true);
          }
          else props.onClick();
        }}
      >
        {props.children}
      </ActionButton>
      {props.confirmation ? (
        <ConfirmDialog
          open={confirmOpen}
          title={props.confirmation.title}
          description={props.confirmation.description}
          confirmLabel={props.children as string}
          danger={props.variant === 'danger'}
          confirmLoading={props.loading}
          confirmDisabled={disabled || props.loading}
          onCancel={closeConfirmation}
          onConfirm={() => {
            setAttempted(true);
            props.onClick();
          }}
          testId={`${props.testId}.confirm_dialog`}
        >
          {props.confirmation.target ? (
            <VpsConfirmTarget
              vpsId={props.confirmation.target.vpsId}
              objectLabel={props.confirmation.target.objectLabel}
              testId={`${props.testId}.confirm_dialog.target`}
            />
          ) : null}
          {attempted && props.errorMessage ? (
            <Alert variant="danger" testId={`${props.testId}.confirm_dialog.error`}>
              {props.errorMessage}
            </Alert>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </>
  );
}

export type LifecycleActionTrackOptions = {
  blockUi?: boolean;
  progressTitleKey?: TranslationKey;
};
