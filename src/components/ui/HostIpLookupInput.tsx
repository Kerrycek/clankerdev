import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { HostIpAddress } from '../../lib/api/exports';
import { fetchHostIpAddresses } from '../../lib/api/exports';
import { useDebouncedValue } from '../../lib/hooks/useDebouncedValue';

import { Input } from './Input';
import { clsx } from './clsx';
import { parseLookupIdLike, formatLookupId } from '../../lib/lookupInput';

export function HostIpLookupInput(props: {
  value: number | null;
  onChange: (hostIpId: number | null) => void;
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

  useEffect(() => {
    if (props.value === null) return;
    if (open && needleRaw.trim().length > 0) return;
    setNeedleRaw(`#${props.value}`);
  }, [props.value, open, needleRaw]);

  const idLike = useMemo(() => parseLookupIdLike(needle), [needle]);

  const q = useQuery({
    queryKey: ['host_ip_lookup', { needle, user: props.userId ?? null }],
    queryFn: async () => {
      if (!needle.trim()) return [] as HostIpAddress[];
      if (parseLookupIdLike(needle) !== null) return [] as HostIpAddress[];
      const res = await fetchHostIpAddresses({ q: needle.trim(), limit: 10, user: props.userId, assigned: true });
      return res.data as HostIpAddress[];
    },
    enabled: open && needle.trim().length >= 2 && idLike === null && !props.disabled,
    staleTime: 15_000,
  });

  const suggestions = q.data ?? [];

  const onSelect = (ip: HostIpAddress) => {
    const id = Number(ip.id);
    if (!Number.isFinite(id) || id <= 0) return;
    props.onChange(Math.floor(id));
    setNeedleRaw(formatLookupId(id));
    setOpen(false);
  };

  const onBlur = () => {
    window.setTimeout(() => setOpen(false), 100);
    const id = parseLookupIdLike(needleRaw);
    if (id !== null) {
      props.onChange(id);
      setNeedleRaw(formatLookupId(id));
      return;
    }
    if (!needleRaw.trim()) props.onChange(null);
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
          if (id !== null) {
            props.onChange(id);
            return;
          }
          if (!v.trim()) props.onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={(e) => {
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
          {suggestions.map((ip) => {
            const id = Number(ip.id);
            const addr = String(ip.addr ?? formatLookupId(id));
            return (
              <button
                type="button"
                key={String(id)}
                className={clsx(
                  'block w-full px-3 py-2 text-left text-sm',
                  'hover:bg-surface-2 focus:bg-surface-2 focus:outline-none'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(ip)}
                data-testid={props.testId ? `${props.testId}.opt.${id}` : undefined}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{addr}</div>
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
