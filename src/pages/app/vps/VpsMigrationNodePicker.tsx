import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

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
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const disabled = props.disabled || props.loading || props.error;
  const targets = props.nodes.filter((node) => node.id !== props.sourceId && node.active !== false && (!node.type || node.type === 'node'));
  const needle = search.trim().toLocaleLowerCase();
  const matches = targets.filter((node) => `${pickedNodeLabel(node)} ${locationLabel(node)} ${environmentLabel(node)}`.toLocaleLowerCase().includes(needle))
    .sort((a, b) => locationLabel(a).localeCompare(locationLabel(b)) || pickedNodeLabel(a).localeCompare(pickedNodeLabel(b), undefined, { numeric: true }));
  const selected = targets.find((node) => String(node.id) === props.value);

  const expanded = open && !disabled;
  useEffect(() => {
    if (!expanded) return;
    input.current?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof globalThis.Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [expanded]);
  useEffect(() => {
    if (expanded) document.getElementById(`${listId}-${matches[active]?.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, expanded, listId, matches[active]?.id]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function pick(node: Node) {
    props.onChange(String(node.id));
    close();
  }
  function toggle() {
    setSearch('');
    setActive(0);
    setOpen(!expanded);
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">{t('vps.lifecycle.migrate.target_title')}</div>
      <div className="text-xs text-muted">{t('vps.lifecycle.migrate.source', { node: props.sourceLabel })}</div>
      <div ref={root} className="relative" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
        <button
          ref={trigger}
          type="button"
          disabled={disabled}
          aria-label={`${t('vps.lifecycle.migrate.target_title')}: ${selected ? pickedNodeLabel(selected) : t('vps.lifecycle.migrate.choose_node')}`}
          aria-haspopup="listbox"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          onClick={toggle}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (!expanded) toggle();
            }
          }}
          data-testid="vps.lifecycle.migrate.node"
          className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-left text-sm disabled:opacity-60"
        >
          <span className="min-w-0 break-words">
            {selected ? <>
              <span className="block font-semibold" data-testid="vps.lifecycle.migrate.selected">{pickedNodeLabel(selected)}</span>
              <span className="block text-xs text-muted">{locationLabel(selected)}{environmentLabel(selected) ? ` · ${environmentLabel(selected)}` : ''}</span>
            </> : t('vps.lifecycle.migrate.choose_node')}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
        {expanded ? (
          <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-border bg-overlay-surface shadow-panel"
            data-overlay="popover" data-overlay-surface="overlay" data-testid="vps.lifecycle.migrate.nodes">
            <div className="p-2">
              <Input ref={input} value={search} onChange={(event) => { setSearch(event.target.value); setActive(0); }}
                ariaLabel={t('vps.lifecycle.migrate.search')} placeholder={t('vps.lifecycle.migrate.search')}
                testId="vps.lifecycle.migrate.node.search" autoComplete="off"
                role="combobox" ariaExpanded ariaControls={listId} ariaAutocomplete="list"
                ariaActiveDescendant={matches[active] ? `${listId}-${matches[active].id}` : undefined}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
                  if (event.key === 'ArrowDown') { event.preventDefault(); setActive(Math.min(matches.length - 1, active + 1)); }
                  if (event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(0, active - 1)); }
                  if (event.key === 'Enter') { event.preventDefault(); if (matches[active]) pick(matches[active]); }
                }} />
            </div>
            <ul id={listId} role="listbox" aria-label={t('vps.lifecycle.migrate.target_title')}
              className="max-h-64 overflow-y-auto border-t border-border p-1">
              {matches.map((node, index) => (
                <li key={node.id} role="presentation">
                  <button type="button" role="option" id={`${listId}-${node.id}`} tabIndex={-1}
                    aria-selected={String(node.id) === props.value}
                    onMouseDown={(event) => event.preventDefault()} onClick={() => pick(node)}
                    data-testid={`vps.lifecycle.migrate.node.opt.${node.id}`}
                    className={clsx('flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left hover:bg-surface-2', index === active && 'bg-surface-2')}>
                    <span className="min-w-0 break-words">
                      <span className="block text-sm font-semibold">{pickedNodeLabel(node)}</span>
                      <span className="block text-xs text-muted">{locationLabel(node)}{environmentLabel(node) ? ` · ${environmentLabel(node)}` : ''}</span>
                    </span>
                    {String(node.id) === props.value ? <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> : null}
                  </button>
                </li>
              ))}
            </ul>
            {!matches.length ? <p role="status" className="p-3 text-sm text-muted">{t('vps.lifecycle.migrate.no_nodes')}</p> : null}
          </div>
        ) : null}
      </div>
      {props.loading ? <p role="status" className="text-sm text-muted">{t('common.loading')}</p> : null}
      {props.error ? <>
        <Alert variant="danger">{t('vps.lifecycle.migrate.nodes_load_error')}</Alert>
        <div><Button disabled={props.disabled} onClick={props.onRetry} testId="vps.lifecycle.migrate.nodes_retry">{t('common.retry')}</Button></div>
      </> : null}
    </div>
  );
}
