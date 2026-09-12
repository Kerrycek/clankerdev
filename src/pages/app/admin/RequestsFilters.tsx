import React, { useMemo } from 'react';
import { CheckSquare, SlidersHorizontal, X } from 'lucide-react';

import { useI18n } from '../../../app/i18n';
import { requestStateBadgeVariant, requestStateLabelKey } from '../../../lib/requestsBadges';
import { tableVariantFromBadgeVariant } from '../../../lib/variantMap';

import { FilterBar } from '../../../components/layout/FilterBar';
import { Button } from '../../../components/ui/Button';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Drawer } from '../../../components/ui/Drawer';
import { FilterChip } from '../../../components/ui/FilterChip';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import type { ToneVariant } from '../../../components/ui/tone';

import {
  ALL_ADMIN_REQUEST_STATES,
  DEFAULT_ADMIN_REQUEST_STATE,
  defaultStateOptions,
  safeNumber,
  type RequestTypeFilter,
} from './RequestsModel';

export function RequestsFilters(props: {
  type: RequestTypeFilter;
  state: string;
  userId: string;
  adminId: string;
  apiIp: string;
  clientIp: string;
  clientPtr: string;
  smart: string;
  smartSuggestions: SmartFilterSuggestion[];
  smartBusy: boolean;
  advancedOpen: boolean;
  filtersActive: boolean;
  shareUrl: string;
  selectionMode: boolean;
  canSelect: boolean;
  smartInputRef: React.RefObject<HTMLInputElement | null>;
  setType: (value: RequestTypeFilter) => void;
  setState: (value: string) => void;
  setUserId: (value: string) => void;
  setAdminId: (value: string) => void;
  setApiIp: (value: string) => void;
  setClientIp: (value: string) => void;
  setClientPtr: (value: string) => void;
  setSmart: (value: string) => void;
  setAdvancedOpen: (value: boolean) => void;
  setSelectionMode: (value: boolean) => void;
  applySmartText: (value: string) => void | Promise<void>;
  clearFilters: () => void;
}) {
  const { t } = useI18n();
  const stateTrim = props.state.trim() || DEFAULT_ADMIN_REQUEST_STATE;
  const userIdNum = safeNumber(props.userId);
  const adminIdNum = safeNumber(props.adminId);

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];

    if (![DEFAULT_ADMIN_REQUEST_STATE, 'pending_correction', ALL_ADMIN_REQUEST_STATES].includes(stateTrim)) {
      const tone = (tableVariantFromBadgeVariant(requestStateBadgeVariant(stateTrim)) ?? 'neutral') as ToneVariant;
      chips.push(
        <FilterChip
          key="state"
          label={t(requestStateLabelKey(stateTrim))}
          tone={tone}
          onRemove={() => props.setState(DEFAULT_ADMIN_REQUEST_STATE)}
          testId="admin.requests.chip.state"
        />,
      );
    }

    if (userIdNum !== undefined) {
      chips.push(
        <FilterChip
          key="user"
          label={`${t('requests.list.filter.user.label')}: #${userIdNum}`}
          onRemove={() => props.setUserId('')}
          testId="admin.requests.chip.user"
        />,
      );
    }

    if (adminIdNum !== undefined) {
      chips.push(
        <FilterChip
          key="admin"
          label={`${t('requests.list.filter.admin.label')}: #${adminIdNum}`}
          onRemove={() => props.setAdminId('')}
          testId="admin.requests.chip.admin"
        />,
      );
    }

    if (props.apiIp.trim()) {
      chips.push(
        <FilterChip
          key="api_ip"
          label={`${t('requests.list.filter.api_ip.label')}: ${props.apiIp.trim()}`}
          onRemove={() => props.setApiIp('')}
          testId="admin.requests.chip.api_ip"
        />,
      );
    }

    if (props.clientIp.trim()) {
      chips.push(
        <FilterChip
          key="client_ip"
          label={`${t('requests.list.filter.client_ip.label')}: ${props.clientIp.trim()}`}
          onRemove={() => props.setClientIp('')}
          testId="admin.requests.chip.client_ip"
        />,
      );
    }

    if (props.clientPtr.trim()) {
      chips.push(
        <FilterChip
          key="client_ptr"
          label={`${t('requests.list.filter.client_ptr.label')}: ${props.clientPtr.trim()}`}
          onRemove={() => props.setClientPtr('')}
          testId="admin.requests.chip.client_ptr"
        />,
      );
    }

    return chips;
  }, [adminIdNum, props, stateTrim, t, userIdNum]);

  const stateSegments = [
    { value: DEFAULT_ADMIN_REQUEST_STATE, label: t('requests.list.segment.review'), testId: 'admin.requests.quick.awaiting' },
    { value: 'pending_correction', label: t('requests.list.segment.correction'), testId: 'admin.requests.quick.pending_correction' },
    { value: ALL_ADMIN_REQUEST_STATES, label: t('requests.list.segment.all'), testId: 'admin.requests.quick.all' },
  ];
  const typeSegments: Array<{ value: RequestTypeFilter; label: string; testId: string }> = [
    { value: 'all', label: t('requests.list.type.all'), testId: 'admin.requests.type.all' },
    { value: 'registration', label: t('requests.list.type.registration'), testId: 'admin.requests.type.registration' },
    { value: 'change', label: t('requests.list.type.change'), testId: 'admin.requests.type.change' },
  ];

  return (
    <div className="relative space-y-3">
      <FilterBar testId="admin.requests.filters">
        <div className="w-full sm:max-w-xl">
          <SmartFilterInput
            ref={props.smartInputRef}
            value={props.smart}
            onChange={props.setSmart}
            placeholder={t('requests.list.search.placeholder')}
            ariaLabel={t('requests.list.search.aria')}
            testId="admin.requests.smart_filter.input"
            suggestions={props.smartSuggestions}
            disabled={props.smartBusy}
            suffix={props.smartBusy ? (
              <span className="px-2 text-xs text-muted" aria-live="polite">{t('common.loading')}</span>
            ) : undefined}
            onSubmit={() => void props.applySmartText(props.smart)}
          />
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => props.setAdvancedOpen(!props.advancedOpen)}
          aria-label={t('filters.advanced.open')}
          aria-expanded={props.advancedOpen}
          title={t('filters.advanced.open')}
          testId="admin.requests.advanced.toggle"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="ml-2">{t('filters.advanced.label')}</span>
        </Button>

        {props.canSelect ? (
          <Button
            variant={props.selectionMode ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => props.setSelectionMode(!props.selectionMode)}
            aria-pressed={props.selectionMode}
            testId="admin.requests.bulk.selection_mode"
          >
            {props.selectionMode ? <X className="h-4 w-4" aria-hidden /> : <CheckSquare className="h-4 w-4" aria-hidden />}
            <span className="ml-2">
              {props.selectionMode ? t('requests.bulk.selection_done') : t('requests.bulk.selection_start')}
            </span>
          </Button>
        ) : null}
      </FilterBar>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div
          className="inline-flex w-full overflow-x-auto rounded-lg border border-border bg-surface-2 p-1 sm:w-fit"
          role="group"
          aria-label={t('requests.list.filter.state.aria')}
          data-testid="admin.requests.state_segments"
        >
          {stateSegments.map((segment) => (
            <Button
              key={segment.value}
              variant={stateTrim === segment.value ? 'primary' : 'ghost'}
              size="sm"
              className="whitespace-nowrap"
              onClick={() => props.setState(segment.value)}
              aria-pressed={stateTrim === segment.value}
              testId={segment.testId}
            >
              {segment.label}
            </Button>
          ))}
        </div>

        <div
          className="inline-flex w-full overflow-x-auto rounded-lg border border-border bg-surface-2 p-1 sm:w-fit"
          role="group"
          aria-label={t('requests.list.filter.type.aria')}
          data-testid="admin.requests.type_segments"
        >
          {typeSegments.map((segment) => (
            <Button
              key={segment.value}
              variant={props.type === segment.value ? 'primary' : 'ghost'}
              size="sm"
              className="whitespace-nowrap"
              onClick={() => props.setType(segment.value)}
              aria-pressed={props.type === segment.value}
              testId={segment.testId}
            >
              {segment.label}
            </Button>
          ))}
        </div>

        {props.filtersActive ? (
          <Button variant="ghost" size="sm" onClick={props.clearFilters}>
            {t('common.clear_filters')}
          </Button>
        ) : null}
      </div>

      {activeFilterChips.length > 0 ? (
        <div className="flex flex-wrap gap-1" data-testid="admin.requests.active_filters">
          {activeFilterChips}
        </div>
      ) : null}

      <Drawer
        open={props.advancedOpen}
        onClose={() => props.setAdvancedOpen(false)}
        title={t('filters.advanced.title')}
        width="lg"
        testId="admin.requests.advanced_filters"
        closeTestId="admin.requests.advanced.close"
        footer={(
          <div className="flex flex-wrap justify-between gap-2">
            <CopyButton
              size="sm"
              variant="secondary"
              label={t('common.copy_link')}
              text={props.shareUrl}
              testId="admin.requests.copy_link"
            />
            <Button variant="secondary" size="sm" onClick={props.clearFilters}>
              {t('common.clear_filters')}
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="text-sm text-muted">{t('requests.list.advanced.description')}</div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              value={props.state}
              onChange={(event) => props.setState(event.target.value)}
              label={t('requests.list.filter.state.label')}
            >
              {defaultStateOptions().filter(Boolean).map((value) => (
                <option key={value} value={value}>{t(requestStateLabelKey(value))}</option>
              ))}
              <option value={ALL_ADMIN_REQUEST_STATES}>{t('requests.list.filter.state.all')}</option>
            </Select>

            <UserLookupInput
              value={props.userId}
              onChange={props.setUserId}
              placeholder={t('requests.list.filter.user.placeholder')}
              label={t('requests.list.filter.user.label')}
              testId="admin.requests.filter.user.lookup"
              loadingLabel={t('common.loading')}
              noResultsLabel={t('palette.empty.no_results')}
            />

            <UserLookupInput
              value={props.adminId}
              onChange={props.setAdminId}
              placeholder={t('requests.list.filter.admin.placeholder')}
              label={t('requests.list.filter.admin.label')}
              testId="admin.requests.filter.admin.lookup"
              loadingLabel={t('common.loading')}
              noResultsLabel={t('palette.empty.no_results')}
            />

            <Input
              value={props.apiIp}
              onChange={(event) => props.setApiIp(event.target.value)}
              placeholder={t('requests.list.filter.api_ip.placeholder')}
              label={t('requests.list.filter.api_ip.label')}
              testId="admin.requests.filter.api_ip"
            />

            <Input
              value={props.clientIp}
              onChange={(event) => props.setClientIp(event.target.value)}
              placeholder={t('requests.list.filter.client_ip.placeholder')}
              label={t('requests.list.filter.client_ip.label')}
              testId="admin.requests.filter.client_ip"
            />

            <Input
              value={props.clientPtr}
              onChange={(event) => props.setClientPtr(event.target.value)}
              placeholder={t('requests.list.filter.client_ptr.placeholder')}
              label={t('requests.list.filter.client_ptr.label')}
              testId="admin.requests.filter.client_ptr"
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
