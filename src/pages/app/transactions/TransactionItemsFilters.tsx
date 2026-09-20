import React, { type MutableRefObject, useId } from 'react';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { FilterBar } from '../../../components/layout/FilterBar';
import { Button } from '../../../components/ui/Button';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';
import type { DoneValue, TransactionItemsTranslator } from './transactionItemSemantics';

interface TransactionItemsFiltersProps {
  t: TransactionItemsTranslator;
  smartInputRef: MutableRefObject<HTMLInputElement | null>;
  smart: string;
  smartNeedle: string;
  smartErrorsCount: number;
  onSmartChange: (value: string) => void;
  onSmartSubmit: () => void;
  smartSuggestions: SmartFilterSuggestion[];
  activeFilterChips: React.ReactNode[];
  filtersActive: boolean;
  helpOpen: boolean;
  onHelpOpen: () => void;
  onHelpClose: () => void;
  advancedOpen: boolean;
  onAdvancedOpen: () => void;
  onAdvancedClose: () => void;
  clearFilters: () => void;
  chainIdText: string;
  setChainIdText: (value: string) => void;
  nodeIdText: string;
  setNodeIdText: (value: string) => void;
  typeText: string;
  setTypeText: (value: string) => void;
  done: DoneValue | '';
  setDoneValue: (value: DoneValue | '') => void;
  success: '' | 0 | 1;
  setSuccessValue: (value: '' | 0 | 1) => void;
}

export function TransactionItemsFilters({
  t,
  smartInputRef,
  smart,
  smartNeedle,
  smartErrorsCount,
  onSmartChange,
  onSmartSubmit,
  smartSuggestions,
  activeFilterChips,
  filtersActive,
  helpOpen,
  onHelpOpen,
  onHelpClose,
  advancedOpen,
  onAdvancedOpen,
  onAdvancedClose,
  clearFilters,
  chainIdText,
  setChainIdText,
  nodeIdText,
  setNodeIdText,
  typeText,
  setTypeText,
  done,
  setDoneValue,
  success,
  setSuccessValue,
}: TransactionItemsFiltersProps) {
  const chainInputId = useId();
  const nodeInputId = useId();
  const typeInputId = useId();
  const doneSelectId = useId();
  const successSelectId = useId();

  return (
    <>
      <FilterBar testId="transactions.items.list.filters">
        <div className="w-full sm:max-w-xl">
          <SmartFilterInput
            ref={smartInputRef}
            value={smart}
            onChange={onSmartChange}
            onSubmit={onSmartSubmit}
            placeholder={t('transactions.items.search.placeholder')}
            ariaLabel={t('transactions.items.search.placeholder')}
            testId="transactions.items.smart_filter.input"
            className="[&_input]:h-11 sm:[&_input]:h-9"
            suggestions={smartSuggestions}
            suffix={
              <Button
                variant="ghost"
                size="sm"
                className="h-11 w-11 px-0 sm:h-8 sm:w-8"
                onClick={onHelpOpen}
                ariaLabel={t('filters.help.open')}
                title={t('filters.help.open')}
                testId="transactions.items.smart_filter.help"
              >
                <CircleHelp className="h-4 w-4" aria-hidden />
              </Button>
            }
          />

          {activeFilterChips.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1" data-testid="transactions.items.active_filters">
              {activeFilterChips}
            </div>
          ) : null}
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="h-11 min-w-11 sm:h-8 sm:min-w-0"
          onClick={onAdvancedOpen}
          aria-label={t('filters.advanced.open')}
          title={t('filters.advanced.open')}
          testId="transactions.items.advanced.open"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="ml-2 hidden sm:inline">{t('filters.advanced.label')}</span>
        </Button>

        <CopyButton
          text={typeof window !== 'undefined' ? window.location.href : ''}
          label={t('common.copy_link')}
          className="h-11 sm:h-8"
          testId="transactions.items.copy_link"
        />

        {filtersActive || smartErrorsCount > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            className="h-11 sm:h-8"
            onClick={clearFilters}
            testId="transactions.items.clear_filters"
          >
            {t('common.clear_filters')}
          </Button>
        ) : null}
      </FilterBar>

      <SmartInputHelp
        open={helpOpen}
        onClose={() => {
          onHelpClose();
          if (smartNeedle === '?') onSmartChange('');
        }}
        title={t('filters.help.title')}
        intro={t('transactions.items.smart_help.intro')}
        examples={[
          { example: '?', description: t('transactions.items.smart_help.examples.help') },
          { example: '123', description: t('transactions.items.smart_help.examples.open_id') },
          { example: 'chain:123', description: t('transactions.items.smart_help.examples.chain') },
          { example: 'done:waiting', description: t('transactions.items.smart_help.examples.done') },
          { example: 'success:0', description: t('transactions.items.smart_help.examples.success') },
        ]}
        topKeys={[
          { key: 'id', description: t('transactions.items.smart_help.keys.id'), example: 'id:123' },
          { key: 'chain', description: t('transactions.items.smart_help.keys.chain'), example: 'chain:123' },
          { key: 'node', description: t('transactions.items.smart_help.keys.node'), example: 'node:5' },
          { key: 'type', description: t('transactions.items.smart_help.keys.type'), example: 'type:2' },
        ]}
        moreKeys={[
          { key: 'done', description: t('transactions.items.smart_help.keys.done'), example: 'done:done' },
          { key: 'success', description: t('transactions.items.smart_help.keys.success'), example: 'success:1' },
        ]}
        inference={[
          t('transactions.items.smart_help.inference.enter_applies'),
          t('transactions.items.smart_help.inference.number_opens'),
          t('transactions.items.smart_help.inference.key_value'),
        ]}
        onInsertKey={(key) => {
          onHelpClose();
          onSmartChange(`${key}:`);
          window.requestAnimationFrame(() => smartInputRef.current?.focus());
        }}
        actions={[
          {
            label: t('filters.help.open_advanced'),
            onClick: () => {
              onHelpClose();
              onAdvancedOpen();
            },
          },
        ]}
        testId="transactions.items.smart_filter.help_modal"
        keyRowTestIdPrefix="transactions.items.smart_filter.help.key"
      />

      <Drawer
        open={advancedOpen}
        onClose={onAdvancedClose}
        title={t('filters.advanced.title')}
        width="lg"
        testId="transactions.items.advanced.drawer"
        footer={
          <div className="flex items-center justify-end gap-2">
            {filtersActive ? (
              <Button
                variant="secondary"
                size="sm"
                className="h-11 sm:h-8"
                onClick={clearFilters}
                testId="transactions.items.advanced.clear"
              >
                {t('common.clear_filters')}
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              className="h-11 sm:h-8"
              onClick={onAdvancedClose}
              testId="transactions.items.advanced.footer_done"
            >
              {t('common.done')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" htmlFor={chainInputId}>
                {t('transactions.items.advanced.chain.label')}
              </label>
              <div className="mt-1">
                <Input
                  inputId={chainInputId}
                  inputMode="numeric"
                  value={chainIdText}
                  onChange={(e) => setChainIdText(e.target.value)}
                  placeholder="123"
                  className="h-11 sm:h-9"
                  testId="transactions.items.advanced.chain"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor={nodeInputId}>
                {t('transactions.items.advanced.node.label')}
              </label>
              <div className="mt-1">
                <Input
                  inputId={nodeInputId}
                  inputMode="numeric"
                  value={nodeIdText}
                  onChange={(e) => setNodeIdText(e.target.value)}
                  placeholder="5"
                  className="h-11 sm:h-9"
                  testId="transactions.items.advanced.node"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" htmlFor={typeInputId}>
                {t('transactions.items.advanced.type.label')}
              </label>
              <div className="mt-1">
                <Input
                  inputId={typeInputId}
                  inputMode="numeric"
                  value={typeText}
                  onChange={(e) => setTypeText(e.target.value)}
                  placeholder="2"
                  className="h-11 sm:h-9"
                  testId="transactions.items.advanced.type"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor={doneSelectId}>
                {t('transactions.items.advanced.done.label')}
              </label>
              <div className="mt-1">
                <Select
                  selectId={doneSelectId}
                  value={done}
                  onChange={(e) => setDoneValue(e.target.value as DoneValue | '')}
                  className="h-11 sm:h-9"
                  testId="transactions.items.advanced.done"
                >
                  <option value="">{t('common.all')}</option>
                  <option value="waiting">{t('task_state.waiting')}</option>
                  <option value="staged">{t('task_state.staged')}</option>
                  <option value="done">{t('common.done')}</option>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" htmlFor={successSelectId}>
                {t('transactions.items.advanced.success.label')}
              </label>
              <div className="mt-1">
                <Select
                  selectId={successSelectId}
                  value={success === '' ? '' : String(success)}
                  onChange={(e) => setSuccessValue(e.target.value === '' ? '' : e.target.value === '1' ? 1 : 0)}
                  className="h-11 sm:h-9"
                  testId="transactions.items.advanced.success"
                >
                  <option value="">{t('common.all')}</option>
                  <option value="1">1</option>
                  <option value="0">0</option>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
