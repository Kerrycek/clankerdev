import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { Dataset } from '../../lib/api/datasets';
import { findDatasetByName } from '../../lib/api/datasets';
import { useDebouncedValue } from '../../lib/hooks/useDebouncedValue';
import { formatLookupId, parseLookupIdLike } from '../../lib/lookupInput';

import { Input } from './Input';
import { clsx } from './clsx';

/**
 * Resolve either an exact dataset ID or an exact dataset name.
 * Dataset::Index has no text-search input; names therefore use the dedicated
 * Dataset::FindByName action instead of pretending that Index supports `q`.
 */
export function DatasetLookupInput(props: {
  value: number | null;
  onChange: (datasetId: number | null) => void;
  userId?: number;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [needleRaw, setNeedleRaw] = useState('');
  const needle = useDebouncedValue(needleRaw.trim(), 250);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (props.value === null) return;
    if (open && needleRaw.trim().length > 0) return;
    setNeedleRaw(formatLookupId(props.value));
  }, [props.value, open, needleRaw]);

  const idLike = useMemo(() => parseLookupIdLike(needle), [needle]);
  const q = useQuery({
    queryKey: ['dataset_lookup', 'find_by_name', { name: needle, user: props.userId ?? null }],
    queryFn: async () => (await findDatasetByName(needle, props.userId)).data,
    enabled: open && needle.length >= 2 && idLike === null && !props.disabled,
    retry: false,
    staleTime: 15_000,
  });

  const suggestions: Dataset[] = q.data ? [q.data] : [];

  const onSelect = (dataset: Dataset) => {
    const id = Number(dataset.id);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    props.onChange(id);
    setNeedleRaw(formatLookupId(id));
    setOpen(false);
  };

  const onBlur = () => {
    window.setTimeout(() => setOpen(false), 100);
    const id = parseLookupIdLike(needleRaw);
    if (id !== null) {
      props.onChange(id);
      setNeedleRaw(formatLookupId(id));
    }
  };

  return (
    <div className="relative" data-testid={props.testId ? `${props.testId}.wrap` : undefined}>
      <Input
        ref={inputRef}
        testId={props.testId}
        ariaLabel={props.ariaLabel}
        value={needleRaw}
        onChange={(event) => {
          const value = event.target.value;
          setNeedleRaw(value);
          props.onChange(parseLookupIdLike(value));
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            inputRef.current?.blur();
          }
          if (event.key === 'Enter') {
            const id = parseLookupIdLike(needleRaw);
            if (id !== null) {
              event.preventDefault();
              props.onChange(id);
              setNeedleRaw(formatLookupId(id));
              setOpen(false);
              inputRef.current?.blur();
            } else if (suggestions[0]) {
              event.preventDefault();
              onSelect(suggestions[0]);
            }
          }
        }}
        disabled={props.disabled}
        placeholder={props.placeholder}
        className={clsx('h-10')}
      />

      {open && suggestions.length > 0 ? (
        <div
          className={clsx(
            'absolute z-10 mt-1 w-full rounded-md border border-border bg-overlay-surface shadow-panel',
            'max-h-64 overflow-auto'
          )}
          data-testid={props.testId ? `${props.testId}.menu` : undefined}
          data-overlay="popover"
          data-overlay-surface="overlay"
        >
          {suggestions.map((dataset) => {
            const id = Number(dataset.id);
            const name = String(dataset.full_name ?? dataset.name ?? formatLookupId(id));
            return (
              <button
                type="button"
                key={String(id)}
                className={clsx(
                  'block w-full px-3 py-2 text-left text-sm',
                  'hover:bg-surface-2 focus:bg-surface-2 focus:outline-none'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(dataset)}
                data-testid={props.testId ? `${props.testId}.opt.${id}` : undefined}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{name}</div>
                  <div className="truncate text-xs text-faint">{formatLookupId(id)}</div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
