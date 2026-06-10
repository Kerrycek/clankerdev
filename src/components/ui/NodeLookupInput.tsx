import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { type Node } from '../../lib/api/nodes';
import { fetchNodes } from '../../lib/api/nodes';
import { useDebouncedValue } from '../../lib/hooks/useDebouncedValue';

import { Input } from './Input';
import { clsx } from './clsx';
import { parseLookupIdLike } from '../../lib/lookupInput';

export function NodeLookupInput(props: {
  /** Raw input value (typically a node id string, but may be a query while searching). */
  value: string;
  onChange: (value: string) => void;

  /** Called when the user picks a suggestion. */
  onPick?: (node: Node) => void;
  selectedLabel?: string;

  placeholder?: string;
  disabled?: boolean;
  testId?: string;
  ariaLabel?: string;
  className?: string;

  /** Suggestion count limit. */
  limit?: number;

  /** How many nodes to load for client-side search. */
  fetchLimit?: number;

  loadingLabel?: string;
  noResultsLabel?: string;
}) {
  const limit = typeof props.limit === 'number' && props.limit > 0 ? props.limit : 8;
  const fetchLimit = typeof props.fetchLimit === 'number' && props.fetchLimit > 0 ? props.fetchLimit : 250;

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const blurTimer = useRef<number | null>(null);

  const needle = useMemo(() => String(props.value ?? '').trim(), [props.value]);
  const debouncedNeedle = useDebouncedValue(needle, 150);
  const numeric = useMemo(() => parseLookupIdLike(needle) !== null, [needle]);

  const q = useQuery({
    queryKey: ['nodes', 'lookup', { limit: fetchLimit }],
    enabled: open && !props.disabled,
    queryFn: async () => (await fetchNodes({ limit: fetchLimit })).data,
    staleTime: 30_000,
  });

  const allNodes = q.data ?? [];

  const filtered = useMemo(() => {
    if (!open) return [] as Node[];
    const n = debouncedNeedle.trim();
    if (!n) return [] as Node[];

    if (numeric) {
      const id = parseLookupIdLike(n);
      if (id === null) return [] as Node[];
      return allNodes.filter((x) => x.id === id).slice(0, limit);
    }

    const low = n.toLowerCase();
    return allNodes
      .filter((x) => {
        const dn = String(x.domain_name ?? x.name ?? '');
        const fqdn = String(x.fqdn ?? '');
        return String(dn).toLowerCase().includes(low) || String(fqdn).toLowerCase().includes(low);
      })
      .slice(0, limit);
  }, [allNodes, debouncedNeedle, limit, numeric, open]);

  const waitingForDebounce = needle !== debouncedNeedle;

  useEffect(() => {
    setActiveIdx(filtered.length > 0 ? 0 : -1);
  }, [filtered.length]);

  function closeSoon() {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    blurTimer.current = window.setTimeout(() => {
      setOpen(false);
      setActiveIdx(-1);
    }, 120);
  }

  function pick(node: Node) {
    props.onChange(String(node.id));
    props.onPick?.(node);
    setOpen(false);
    setActiveIdx(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
      return;
    }

    if (!open) {
      if (e.key === 'ArrowDown' && filtered.length > 0) {
        setOpen(true);
        setActiveIdx(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      if (filtered.length === 0) return;
      setActiveIdx((i) => Math.min(filtered.length - 1, Math.max(0, i + 1)));
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowUp') {
      if (filtered.length === 0) return;
      setActiveIdx((i) => Math.max(0, i - 1));
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      if (filtered.length === 0 || activeIdx < 0) return;
      const n = filtered[activeIdx];
      if (n) pick(n);
      e.preventDefault();
    }
  }

  const showDropdown = open && needle.length >= 1;
  const displayValue = props.selectedLabel && !open ? props.selectedLabel : props.value;

  return (
    <div className={clsx('relative', props.className)}>
      <Input
        value={displayValue}
        onChange={(e) => {
          props.onChange(e.target.value);
          setOpen(true);
          setActiveIdx(-1);
        }}
        onFocus={() => {
          if (blurTimer.current) window.clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => closeSoon()}
        onKeyDown={onKeyDown}
        placeholder={props.placeholder}
        disabled={props.disabled}
        testId={props.testId}
        ariaLabel={props.ariaLabel}
        autoComplete="off"
      />

      {showDropdown ? (
        <div
          className={clsx(
            'absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-border bg-overlay-surface shadow-panel',
            'max-h-64 overflow-y-auto'
          )}
          data-testid={props.testId ? `${props.testId}.dropdown` : undefined}
          data-overlay="popover"
          data-overlay-surface="overlay"
        >
          {q.isLoading || q.isFetching || (waitingForDebounce && filtered.length === 0) ? (
            <div className="px-3 py-2 text-xs text-muted">{props.loadingLabel ?? ''}</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted">{props.noResultsLabel ?? ''}</div>
          ) : (
            <ul className="py-1">
              {filtered.map((n, idx) => {
                const active = idx === activeIdx;
                const id = n.id;
                const dn = String(n.domain_name ?? n.name ?? `#${id}`);
                const fqdn = String(n.fqdn ?? '');

                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={clsx(
                        'flex w-full items-start justify-between gap-3 px-3 py-2 text-left',
                        active ? 'bg-surface-2' : 'hover:bg-surface-2'
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(n);
                      }}
                      onMouseEnter={() => setActiveIdx(idx)}
                      data-testid={props.testId ? `${props.testId}.opt.${id}` : undefined}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-fg">{dn}</div>
                        {fqdn ? <div className="mt-0.5 truncate text-xs text-muted">{fqdn}</div> : null}
                      </div>
                      <div className="shrink-0 text-xs tabular-nums text-faint">#{id}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
