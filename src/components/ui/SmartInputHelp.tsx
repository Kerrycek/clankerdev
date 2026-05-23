import React from 'react';

import { useI18n } from '../../app/i18n';

import { Modal } from './Modal';
import { Button } from './Button';
import { clsx } from './clsx';

export interface SmartInputHelpKeyRow {
  key: string;
  description: string;
  example?: string;
}

export interface SmartInputHelpExampleRow {
  /** Canonical shape */
  example?: string;
  description?: string;
  /** Backward-compatible aliases used by existing pages */
  value?: string;
  label?: string;
}

export interface SmartInputHelpAction {
  label: string;
  onClick: () => void;
  variant?: React.ComponentProps<typeof Button>['variant'];
}

export interface SmartInputHelpContentProps {
  intro?: string;

  examples?: SmartInputHelpExampleRow[];
  topKeys?: SmartInputHelpKeyRow[];
  moreKeys?: SmartInputHelpKeyRow[];
  /** Backward-compatible alias used by older pages. */
  keys?: SmartInputHelpKeyRow[];
  /** Backward-compatible alias used by older pages. */
  items?: SmartInputHelpKeyRow[];
  inference?: string[];
  /** Backward-compatible alias used by older pages. */
  inferences?: string[];

  /** Called when user clicks a key row. Should insert `key:` into the input. */
  onInsertKey?: (key: string) => void;

  actions?: SmartInputHelpAction[];
  /** Backward-compatible footnote text used by older pages. */
  footnote?: string;

  /** Close button / back action. */
  onClose?: () => void;
  closeLabel?: string;
  showCloseButton?: boolean;

  /** Optional test ids for E2E / integration tests */
  testId?: string;
  keyRowTestIdPrefix?: string;
}

function normalizeExampleRow(row: SmartInputHelpExampleRow) {
  return {
    example: String(row.example ?? row.value ?? '').trim(),
    description: String(row.description ?? row.label ?? '').trim(),
  };
}

/**
 * Reusable help body shared by modal help (SmartInputHelp) and inline help surfaces.
 */
export function SmartInputHelpContent(props: SmartInputHelpContentProps) {
  const { t } = useI18n();

  const keysTop = props.topKeys ?? props.keys ?? props.items ?? [];
  const keysMore = props.moreKeys ?? [];
  const examples = (props.examples ?? []).map(normalizeExampleRow).filter((row) => row.example || row.description);

  const showClose = props.showCloseButton !== false;
  const closeLabel = props.closeLabel ?? t('common.close');

  return (
    <div data-testid={props.testId}>
      {props.intro ? <div className="text-sm text-muted">{props.intro}</div> : null}

      {examples.length > 0 ? (
        <div className="mt-4">
          <div className="text-sm font-semibold">{t('filters.help.examples')}</div>
          <div className="mt-2 grid gap-2">
            {examples.map((ex) => (
              <div key={`${ex.example}::${ex.description}`} className="rounded-md border border-border bg-surface px-3 py-2">
                {ex.example ? <div className="font-mono text-xs text-fg">{ex.example}</div> : null}
                {ex.description ? <div className="mt-1 text-xs text-muted">{ex.description}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {keysTop.length > 0 || keysMore.length > 0 ? (
        <div className="mt-5">
          <div className="text-sm font-semibold">{t('filters.help.keys')}</div>

          {keysTop.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded-md border border-border">
              <ul className="divide-y divide-border">
                {keysTop.map((k) => {
                  const content = (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-fg">{k.key}:</div>
                        <div className="mt-0.5 text-xs text-muted">{k.description}</div>
                      </div>
                      {k.example ? (
                        <div className="shrink-0 font-mono text-xs text-faint">{k.example}</div>
                      ) : null}
                    </div>
                  );

                  const testId = props.keyRowTestIdPrefix ? `${props.keyRowTestIdPrefix}.${k.key}` : undefined;

                  return (
                    <li key={k.key}>
                      {props.onInsertKey ? (
                        <button
                          type="button"
                          data-testid={testId}
                          className={clsx('w-full px-3 py-2 text-left hover:bg-surface-2')}
                          onClick={() => props.onInsertKey?.(k.key)}
                        >
                          {content}
                        </button>
                      ) : (
                        <div data-testid={testId} className="px-3 py-2">
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {keysMore.length > 0 ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-link hover:underline">{t('filters.help.more')}</summary>
              <div className="mt-2 overflow-hidden rounded-md border border-border">
                <ul className="divide-y divide-border">
                  {keysMore.map((k) => {
                    const testId = props.keyRowTestIdPrefix ? `${props.keyRowTestIdPrefix}.${k.key}` : undefined;

                    return (
                      <li key={k.key}>
                        {props.onInsertKey ? (
                          <button
                            type="button"
                            data-testid={testId}
                            className={clsx('w-full px-3 py-2 text-left hover:bg-surface-2')}
                            onClick={() => props.onInsertKey?.(k.key)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-mono text-xs text-fg">{k.key}:</div>
                                <div className="mt-0.5 text-xs text-muted">{k.description}</div>
                              </div>
                              {k.example ? (
                                <div className="shrink-0 font-mono text-xs text-faint">{k.example}</div>
                              ) : null}
                            </div>
                          </button>
                        ) : (
                          <div data-testid={testId} className="px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-mono text-xs text-fg">{k.key}:</div>
                                <div className="mt-0.5 text-xs text-muted">{k.description}</div>
                              </div>
                              {k.example ? (
                                <div className="shrink-0 font-mono text-xs text-faint">{k.example}</div>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {(props.inference ?? props.inferences) && (props.inference ?? props.inferences)?.length ? (
        <div className="mt-5">
          <div className="text-sm font-semibold">{t('filters.help.how_it_works')}</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted">
            {(props.inference ?? props.inferences ?? []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {props.footnote ? <div className="mt-5 text-xs text-faint">{props.footnote}</div> : null}

      {props.actions || showClose ? (
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          {props.actions?.map((a) => (
            <Button key={a.label} variant={a.variant ?? 'secondary'} size="sm" onClick={a.onClick}>
              {a.label}
            </Button>
          ))}

          {showClose ? (
            <Button variant="primary" size="sm" onClick={() => props.onClose?.()}>
              {closeLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SmartInputHelp(props: {
  open: boolean;
  onClose: () => void;

  title: string;
  intro?: string;

  examples?: SmartInputHelpExampleRow[];
  topKeys?: SmartInputHelpKeyRow[];
  moreKeys?: SmartInputHelpKeyRow[];
  /** Backward-compatible alias used by older pages. */
  keys?: SmartInputHelpKeyRow[];
  /** Backward-compatible alias used by older pages. */
  items?: SmartInputHelpKeyRow[];
  inference?: string[];
  /** Backward-compatible alias used by older pages. */
  inferences?: string[];

  /** Called when user clicks a key row. Should insert `key:` into the input. */
  onInsertKey?: (key: string) => void;

  actions?: SmartInputHelpAction[];
  /** Backward-compatible footnote text used by older pages. */
  footnote?: string;

  /** Optional test ids for E2E / integration tests */
  testId?: string;
  keyRowTestIdPrefix?: string;
}) {
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.title} size="lg" testId={props.testId}>
      <SmartInputHelpContent
        intro={props.intro}
        examples={props.examples}
        topKeys={props.topKeys ?? props.keys ?? props.items}
        moreKeys={props.moreKeys}
        inference={props.inference ?? props.inferences}
        onInsertKey={props.onInsertKey}
        actions={props.actions}
        footnote={props.footnote}
        onClose={props.onClose}
        keyRowTestIdPrefix={props.keyRowTestIdPrefix}
        // Keep the default close label for modal help.
      />
    </Modal>
  );
}
