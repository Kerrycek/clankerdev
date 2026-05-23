import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Input } from './Input';
import { clsx } from './clsx';

export interface SmartFilterSuggestion {
  id: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  onPick: () => void;
  /** Optional test id for E2E / integration tests */
  testId?: string;
}

export interface SmartFilterInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
  ariaLabel?: string;

  /** Right-side adornment rendered inside the input container. */
  suffix?: React.ReactNode;

  /** Backward-compatible alias for the forwarded ref. Prefer using `ref`. */
  inputRef?: React.Ref<HTMLInputElement>;

  /** Suggestion rows rendered below the input. */
  suggestions?: SmartFilterSuggestion[];

  /** Called when the user presses Enter with no suggestions. */
  onSubmit?: () => void;

  /** Backward-compatible validation surface used by older pages. */
  errors?: string[];

  className?: string;
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  try {
    (ref as React.MutableRefObject<T | null>).current = value;
  } catch {
    // ignore readonly refs
  }
}

export const SmartFilterInput = React.forwardRef<HTMLInputElement, SmartFilterInputProps>(function SmartFilterInput(
  props,
  ref
) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const blurTimer = useRef<number | null>(null);

  const suggestions = props.suggestions ?? [];

  // When suggestions change, select the first one by default.
  useEffect(() => {
    if (!open) return;
    setActiveIdx(suggestions.length > 0 ? 0 : -1);
  }, [open, suggestions.length]);

  const hasSuffix = Boolean(props.suffix);
  const showDropdown = open && suggestions.length > 0;

  function closeSoon() {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    blurTimer.current = window.setTimeout(() => {
      setOpen(false);
      setActiveIdx(-1);
    }, 120);
  }

  function pick(idx: number) {
    const s = suggestions[idx];
    if (!s) return;
    s.onPick();
    setOpen(false);
    setActiveIdx(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
      return;
    }

    if (e.key === 'ArrowDown') {
      if (!open) {
        setOpen(true);
        setActiveIdx(suggestions.length > 0 ? 0 : -1);
        e.preventDefault();
        return;
      }

      if (suggestions.length === 0) return;
      setActiveIdx((i) => Math.min(suggestions.length - 1, Math.max(0, i + 1)));
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowUp') {
      if (!open) return;
      if (suggestions.length === 0) return;
      setActiveIdx((i) => Math.max(0, i - 1));
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      if (open && suggestions.length > 0) {
        pick(activeIdx >= 0 ? activeIdx : 0);
        e.preventDefault();
        return;
      }

      props.onSubmit?.();
      e.preventDefault();
    }
  }

  // Keep dropdown open while user types.
  const inputValue = useMemo(() => String(props.value ?? ''), [props.value]);

  return (
    <div className={clsx('relative', props.className)}>
      <div className="relative">
        <Input
          ref={(el) => {
            assignRef(ref, el);
            assignRef(props.inputRef, el);
          }}
          value={inputValue}
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
          className={clsx(hasSuffix ? 'pr-11' : undefined)}
          autoComplete="off"
        />

        {props.suffix ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">{props.suffix}</div>
        ) : null}
      </div>

      {showDropdown ? (
        <div
          className={clsx(
            'absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-border bg-overlay-surface shadow-panel',
            'max-h-72 overflow-y-auto'
          )}
          data-testid={props.testId ? `${props.testId}.dropdown` : undefined}
          data-overlay="popover"
          data-overlay-surface="overlay"
        >
          <ul className="py-1">
            {suggestions.map((s, idx) => {
              const active = idx === activeIdx;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={clsx(
                      'flex w-full items-start justify-between gap-3 px-3 py-2 text-left',
                      active ? 'bg-surface-2' : 'hover:bg-surface-2'
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(idx);
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    data-testid={s.testId}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-fg">{s.primary}</div>
                      {s.secondary ? <div className="mt-0.5 truncate text-xs text-muted">{s.secondary}</div> : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
});
