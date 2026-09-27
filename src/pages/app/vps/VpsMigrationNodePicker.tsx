import { useState } from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { clsx } from '../../../components/ui/clsx';
import type { Node } from '../../../lib/api/nodes';
import { pickedNodeLabel } from './VpsLifecycleModel';

function locationLabel(node: Node): string {
  return String(node.location?.label ?? node.location?.description ?? '—');
}

function environmentLabel(node: Node): string {
  const environment = node.location?.['environment'];
  if (!environment || typeof environment !== 'object') return '';
  const record = environment as Record<string, unknown>;
  return String(record['label'] ?? record['name'] ?? '');
}

export function VpsMigrationNodePicker(props: {
  nodes: Node[];
  sourceId: number | null;
  sourceLabel: string;
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const targets = props.nodes.filter((node) => node.id !== props.sourceId && node.active !== false && (!node.type || node.type === 'node'));
  const needle = search.trim().toLocaleLowerCase();
  const matches = targets.filter((node) => `${pickedNodeLabel(node)} ${locationLabel(node)} ${environmentLabel(node)}`.toLocaleLowerCase().includes(needle))
    .sort((a, b) => locationLabel(a).localeCompare(locationLabel(b)) || pickedNodeLabel(a).localeCompare(pickedNodeLabel(b), undefined, { numeric: true }));
  const selected = targets.find((node) => String(node.id) === props.value);

  return (
    <div className="space-y-3">
      <fieldset className="min-w-0 space-y-3" disabled={props.disabled || props.loading || props.error}>
        <legend className="text-sm font-semibold">{t('vps.lifecycle.migrate.target_title')}</legend>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{t('vps.lifecycle.migrate.source', { node: props.sourceLabel })}</span>
          {selected ? <span className="font-semibold text-fg" data-testid="vps.lifecycle.migrate.selected">{t('vps.lifecycle.migrate.selected', { node: pickedNodeLabel(selected) })}</span> : null}
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          ariaLabel={t('vps.lifecycle.migrate.search')}
          placeholder={t('vps.lifecycle.migrate.search')}
          testId="vps.lifecycle.migrate.node"
        />
        {props.loading ? <p role="status" className="text-sm text-muted">{t('common.loading')}</p> : null}
        {props.error ? <Alert variant="danger">{t('vps.lifecycle.migrate.nodes_load_error')}</Alert> : null}
        {!props.error && !props.loading ? (
          <div className="grid max-h-56 gap-2 overflow-y-auto p-1 sm:grid-cols-2 lg:grid-cols-3" data-testid="vps.lifecycle.migrate.nodes">
            {matches.map((node) => (
              <label key={node.id} className={clsx(
                'flex min-w-0 cursor-pointer items-start gap-2 rounded-md border p-3',
                String(node.id) === props.value ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:bg-surface-2',
                props.disabled && 'cursor-not-allowed opacity-60',
              )}>
                <input
                  type="radio"
                  name="migration-target-node"
                  value={node.id}
                  checked={String(node.id) === props.value}
                  onChange={() => props.onChange(String(node.id))}
                  data-testid={`vps.lifecycle.migrate.node.opt.${node.id}`}
                  className="mt-1 h-4 w-4 shrink-0 accent-accent"
                />
                <span className="min-w-0 break-words">
                  <span className="block text-sm font-semibold">{pickedNodeLabel(node)}</span>
                  <span className="block text-xs text-muted">{locationLabel(node)}{environmentLabel(node) ? ` · ${environmentLabel(node)}` : ''}</span>
                </span>
              </label>
            ))}
            {!matches.length ? <p role="status" className="text-sm text-muted">{t('vps.lifecycle.migrate.no_nodes')}</p> : null}
          </div>
        ) : null}
      </fieldset>
      {/* Retry remains available when loading the node list failed. */}
      {props.error ? <div><Button disabled={props.disabled} onClick={props.onRetry} testId="vps.lifecycle.migrate.nodes_retry">{t('common.retry')}</Button></div> : null}
    </div>
  );
}
