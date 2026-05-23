import React, { type MutableRefObject } from 'react';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { FilterBar } from '../../../components/layout/FilterBar';
import { Button } from '../../../components/ui/Button';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import type { DoneValue, TransactionItemsTranslator } from './transactionItemSemantics';

interface TransactionItemsFiltersProps {
  t: TransactionItemsTranslator;
  mode: 'app' | 'admin';
  smartInputRef: MutableRefObject<HTMLInputElement | null>;
  smart: string;
  smartNeedle: string;
  smartErrorsCount: number;
  onSmartChange: (value: string) => void;
  onSmartSubmit: () => void;
  smartSuggestions: SmartFilterSuggestion[];
  activeFilterChips: React.ReactNode[];
  queryId?: number;
  filtersActive: boolean;
  helpOpen: boolean;
  onHelpOpen: () => void;
  onHelpClose: () => void;
  advancedOpen: boolean;
  onAdvancedOpen: () => void;
  onAdvancedClose: () => void;
  clearFilters: () => void;
  qText: string;
  setQueryText: (value: string) => void;
  chainIdText: string;
  setChainIdText: (value: string) => void;
  nodeIdText: string;
  setNodeIdText: (value: string) => void;
  vpsIdText: string;
  setVpsIdText: (value: string) => void;
  typeText: string;
  setTypeText: (value: string) => void;
  done: DoneValue | '';
  setDoneValue: (value: DoneValue | '') => void;
  success: '' | 0 | 1;
  setSuccessValue: (value: '' | 0 | 1) => void;
  userIdText: string;
  setUserIdText: (value: string) => void;
}

export function TransactionItemsFilters({
  t,
  mode,
  smartInputRef,
  smart,
  smartNeedle,
  smartErrorsCount,
  onSmartChange,
  onSmartSubmit,
  smartSuggestions,
  activeFilterChips,
  queryId,
  filtersActive,
  helpOpen,
  onHelpOpen,
  onHelpClose,
  advancedOpen,
  onAdvancedOpen,
  onAdvancedClose,
  clearFilters,
  qText,
  setQueryText,
  chainIdText,
  setChainIdText,
  nodeIdText,
  setNodeIdText,
  vpsIdText,
  setVpsIdText,
  typeText,
  setTypeText,
  done,
  setDoneValue,
  success,
  setSuccessValue,
  userIdText,
  setUserIdText,
}: TransactionItemsFiltersProps) {
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
            suggestions={smartSuggestions}
            suffix={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 px-0"
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
          {queryId ? <div className="mt-1 text-xs text-muted">{t('transactions.search.id_lookup')}</div> : null}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onAdvancedOpen}
          aria-label={t('filters.advanced.open')}
          title={t('filters.advanced.open')}
          testId="transactions.items.advanced.open"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="ml-2 hidden sm:inline">{t('filters.advanced.label')}</span>
        </Button>

        <CopyButton text={typeof window !== 'undefined' ? window.location.href : ''} label={t('common.copy_link')} testId="transactions.items.copy_link" />

        {filtersActive || smartErrorsCount > 0 ? (
          <Button variant="secondary" size="sm" onClick={clearFilters} testId="transactions.items.clear_filters">
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
          { example: 'backup', description: t('transactions.items.smart_help.examples.search') },
          { example: 'chain:123', description: t('transactions.items.smart_help.examples.chain') },
          { example: 'done:waiting', description: t('transactions.items.smart_help.examples.done') },
          { example: 'success:0', description: t('transactions.items.smart_help.examples.success') },
        ]}
        topKeys={[
          { key: 'q', description: t('transactions.items.smart_help.keys.q'), example: 'q:backup' },
          { key: 'id', description: t('transactions.items.smart_help.keys.id'), example: 'id:123' },
          { key: 'chain', description: t('transactions.items.smart_help.keys.chain'), example: 'chain:123' },
          { key: 'vps', description: t('transactions.items.smart_help.keys.vps'), example: 'vps:100' },
          { key: 'node', description: t('transactions.items.smart_help.keys.node'), example: 'node:5' },
        ]}
        moreKeys={[
          { key: 'type', description: t('transactions.items.smart_help.keys.type'), example: 'type:2' },
          { key: 'done', description: t('transactions.items.smart_help.keys.done'), example: 'done:done' },
          { key: 'success', description: t('transactions.items.smart_help.keys.success'), example: 'success:1' },
          ...(mode === 'admin'
            ? [{ key: 'user', description: t('transactions.items.smart_help.keys.user'), example: 'user:42' }]
            : []),
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
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                {t('common.clear_filters')}
              </Button>
            ) : null}
            <Button variant="primary" size="sm" onClick={onAdvancedClose}>
              {t('common.done')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium">{t('transactions.items.advanced.q.label')}</div>
            <div className="mt-1">
              <Input value={qText} onChange={(e) => setQueryText(e.target.value)} placeholder={t('transactions.items.search.placeholder')} testId="transactions.items.advanced.q" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium">{t('transactions.items.advanced.chain.label')}</div>
              <div className="mt-1">
                <Input value={chainIdText} onChange={(e) => setChainIdText(e.target.value)} placeholder="123" testId="transactions.items.advanced.chain" />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">{t('transactions.items.advanced.node.label')}</div>
              <div className="mt-1">
                <Input value={nodeIdText} onChange={(e) => setNodeIdText(e.target.value)} placeholder="5" testId="transactions.items.advanced.node" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium">{t('transactions.items.advanced.vps.label')}</div>
              <div className="mt-1">
                <Input value={vpsIdText} onChange={(e) => setVpsIdText(e.target.value)} placeholder="100" testId="transactions.items.advanced.vps" />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">{t('transactions.items.advanced.type.label')}</div>
              <div className="mt-1">
                <Input value={typeText} onChange={(e) => setTypeText(e.target.value)} placeholder="2" testId="transactions.items.advanced.type" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium">{t('transactions.items.advanced.done.label')}</div>
              <div className="mt-1">
                <Select value={done} onChange={(e) => setDoneValue(e.target.value as DoneValue | '')} testId="transactions.items.advanced.done">
                  <option value="">{t('common.all')}</option>
                  <option value="waiting">{t('task_state.waiting')}</option>
                  <option value="staged">{t('task_state.staged')}</option>
                  <option value="done">{t('common.done')}</option>
                </Select>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">{t('transactions.items.advanced.success.label')}</div>
              <div className="mt-1">
                <Select
                  value={success === '' ? '' : String(success)}
                  onChange={(e) => setSuccessValue(e.target.value === '' ? '' : e.target.value === '1' ? 1 : 0)}
                  testId="transactions.items.advanced.success"
                >
                  <option value="">{t('common.all')}</option>
                  <option value="1">1</option>
                  <option value="0">0</option>
                </Select>
              </div>
            </div>
          </div>

          {mode === 'admin' ? (
            <div>
              <div className="text-sm font-medium">{t('transactions.items.advanced.user.label')}</div>
              <div className="mt-1">
                <UserLookupInput value={userIdText} onChange={setUserIdText} allowRawId testId="transactions.items.advanced.user" />
              </div>
            </div>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}
