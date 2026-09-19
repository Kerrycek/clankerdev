import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

import { useI18n } from '../../app/i18n';
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

  /** Called with the current input value when the user presses Enter with no suggestions. */
  onSubmit?: (value: string) => void;

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
  const { t, tc } = useI18n();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const blurTimer = useRef<number | null>(null);
  const generatedId = useId();
  const listboxId = `${generatedId}-smart-filter-options`;
  const statusId = `${generatedId}-smart-filter-status`;
  const errorId = `${generatedId}-smart-filter-error`;

  const suggestions = props.suggestions ?? [];
  const inputValue = useMemo(() => String(props.value ?? ''), [props.value]);
  const suggestionIdSequence = suggestions.map((suggestion) => suggestion.id).join('\u001f');
  const hasErrors = Boolean(props.errors?.length);

  // A changed input or result identity is a new suggestion session, even when
  // the number of rows happens to stay the same.
  useEffect(() => {
    setActiveIdx(suggestions.length > 0 ? 0 : -1);
  }, [inputValue, suggestionIdSequence, suggestions.length]);

  useEffect(() => {
    return () => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    };
  }, []);

  const hasSuffix = Boolean(props.suffix);
  const showDropdown = open && suggestions.length > 0;
  const activeOptionId =
    showDropdown && activeIdx >= 0 && suggestions[activeIdx]
      ? `${listboxId}-option-${activeIdx}`
      : undefined;

  useEffect(() => {
    if (!activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeOptionId]);

  function cancelClose() {
    if (blurTimer.current === null) return;
    window.clearTimeout(blurTimer.current);
    blurTimer.current = null;
  }

  function closeSoon() {
    cancelClose();
    blurTimer.current = window.setTimeout(() => {
      blurTimer.current = null;
      setOpen(false);
      setActiveIdx(-1);
    }, 120);
  }

  function pick(idx: number) {
    const s = suggestions[idx];
    if (!s) return;
    cancelClose();
    s.onPick();
    setOpen(false);
    setActiveIdx(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (
      e.nativeEvent.isComposing ||
      e.key === 'Process' ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      e.shiftKey
    ) {
      return;
    }

    if (e.key === 'Escape') {
      // The first Escape belongs to the visible popup. Once it is closed,
      // leave Escape untouched so an enclosing Drawer or Modal can handle it.
      if (!showDropdown) return;
      e.preventDefault();
      e.stopPropagation();
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

      if (suggestions.length === 0) {
        e.preventDefault();
        return;
      }
      setActiveIdx((i) => (i < 0 || i >= suggestions.length - 1 ? 0 : i + 1));
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowUp') {
      if (!open) {
        setOpen(true);
        setActiveIdx(suggestions.length > 0 ? suggestions.length - 1 : -1);
        e.preventDefault();
        return;
      }

      if (suggestions.length === 0) {
        e.preventDefault();
        return;
      }
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      if (open && suggestions.length > 0) {
        pick(activeIdx >= 0 ? activeIdx : 0);
        e.preventDefault();
        return;
      }

      props.onSubmit?.(e.currentTarget.value);
      e.preventDefault();
    }
  }

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
            cancelClose();
            setOpen(true);
            setActiveIdx(suggestions.length > 0 ? 0 : -1);
          }}
          onBlur={() => closeSoon()}
          onKeyDown={onKeyDown}
          placeholder={props.placeholder}
          disabled={props.disabled}
          testId={props.testId}
          ariaLabel={props.ariaLabel}
          ariaControls={listboxId}
          ariaExpanded={showDropdown}
          ariaAutocomplete="list"
          ariaActiveDescendant={activeOptionId}
          ariaInvalid={hasErrors || undefined}
          ariaDescribedBy={hasErrors ? errorId : undefined}
          role="combobox"
          className={clsx('h-11 min-h-11', hasSuffix ? 'pr-11' : undefined)}
          autoComplete="off"
        />

        {props.suffix ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">{props.suffix}</div>
        ) : null}
      </div>

      {showDropdown ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={props.ariaLabel ?? props.placeholder}
          className={clsx(
            'absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-border bg-overlay-surface shadow-panel',
            'max-h-72 overflow-y-auto'
          )}
          data-testid={props.testId ? `${props.testId}.dropdown` : undefined}
          data-overlay="popover"
          data-overlay-surface="overlay"
        >
          <ul className="py-1" role="presentation">
            {suggestions.map((s, idx) => {
              const active = idx === activeIdx;
              return (
                <li key={`${s.id}.${idx}`} role="presentation">
                  <button
                    type="button"
                    id={`${listboxId}-option-${idx}`}
                    role="option"
                    aria-selected={active}
                    tabIndex={-1}
                    className={clsx(
                      'flex min-h-11 w-full items-start justify-between gap-3 px-3 py-2 text-left',
                      active ? 'bg-surface-2' : 'hover:bg-surface-2',
                      'focus:bg-surface-2 focus:outline-none'
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(idx)}
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

      <div id={statusId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {showDropdown
          ? tc('filters.smart.suggestions_available', suggestions.length)
          : open && inputValue.trim()
            ? t('filters.smart.no_suggestions')
            : ''}
      </div>

      {hasErrors ? (
        <div id={errorId} role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
          {props.errors?.join(' ')}
        </div>
      ) : null}
    </div>
  );
});
