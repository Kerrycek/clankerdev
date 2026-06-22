import React from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { ExportHost, ExportItem } from '../../../lib/api/exports';
import { exportDeleteConfirmText, hostDeleteConfirmText, hostLabel, sourceLabel } from './ExportModel';

export function ExportDeleteDialogs(props: {
  exportOpen: boolean;
  exportItem: ExportItem;
  exportPending: boolean;
  exportPhrase: string;
  onExportPhraseChange: (value: string) => void;
  onCancelExport: () => void;
  onConfirmExport: () => void;
  host: ExportHost | null;
  hostPending: boolean;
  hostPhrase: string;
  onHostPhraseChange: (value: string) => void;
  onCancelHost: () => void;
  onConfirmHost: () => void;
}) {
  const { t } = useI18n();

  return (
    <>
      <ConfirmDialog
        open={props.exportOpen}
        onCancel={props.onCancelExport}
        onConfirm={props.onConfirmExport}
        danger
        title={t('exports.delete.title')}
        description={t('exports.delete.body', { source: sourceLabel(props.exportItem) })}
        confirmLabel={t('common.delete')}
        confirmLoading={props.exportPending}
        confirmationText={exportDeleteConfirmText(props.exportItem)}
        confirmationValue={props.exportPhrase}
        onConfirmationValueChange={props.onExportPhraseChange}
        testId="exports.detail.delete.dialog"
      >
        <Alert title={t('exports.delete.review.title')} variant="danger">
          {t('exports.delete.review.body')}
        </Alert>
      </ConfirmDialog>

      <ConfirmDialog
        open={props.host !== null}
        onCancel={props.onCancelHost}
        onConfirm={props.onConfirmHost}
        danger
        title={t('exports.host.delete.title')}
        description={t('exports.host.delete.body', { host: props.host ? hostLabel(props.host) : '—' })}
        confirmLabel={t('common.delete')}
        confirmLoading={props.hostPending}
        confirmationText={hostDeleteConfirmText(props.host)}
        confirmationValue={props.hostPhrase}
        onConfirmationValueChange={props.onHostPhraseChange}
        testId="exports.detail.host.delete.dialog"
      >
        <Alert title={t('exports.host.delete.review.title')} variant="danger">
          {t('exports.host.delete.review.body')}
        </Alert>
      </ConfirmDialog>
    </>
  );
}
