import React, { useEffect, useState } from 'react';

import { useI18n } from '../../app/i18n';

import { copyTextToClipboard } from '../../lib/clipboard';
import { Button } from './Button';

export function CopyButton(props: {
  text: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
  /** Optional test id for E2E / integration tests */
  testId?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const { t } = useI18n();

  useEffect(() => {
    if (status === 'idle') return;
    const t = window.setTimeout(() => setStatus('idle'), 1200);
    return () => window.clearTimeout(t);
  }, [status]);

  const idleLabel = props.label ?? t('common.copy');

  const label =
    status === 'copied' ? t('common.copied') : status === 'failed' ? t('common.copy_failed') : idleLabel;

  return (
    <Button
      testId={props.testId}
      variant={props.variant ?? 'secondary'}
      size={props.size ?? 'sm'}
      className={props.className}
      onClick={async () => {
        const ok = await copyTextToClipboard(props.text);
        setStatus(ok ? 'copied' : 'failed');
      }}
    >
      {label}
    </Button>
  );
}
