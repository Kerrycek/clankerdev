import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';
import { fetchVpsList, type Vps } from '../../lib/api/vps';
import { useDebouncedValue } from '../../lib/hooks/useDebouncedValue';
import { formatLookupId, parseLookupIdLike } from '../../lib/lookupInput';
import { clsx } from './clsx';
import { Input } from './Input';

interface VpsLookupOption {
  vps: Vps;
  id: number;
  identity: string;
}

function buildOptions(rows: readonly Vps[]): VpsLookupOption[] {
  const occurrences = new Map<number, number>();

  return rows.flatMap((vps) => {
    const id = Number(vps.id);
    if (!Number.isFinite(id) || id <= 0) return [];

    const normalizedId = Math.floor(id);
    const occurrence = occurrences.get(normalizedId) ?? 0;
    occurrences.set(normalizedId, occurrence + 1);

    return [{ vps, id: normalizedId, identity: `${normalizedId}-${occurrence}` }];
  });
}

export function VpsLookupInput(props: {
  value: number | null;
  onChange: (vpsId: number | null) => void;
  userId?: number;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [needleRaw, setNeedleRaw] = useState(() =>
    props.value === null ? '' : formatLookupId(props.value)
  );
  const needle = useDebouncedValue(needleRaw, 150);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const blurTimerRef = useRef<number | null>(null);
  const pointerReleaseTimerRef = useRef<number | null>(null);
  const pointerSelectingRef = useRef(false);
  const rawValueRef = useRef(needleRaw);
  const currentValueRef = useRef<number | null>(props.value);
  const locallyEmittedValueRef = useRef<number | null | undefined>(undefined);
  const previousExternalValueRef = useRef<number | null>(props.value);

  const generatedId = useId();
  const listboxId = `${generatedId}-vps-options`;
  const statusId = `${generatedId}-vps-status`;

  const setRawValue = (value: string) => {
    rawValueRef.current = value;
    setNeedleRaw(value);
  };

  const emitChange = (value: number | null) => {
    currentValueRef.current = value;
    locallyEmittedValueRef.current = value;
    props.onChange(value);
  };

  const clearDeferredBlur = () => {
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };

  const clearPointerRelease = () => {
    if (pointerReleaseTimerRef.current !== null) {
      window.clearTimeout(pointerReleaseTimerRef.current);
      pointerReleaseTimerRef.current = null;
    }
  };

  const closeSuggestions = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  // Keep genuine external changes authoritative without turning the component's
  // immediate ID updates into a one-character typing trap ("12" -> "#1").
  useEffect(() => {
    if (Object.is(previousExternalValueRef.current, props.value)) return;

    previousExternalValueRef.current = props.value;
    currentValueRef.current = props.value;

    if (Object.is(locallyEmittedValueRef.current, props.value)) {
      locallyEmittedValueRef.current = undefined;
      return;
    }

    locallyEmittedValueRef.current = undefined;
    clearDeferredBlur();
    clearPointerRelease();
    pointerSelectingRef.current = false;
    setRawValue(props.value === null ? '' : formatLookupId(props.value));
    closeSuggestions();
  }, [props.value]);

  useEffect(() => {
    clearDeferredBlur();
    clearPointerRelease();
    pointerSelectingRef.current = false;
    closeSuggestions();
  }, [props.disabled, props.userId]);

  useEffect(
    () => () => {
      clearDeferredBlur();
      clearPointerRelease();
    },
    []
  );

  const rawTrimmed = needleRaw.trim();
  const rawIdLike = useMemo(() => parseLookupIdLike(needleRaw), [needleRaw]);
  const debouncedIdLike = useMemo(() => parseLookupIdLike(needle), [needle]);
  const queryMatchesInput = needle === needleRaw;
  const searchEligible = rawTrimmed.length >= 2 && rawIdLike === null;

  const q = useQuery({
    queryKey: ['vps_lookup', { needle, user: props.userId ?? null }],
    queryFn: async ({ signal }) => {
      const term = needle.trim();
      if (!term || parseLookupIdLike(term) !== null) return [] as Vps[];

      const res = await fetchVpsList({
        hostnameAny: term,
        limit: 10,
        user: props.userId,
        signal,
      });
      return res.data;
    },
    enabled:
      open
      && queryMatchesInput
      && needle.trim().length >= 2
      && debouncedIdLike === null
      && !props.disabled,
    staleTime: 15_000,
  });

  const popupOpen = open && searchEligible && !props.disabled;
  const searchBusy = popupOpen && (!queryMatchesInput || q.isFetching);
  const searchFailed = popupOpen && queryMatchesInput && q.isError;

  // Debouncing, refetching, and failures must never leave results for an older
  // or uncertain state actionable.
  const options = useMemo(
    () => (
      queryMatchesInput && searchEligible && !q.isFetching && !q.isError
        ? buildOptions(q.data ?? [])
        : []
    ),
    [q.data, q.isError, q.isFetching, queryMatchesInput, searchEligible]
  );
  const expanded = popupOpen && options.length > 0;
  const accessibleName = props.ariaLabel ?? props.placeholder ?? t('vps.list.col.vps');
  const statusText = !popupOpen
    ? ''
    : searchBusy
      ? t('common.loading')
      : searchFailed
        ? t('common.error')
        : options.length === 0
          ? t('common.no_results')
          : `${options.length} ${accessibleName}`;

  useEffect(() => {
    if (!expanded) {
      setActiveIndex(-1);
      return;
    }

    setActiveIndex((index) => (index >= 0 && index < options.length ? index : 0));
  }, [expanded, options]);

  const activeOption = expanded && activeIndex >= 0 ? options[activeIndex] : undefined;
  const activeOptionId = activeOption
    ? `${listboxId}-option-${activeOption.identity}`
    : undefined;

  useEffect(() => {
    if (!expanded || activeIndex < 0) return;
    const option = listboxRef.current?.querySelector<HTMLElement>(
      `[data-vps-option-index="${activeIndex}"]`
    );
    option?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, expanded]);

  const commitRawId = (value: string): boolean => {
    const id = parseLookupIdLike(value);
    if (id === null) return false;

    if (currentValueRef.current !== id) emitChange(id);
    setRawValue(formatLookupId(id));
    return true;
  };

  const finishBlur = () => {
    if (pointerSelectingRef.current) return;
    if (wrapperRef.current?.contains(document.activeElement)) return;

    closeSuggestions();

    const currentRawValue = rawValueRef.current;
    if (parseLookupIdLike(currentRawValue) !== null) {
      commitRawId(currentRawValue);
      return;
    }

    if (!currentRawValue.trim() && currentValueRef.current !== null) emitChange(null);
  };

  const scheduleBlur = () => {
    clearDeferredBlur();
    blurTimerRef.current = window.setTimeout(() => {
      blurTimerRef.current = null;
      finishBlur();
    }, 0);
  };

  const onSelect = (option: VpsLookupOption) => {
    clearDeferredBlur();
    clearPointerRelease();
    pointerSelectingRef.current = false;
    emitChange(option.id);
    setRawValue(formatLookupId(option.id));
    closeSuggestions();
  };

  const moveActive = (direction: 1 | -1) => {
    if (options.length === 0) return;
    setActiveIndex((index) => {
      if (index < 0) return direction === 1 ? 0 : options.length - 1;
      return (index + direction + options.length) % options.length;
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;

    if (event.key === 'Escape') {
      // The first Escape belongs to the open combobox. Keeping focus in the
      // input also lets a second Escape reach and close a parent Drawer.
      if (popupOpen) {
        event.preventDefault();
        event.stopPropagation();
        closeSuggestions();
      }
      return;
    }

    const hasNavigationModifier =
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (hasNavigationModifier || !searchEligible) return;
      event.preventDefault();
      setOpen(true);
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      if (hasNavigationModifier || !expanded) return;
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
      return;
    }

    if (event.key !== 'Enter' || hasNavigationModifier) return;

    if (activeOption) {
      event.preventDefault();
      onSelect(activeOption);
      return;
    }

    // Do not let a pending, empty, or failed popup accidentally submit an
    // enclosing form as if a VPS had been selected.
    if (popupOpen) {
      event.preventDefault();
      return;
    }

    if (commitRawId(rawValueRef.current)) {
      event.preventDefault();
      closeSuggestions();
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      data-testid={props.testId ? `${props.testId}.wrap` : undefined}
    >
      <Input
        ref={inputRef}
        testId={props.testId}
        ariaLabel={accessibleName}
        ariaControls={listboxId}
        ariaExpanded={expanded}
        ariaAutocomplete="list"
        ariaActiveDescendant={activeOptionId}
        ariaDescribedBy={popupOpen ? statusId : undefined}
        role="combobox"
        value={needleRaw}
        onChange={(event) => {
          const value = event.target.value;
          setRawValue(value);
          setOpen(true);
          setActiveIndex(-1);

          const id = parseLookupIdLike(value);
          if (id !== null) {
            if (currentValueRef.current !== id) emitChange(id);
            return;
          }

          if (currentValueRef.current !== null) emitChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;
          if (nextTarget instanceof Node && wrapperRef.current?.contains(nextTarget)) return;
          scheduleBlur();
        }}
        onKeyDown={onKeyDown}
        disabled={props.disabled}
        placeholder={props.placeholder}
        autoComplete="off"
        className={clsx('h-11 min-h-11')}
      />

      {popupOpen ? (
        <div
          className={clsx(
            'absolute z-10 mt-1 w-full rounded-md border border-border bg-overlay-surface shadow-panel',
            'max-h-64 overflow-auto'
          )}
          data-testid={props.testId ? `${props.testId}.menu` : undefined}
          data-overlay="popover"
          data-overlay-surface="overlay"
        >
          {expanded ? (
            <div ref={listboxRef} id={listboxId} role="listbox" aria-label={accessibleName}>
              {options.map((option, index) => {
                const hostname = String(option.vps.hostname ?? '');
                const active = index === activeIndex;
                return (
                  <button
                    type="button"
                    key={option.identity}
                    id={`${listboxId}-option-${option.identity}`}
                    role="option"
                    aria-selected={active}
                    tabIndex={-1}
                    className={clsx(
                      'block min-h-11 w-full px-3 py-2 text-left text-sm',
                      active ? 'bg-surface-2' : 'hover:bg-surface-2',
                      'focus:bg-surface-2 focus:outline-none'
                    )}
                    onPointerDown={(event) => {
                      pointerSelectingRef.current = true;
                      clearDeferredBlur();
                      if (event.pointerType === 'mouse') event.preventDefault();
                    }}
                    onMouseDown={(event) => {
                      pointerSelectingRef.current = true;
                      clearDeferredBlur();
                      event.preventDefault();
                    }}
                    onPointerUp={() => {
                      clearPointerRelease();
                      pointerReleaseTimerRef.current = window.setTimeout(() => {
                        pointerReleaseTimerRef.current = null;
                        pointerSelectingRef.current = false;
                        finishBlur();
                      }, 0);
                    }}
                    onPointerCancel={() => {
                      clearPointerRelease();
                      pointerSelectingRef.current = false;
                      scheduleBlur();
                    }}
                    onClick={() => onSelect(option)}
                    onPointerEnter={() => setActiveIndex(index)}
                    data-vps-option-index={index}
                    data-testid={props.testId ? `${props.testId}.opt.${option.id}` : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {hostname || formatLookupId(option.id)}
                        </div>
                        <div className="truncate text-xs text-faint">
                          {formatLookupId(option.id)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div
            id={statusId}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={clsx(
              expanded ? 'sr-only' : 'px-3 py-2 text-sm',
              searchFailed ? 'text-danger' : 'text-muted'
            )}
            data-testid={props.testId ? `${props.testId}.status` : undefined}
          >
            {statusText}
          </div>
        </div>
      ) : null}
    </div>
  );
}
