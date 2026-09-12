import React from 'react';

import { useI18n } from '../../../app/i18n';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import type { Node } from '../../../lib/api/nodes';

export function RequestApproveOptions(props: {
  createVps: boolean;
  activate: boolean;
  node: string;
  nodes: readonly Node[];
  nodesLoading: boolean;
  nodesError: boolean;
  onCreateVpsChange: (value: boolean) => void;
  onActivateChange: (value: boolean) => void;
  onNodeChange: (value: string) => void;
  onRetryNodes: () => void;
  testIdPrefix: string;
}) {
  const { t } = useI18n();

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
      <div className="text-sm font-medium">{t('requests.resolve.approve.options')}</div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            className="h-5 w-5"
            type="checkbox"
            checked={props.createVps}
            onChange={(event) => props.onCreateVpsChange(event.target.checked)}
            data-testid={`${props.testIdPrefix}.create_vps`}
          />
          {t('requests.resolve.approve.create_vps')}
        </label>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            className="h-5 w-5"
            type="checkbox"
            checked={props.activate}
            onChange={(event) => props.onActivateChange(event.target.checked)}
            data-testid={`${props.testIdPrefix}.activate`}
          />
          {t('requests.resolve.approve.activate')}
        </label>

        {props.createVps ? (
          <div className="md:col-span-2" data-testid={`${props.testIdPrefix}.node_field`}>
            <Select
              value={props.node}
              onChange={(event) => props.onNodeChange(event.target.value)}
              disabled={props.nodesLoading || props.nodesError}
              label={t('requests.resolve.approve.node')}
              testId={`${props.testIdPrefix}.node`}
            >
              <option value="">{t('requests.resolve.approve.node_auto')}</option>
              {props.nodes.map((node) => (
                <option key={node.id} value={String(node.id)}>
                  #{node.id} {node.domain_name ?? node.name ?? ''}
                </option>
              ))}
            </Select>
            <div className="mt-1 text-xs text-muted" aria-live="polite">
              {props.nodesLoading
                ? t('common.loading')
                : t('requests.resolve.approve.node_compatible_only')}
            </div>
            {props.nodesError ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-danger">
                <span>{t('requests.resolve.nodes_load_error')}</span>
                <Button size="sm" variant="secondary" onClick={props.onRetryNodes}>
                  {t('common.retry')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
