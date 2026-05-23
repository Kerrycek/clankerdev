import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchVpsList, type Vps } from '../../lib/api/vps';
import { useDebouncedValue } from '../../lib/hooks/useDebouncedValue';
import { Input } from './Input';
import { clsx } from './clsx';
import { parseLookupIdLike, formatLookupId } from '../../lib/lookupInput';

export function VpsLookupInput(props: {
  value: number | null;
  onChange: (vpsId: number | null) => void;
  userId?: number;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);

  const [needleRaw, setNeedleRaw] = useState('');
  const needle = useDebouncedValue(needleRaw, 150);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // When a value is set externally, reflect it in the input.
  useEffect(() => {
    if (props.value === null) return;
    // Do not clobber user's typing.
    if (open && needleRaw.trim().length > 0) return;
    setNeedleRaw(`#${props.value}`);
  }, [props.value, open, needleRaw]);

  const idLike = useMemo(() => parseLookupIdLike(needle), [needle]);

  const q = useQuery({
    queryKey: ['vps_lookup', { needle, user: props.userId ?? null }],
    queryFn: async () => {
      if (!needle.trim()) return [] as Vps[];
      // If it's clearly an ID, skip suggestions.
      if (parseLookupIdLike(needle) !== null) return [] as Vps[];
      const res = await fetchVpsList({
        hostnameAny: needle.trim(),
        limit: 10,
        user: props.userId,
      });
      return res.data;
    },
    enabled: open && needle.trim().length >= 2 && idLike === null && !props.disabled,
    staleTime: 15_000,
  });

  const suggestions = q.data ?? [];

  const onSelect = (vps: Vps) => {
    const id = Number(vps.id);
    if (!Number.isFinite(id) || id <= 0) return;
    props.onChange(Math.floor(id));
    setNeedleRaw(formatLookupId(id));
    setOpen(false);
  };

  const onBlur = () => {
    // Small delay to allow click selection.
    window.setTimeout(() => setOpen(false), 100);

    // If user typed an id-like value, commit it.
    const id = parseLookupIdLike(needleRaw);
    if (id !== null) {
      props.onChange(id);
      setNeedleRaw(formatLookupId(id));
      return;
    }

    // If cleared, unset.
    if (!needleRaw.trim()) props.onChange(null);
  };

  const onFocus = () => setOpen(true);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
    }

    if (e.key === 'Enter') {
      const id = parseLookupIdLike(needleRaw);
      if (id !== null) {
        e.preventDefault();
        props.onChange(id);
        setNeedleRaw(formatLookupId(id));
        setOpen(false);
        inputRef.current?.blur();
      }
    }
  };

  return (
    <div className="relative" data-testid={props.testId ? `${props.testId}.wrap` : undefined}>
      <Input
        ref={inputRef}
        testId={props.testId}
        ariaLabel={props.ariaLabel}
        value={needleRaw}
        onChange={(e) => {
          const v = e.target.value;
          setNeedleRaw(v);

          const id = parseLookupIdLike(v);

          // If user types an id-like value, commit it immediately so dependent UI
          // (e.g. submit buttons) can enable without requiring blur.
          if (id !== null) {
            props.onChange(id);
            return;
          }

          // If user clears the input, reflect immediately.
          if (!v.trim()) props.onChange(null);
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
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
          {suggestions.map((vps) => {
            const id = Number(vps.id);
            const hostname = String(vps.hostname ?? '');
            return (
              <button
                type="button"
                key={String(id)}
                className={clsx(
                  'block w-full px-3 py-2 text-left text-sm',
                  'hover:bg-surface-2 focus:bg-surface-2 focus:outline-none'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(vps)}
                data-testid={props.testId ? `${props.testId}.opt.${id}` : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{hostname || formatLookupId(id)}</div>
                    <div className="truncate text-xs text-faint">{formatLookupId(id)}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
