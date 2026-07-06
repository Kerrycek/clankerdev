import React, { useMemo, useRef, useState } from 'react';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { useI18n } from '../../app/i18n';
import { parseNumericToken } from '../../lib/smartFilter';

import { FilterBar } from '../layout/FilterBar';
import { Button } from '../ui/Button';
import { CopyButton } from '../ui/CopyButton';
import { Drawer } from '../ui/Drawer';
import { FilterChip } from '../ui/FilterChip';
import { Input } from '../ui/Input';
import { Select, type SelectOption } from '../ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../ui/SmartFilterInput';
import { SmartInputHelp } from '../ui/SmartInputHelp';

import { userDataFormatLabelKey } from './UserDataTemplatesModel';

export interface UserDataFilterValues {
  q?: string;
  format?: string;
}

export function UserDataTemplatesFilters(props: {
  prefix: string;
  qRaw: string;
  qTrim: string;
  formatFilter: string;
  smart: string;
  smartErrors: string[];
  filtersActive: boolean;
  shareUrl: string;
  formatOptions: SelectOption[];
  setSmart: React.Dispatch<React.SetStateAction<string>>;
  onApplySmart: (raw?: string) => void;
  onRemoveSmartError: (index: number) => void;
  onSetFilters: (nextVals: UserDataFilterValues) => void;
  onClearFilters: () => void;
  onCreate: () => void;
}) {
  const { t } = useI18n();
  const smartInputRef = useRef<HTMLInputElement | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function focusSmartInput() {
    window.requestAnimationFrame(() => smartInputRef.current?.focus());
  }

  function insertSmartKey(key: string) {
    props.setSmart((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${key}:` : `${key}:`;
    });
    focusSmartInput();
  }

  function applySmart(rawInput?: string) {
    const raw = String(rawInput ?? props.smart).trim();
    if (raw === '?') {
      setHelpOpen(true);
      return;
    }
    props.onApplySmart(rawInput);
  }

  const smartSuggestions = useMemo<SmartFilterSuggestion[]>(() => {
    const needle = props.smart.trim();
    if (!needle) return [];
    if (needle === '?') {
      return [
        {
          id: 'help',
          primary: t('filters.help.title'),
          secondary: t('filters.help.suggestion.secondary'),
          onPick: () => {
            setHelpOpen(true);
            props.setSmart('');
          },
        },
      ];
    }

    const n = parseNumericToken(needle);
    if (n !== null) {
      return [
        {
          id: `id-${n}`,
          primary: t('user_data.smart.suggestion.search_id', { id: n }),
          secondary: t('user_data.smart.suggestion.search_hint'),
          onPick: () => applySmart(String(n)),
        },
      ];
    }

    return [
      {
        id: 'search',
        primary: t('user_data.smart.suggestion.search', { value: needle }),
        secondary: t('user_data.smart.suggestion.search_hint'),
        onPick: () => applySmart(needle),
      },
    ];
  }, [props.smart, props.setSmart, t]);

  return (
    <>
      <FilterBar testId={`${props.prefix}.filters`}>
        <div className="min-w-0 flex-1">
          <SmartFilterInput
            ref={smartInputRef}
            testId={`${props.prefix}.filters.q`}
            ariaLabel={t('user_data.filters.search.placeholder')}
            value={props.smart}
            onChange={props.setSmart}
            onSubmit={() => applySmart()}
            suggestions={smartSuggestions}
            placeholder={t('user_data.smart.placeholder')}
            suffix={
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
                onClick={() => setHelpOpen(true)}
                aria-label={t('filters.help.open')}
                title={t('filters.help.open')}
                data-testid={`${props.prefix}.smart.help_button`}
              >
                <CircleHelp className="h-4 w-4" />
              </button>
            }
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setAdvancedOpen(true)} testId={`${props.prefix}.filters.advanced`}>
            <SlidersHorizontal className="mr-1 h-4 w-4" />
            {t('filters.advanced.label')}
          </Button>
          <CopyButton text={props.shareUrl} label={t('common.copy_link')} testId={`${props.prefix}.filters.copy_link`} />
          {props.filtersActive ? (
            <Button type="button" size="sm" variant="ghost" onClick={props.onClearFilters} testId={`${props.prefix}.filters.clear`}>
              {t('common.clear_filters')}
            </Button>
          ) : null}
          <Button variant="primary" onClick={props.onCreate} testId={`${props.prefix}.create`}>
            {t('user_data.action.create')}
          </Button>
        </div>
      </FilterBar>

      {props.filtersActive ? (
        <div className="flex flex-wrap gap-2" data-testid={`${props.prefix}.filters.chips`}>
          {props.qTrim ? (
            <FilterChip
              label={props.qTrim.startsWith('#') || /^\d+$/.test(props.qTrim) ? `#${props.qTrim.replace(/^#/, '')}` : props.qTrim}
              onRemove={() => props.onSetFilters({ q: '', format: props.formatFilter })}
            />
          ) : null}
          {props.formatFilter ? (
            <FilterChip
              label={`${t('user_data.filters.format')}: ${t(userDataFormatLabelKey(props.formatFilter))}`}
              onRemove={() => props.onSetFilters({ q: props.qTrim, format: '' })}
            />
          ) : null}
          {props.smartErrors.map((err, idx) => (
            <FilterChip key={`${err}-${idx}`} label={err} tone="danger" onRemove={() => props.onRemoveSmartError(idx)} />
          ))}
        </div>
      ) : null}

      <Drawer
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        title={t('filters.advanced.title')}
        width="lg"
        testId={`${props.prefix}.filters.advanced.drawer`}
      >
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-muted">{t('common.search')}</div>
            <div className="mt-1">
              <Input
                value={props.qRaw}
                onChange={(e) => props.onSetFilters({ q: e.target.value, format: props.formatFilter })}
                placeholder={t('user_data.filters.search.placeholder')}
                autoComplete="off"
                testId={`${props.prefix}.filters.q.advanced`}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted">{t('user_data.filters.format')}</div>
            <div className="mt-1">
              <Select
                value={props.formatFilter}
                onChange={(e) => props.onSetFilters({ q: props.qTrim, format: e.target.value })}
                options={props.formatOptions}
                testId={`${props.prefix}.filters.format`}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={props.onClearFilters}>{t('common.clear_filters')}</Button>
            <Button variant="primary" size="sm" onClick={() => setAdvancedOpen(false)}>{t('common.done')}</Button>
          </div>
        </div>
      </Drawer>

      <SmartInputHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t('filters.help.title')}
        intro={t('user_data.smart.help.intro')}
        examples={[
          { example: '?', description: t('user_data.smart.help.examples.help') },
          { example: 'nginx', description: t('user_data.smart.help.examples.search') },
          { example: '123', description: t('user_data.smart.help.examples.id') },
          { example: 'format:script', description: t('user_data.smart.help.examples.format') },
        ]}
        topKeys={[
          { key: 'q', description: t('user_data.smart.help.keys.q'), example: 'q:nginx' },
          { key: 'id', description: t('user_data.smart.help.keys.id'), example: 'id:123' },
          { key: 'format', description: t('user_data.smart.help.keys.format'), example: 'format:script' },
        ]}
        inference={[
          t('user_data.smart.help.inference.enter_applies'),
          t('user_data.smart.help.inference.number_searches'),
          t('user_data.smart.help.inference.key_value'),
        ]}
        onInsertKey={insertSmartKey}
        testId={`${props.prefix}.smart.help`}
      />
    </>
  );
}
