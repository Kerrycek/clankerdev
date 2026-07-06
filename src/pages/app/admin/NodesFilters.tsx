import React from 'react';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { FilterBar } from '../../../components/layout/FilterBar';

import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Drawer } from '../../../components/ui/Drawer';
import { FilterChip } from '../../../components/ui/FilterChip';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';

import { normalizeNodeState, type NodeStateFilter } from './NodesModel';

export type NodesPageTranslator = (key: string, vars?: Record<string, unknown>) => string;

type SetTextParam = (key: string, value: string | undefined) => void;

type NodesFilterChangeHandlers = {
  onSmartChange: (value: string) => void;
  onSmartSubmit: () => void;
  onSetSmartErrors: React.Dispatch<React.SetStateAction<string[]>>;
  onHelpOpenChange: (open: boolean) => void;
  onAdvancedOpenChange: (open: boolean) => void;
  onSetTextParam: SetTextParam;
  onSetIssuesParam: (on: boolean) => void;
  onSetStateParam: (state: NodeStateFilter) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
};

interface NodesFiltersProps extends NodesFilterChangeHandlers {
  t: NodesPageTranslator;
  smart: string;
  smartErrors: string[];
  smartInputRef: React.RefObject<HTMLInputElement | null>;
  smartSuggestions: SmartFilterSuggestion[];
  filtersActive: boolean;
  shareUrl: string;
  helpOpen: boolean;
  advancedOpen: boolean;
  qText: string;
  state: NodeStateFilter;
  issuesOnly: boolean;
  shownCount: number;
  totalCount: number;
}

function NodesActiveFilterChips(props: {
  qText: string;
  state: NodeStateFilter;
  issuesOnly: boolean;
  smartErrors: string[];
  onSetTextParam: SetTextParam;
  onSetStateParam: (state: NodeStateFilter) => void;
  onSetIssuesParam: (on: boolean) => void;
  onSetSmartErrors: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const chips: React.ReactNode[] = [];

  if (props.qText.trim()) {
    chips.push(
      <FilterChip
        key="q"
        label={`q:${props.qText.trim()}`}
        tone="neutral"
        onRemove={() => props.onSetTextParam('q', undefined)}
        testId="admin.nodes.chip.q"
      />
    );
  }

  if (props.state !== 'active') {
    chips.push(
      <FilterChip
        key="state"
        label={`state:${props.state}`}
        tone="neutral"
        onRemove={() => props.onSetStateParam('active')}
        testId="admin.nodes.chip.state"
      />
    );
  }

  if (props.issuesOnly) {
    chips.push(
      <FilterChip
        key="issues"
        label="issues"
        tone="danger"
        onRemove={() => props.onSetIssuesParam(false)}
        testId="admin.nodes.chip.issues"
      />
    );
  }

  props.smartErrors.forEach((error, idx) => {
    chips.push(
      <FilterChip
        key={`err.${idx}`}
        label={error}
        tone="danger"
        onRemove={() => props.onSetSmartErrors((prev) => prev.filter((_, i) => i !== idx))}
        testId={`admin.nodes.chip.error.${idx}`}
      />
    );
  });

  if (chips.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1" data-testid="admin.nodes.active_filters">
      {chips}
    </div>
  );
}

export function NodesFilters({
  t,
  smart,
  smartErrors,
  smartInputRef,
  smartSuggestions,
  filtersActive,
  shareUrl,
  helpOpen,
  advancedOpen,
  qText,
  state,
  issuesOnly,
  shownCount,
  totalCount,
  onSmartChange,
  onSmartSubmit,
  onSetSmartErrors,
  onHelpOpenChange,
  onAdvancedOpenChange,
  onSetTextParam,
  onSetIssuesParam,
  onSetStateParam,
  onClearFilters,
  onRefresh,
}: NodesFiltersProps) {
  return (
    <>
      <FilterBar testId="admin.nodes.list.filters">
        <div className="w-full sm:max-w-xl">
          <SmartFilterInput
            ref={smartInputRef}
            value={smart}
            onChange={(v) => {
              onSmartChange(v);
              if (smartErrors.length) onSetSmartErrors([]);
            }}
            placeholder={t('admin.nodes.search.placeholder')}
            ariaLabel={t('admin.nodes.search.placeholder')}
            testId="admin.nodes.search.input"
            suggestions={smartSuggestions}
            onSubmit={onSmartSubmit}
            suffix={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 px-0"
                onClick={() => onHelpOpenChange(true)}
                aria-label={t('filters.help.open')}
                title={t('filters.help.open')}
              >
                <CircleHelp className="h-4 w-4" aria-hidden />
              </Button>
            }
          />

          <NodesActiveFilterChips
            qText={qText}
            state={state}
            issuesOnly={issuesOnly}
            smartErrors={smartErrors}
            onSetTextParam={onSetTextParam}
            onSetStateParam={onSetStateParam}
            onSetIssuesParam={onSetIssuesParam}
            onSetSmartErrors={onSetSmartErrors}
          />

          <div className="mt-1 text-xs text-faint">
            {t('common.showing_n_of_m', { shown: shownCount, total: totalCount })}
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onAdvancedOpenChange(true)}
          aria-label={t('filters.advanced.open')}
          title={t('filters.advanced.open')}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="ml-2 hidden sm:inline">{t('filters.advanced.label')}</span>
        </Button>

        <Button
          variant={issuesOnly ? 'danger' : 'secondary'}
          size="sm"
          onClick={() => onSetIssuesParam(!issuesOnly)}
          title={t('admin.nodes.filter.issues_only_help')}
          testId="admin.nodes.issues_toggle"
        >
          {t('admin.nodes.filter.issues_only')}
        </Button>

        <Button variant="secondary" size="sm" onClick={onRefresh} testId="admin.nodes.refresh">
          {t('common.refresh')}
        </Button>

        <CopyButton
          size="sm"
          variant="secondary"
          label={t('common.copy_link')}
          text={shareUrl}
          testId="admin.nodes.copy_link"
        />

        {filtersActive ? (
          <Button variant="secondary" size="sm" onClick={onClearFilters} testId="admin.nodes.filter.clear">
            {t('common.clear_filters')}
          </Button>
        ) : null}
      </FilterBar>

      <SmartInputHelp
        open={helpOpen}
        onClose={() => onHelpOpenChange(false)}
        title={t('admin.nodes.smart_help.title')}
        intro={t('admin.nodes.smart_help.intro')}
        examples={[
          { example: '?', description: t('admin.nodes.smart_help.examples.help') },
          { example: '123', description: t('admin.nodes.smart_help.examples.open') },
          { example: 'issues', description: t('admin.nodes.smart_help.examples.issues') },
          { example: 'state:inactive', description: t('admin.nodes.smart_help.examples.state') },
          { example: 'q:node7 state:all', description: t('admin.nodes.smart_help.examples.q_state') },
        ]}
        topKeys={[
          { key: 'q', description: t('admin.nodes.smart_help.keys.q'), example: 'q:node7' },
          { key: 'state', description: t('admin.nodes.smart_help.keys.state'), example: 'state:inactive' },
          { key: 'issues', description: t('admin.nodes.smart_help.keys.issues'), example: 'issues:true' },
          { key: 'id', description: t('admin.nodes.smart_help.keys.id'), example: 'id:123' },
        ]}
        inference={[
          t('admin.nodes.smart_help.inference.enter'),
          t('admin.nodes.smart_help.inference.numeric'),
          t('admin.nodes.smart_help.inference.advanced'),
        ]}
        onInsertKey={(key) => {
          const prefix = `${key}:`;
          onSmartChange(prefix);
          onHelpOpenChange(false);
          window.setTimeout(() => smartInputRef.current?.focus(), 0);
        }}
        actions={[
          {
            label: t('filters.advanced.label'),
            onClick: () => {
              onHelpOpenChange(false);
              onAdvancedOpenChange(true);
            },
            variant: 'secondary',
          },
        ]}
        testId="admin.nodes.smart_help"
        keyRowTestIdPrefix="admin.nodes.smart_help.key"
      />

      <Drawer
        open={advancedOpen}
        onClose={() => onAdvancedOpenChange(false)}
        title={t('filters.advanced.title')}
        width="lg"
        testId="admin.nodes.advanced.drawer"
      >
        <div className="space-y-4">
          <div className="text-sm text-muted">{t('admin.nodes.advanced.hint')}</div>

          <div>
            <div className="text-xs font-medium text-faint">{t('admin.nodes.advanced.q.label')}</div>
            <Input
              value={qText}
              onChange={(e) => onSetTextParam('q', e.target.value)}
              placeholder={t('admin.nodes.search.placeholder')}
              testId="admin.nodes.advanced.q"
            />
          </div>

          <div>
            <div className="text-xs font-medium text-faint">{t('admin.nodes.advanced.state.label')}</div>
            <Select
              value={state}
              onChange={(e) => onSetStateParam(normalizeNodeState(e.target.value))}
              testId="admin.nodes.advanced.state"
              className="w-56"
            >
              <option value="active">{t('admin.nodes.advanced.state.active')}</option>
              <option value="all">{t('admin.nodes.advanced.state.all')}</option>
              <option value="inactive">{t('admin.nodes.advanced.state.inactive')}</option>
            </Select>
          </div>

          <Checkbox
            checked={issuesOnly}
            onChange={(v) => onSetIssuesParam(v)}
            label={t('admin.nodes.advanced.issues.label')}
            description={t('admin.nodes.advanced.issues.hint')}
            testId="admin.nodes.advanced.issues"
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            {filtersActive ? (
              <Button variant="secondary" onClick={onClearFilters} testId="admin.nodes.advanced.clear">
                {t('common.clear_filters')}
              </Button>
            ) : null}

            <Button variant="primary" onClick={() => onAdvancedOpenChange(false)}>
              {t('common.done')}
            </Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
