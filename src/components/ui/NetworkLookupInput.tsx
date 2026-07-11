import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchNetwork, fetchNetworks, type Network, type NetworkPurpose } from '../../lib/api/networks';
import { useDebouncedValue } from '../../lib/hooks/useDebouncedValue';
import { formatLookupId, parseLookupIdLike } from '../../lib/lookupInput';
import { clsx } from './clsx';
import { Input } from './Input';

function networkLabel(network: Network): string {
  const label = typeof network.label === 'string' ? network.label.trim() : '';
  const address = typeof network.address === 'string' ? network.address.trim() : '';
  const prefix = typeof network.prefix === 'number' ? network.prefix : undefined;
  const cidr = address ? `${address}${prefix !== undefined ? `/${prefix}` : ''}` : '';

  if (label && cidr) return `${label} (${cidr})`;
  if (label) return label;
  if (cidr) return cidr;
  return formatLookupId(Number(network.id));
}

function networkMeta(network: Network): string {
  const bits = [
    formatLookupId(Number(network.id)),
    typeof network.ip_version === 'number' ? `IPv${network.ip_version}` : '',
    typeof network.purpose === 'string' ? network.purpose : '',
    typeof network.role === 'string' ? network.role : '',
  ].filter(Boolean);

  return bits.join(' · ');
}

export function NetworkLookupInput(props: {
  value: number | null;
  onChange: (networkId: number | null) => void;
  purpose?: NetworkPurpose;
  locationId?: number;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
  loadingLabel?: string;
  noResultsLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [needleRaw, setNeedleRaw] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const needle = useDebouncedValue(needleRaw, 150);
  const idLike = useMemo(() => parseLookupIdLike(needle), [needle]);

  useEffect(() => {
    if (props.value === null) {
      if (!open) setNeedleRaw('');
      return;
    }

    if (open && needleRaw.trim().length > 0) return;
    setNeedleRaw(formatLookupId(props.value));
  }, [props.value, open, needleRaw]);

  const q = useQuery({
    queryKey: ['networks', 'lookup', { needle, purpose: props.purpose ?? null, locationId: props.locationId ?? null }],
    queryFn: async () => {
      if (parseLookupIdLike(needle) !== null) return [] as Network[];

      const res = await fetchNetworks({
        q: needle.trim() || undefined,
        limit: 25,
        purpose: props.purpose,
        locationId: props.locationId,
      });

      return res.data;
    },
    enabled: open && idLike === null && !props.disabled,
    staleTime: 15_000,
  });

  const selectedQ = useQuery({
    queryKey: ['networks', 'lookup', 'selected', props.value],
    queryFn: async () => {
      if (props.value === null) return null;
      return (await fetchNetwork(props.value)).data;
    },
    enabled: props.value !== null && !props.disabled,
    staleTime: 60_000,
  });

  const suggestions = q.data ?? [];

  useEffect(() => {
    if (props.value === null || open) return;
    const selected = selectedQ.data;
    if (selected) setNeedleRaw(networkLabel(selected));
  }, [open, props.value, selectedQ.data]);

  const onSelect = (network: Network) => {
    const id = Number(network.id);
    if (!Number.isFinite(id) || id <= 0) return;
    props.onChange(Math.floor(id));
    setNeedleRaw(networkLabel(network));
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

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
      return;
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

  const showLoading = q.isLoading || q.isFetching;

  return (
    <div className="relative" data-testid={props.testId ? `${props.testId}.wrap` : undefined}>
      <Input
        ref={inputRef}
        testId={props.testId}
        ariaLabel={props.ariaLabel}
        value={needleRaw}
        onChange={(e) => {
          const value = e.target.value;
          setNeedleRaw(value);
          setOpen(true);

          const id = parseLookupIdLike(value);
          if (id !== null) {
            props.onChange(id);
            return;
          }

          if (!value.trim()) props.onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        disabled={props.disabled}
        placeholder={props.placeholder}
        autoComplete="off"
      />

      {open && idLike === null ? (
        <div
          className={clsx(
            'absolute z-50 mt-1 w-full rounded-md border border-border bg-overlay-surface shadow-panel',
            'max-h-64 overflow-auto'
          )}
          data-testid={props.testId ? `${props.testId}.menu` : undefined}
          data-overlay="popover"
          data-overlay-surface="overlay"
        >
          {showLoading ? (
            <div className="px-3 py-2 text-xs text-muted">{props.loadingLabel ?? ''}</div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted">{props.noResultsLabel ?? ''}</div>
          ) : (
            suggestions.map((network) => {
              const id = Number(network.id);
              return (
                <button
                  type="button"
                  key={String(id)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelect(network)}
                  data-testid={props.testId ? `${props.testId}.opt.${id}` : undefined}
                >
                  <div className="truncate font-medium">{networkLabel(network)}</div>
                  <div className="truncate text-xs text-faint">{networkMeta(network)}</div>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
