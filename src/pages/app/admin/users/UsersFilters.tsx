import React from 'react';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { parseBoolParam } from '../../../../lib/parse';

import { FilterBar } from '../../../../components/layout/FilterBar';

import { Button } from '../../../../components/ui/Button';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { Drawer } from '../../../../components/ui/Drawer';
import { FilterChip } from '../../../../components/ui/FilterChip';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../../components/ui/SmartInputHelp';

import { normalizeRole, type RoleFilter } from './UsersModel';
import type { UsersPageTranslator } from './userListSemantics';

type SetTextParam = (key: string, value: string | undefined) => void;
type SetBoolParam = (key: string, value: boolean | undefined) => void;

interface UsersFiltersProps {
  t: UsersPageTranslator;
  smart: string;
  smartNeedle: string;
  smartErrors: string[];
  smartInputRef: React.RefObject<HTMLInputElement | null>;
  smartSuggestions: SmartFilterSuggestion[];
  filtersActive: boolean;
  shareUrl: string;
  helpOpen: boolean;
  advancedOpen: boolean;
  qText: string;
  role: RoleFilter;
  level: number | undefined;
  mailerEnabled: boolean | undefined;
  lockout: boolean | undefined;
  passwordReset: boolean | undefined;
  mfa: boolean | undefined;
  onSmartChange: (value: string) => void;
  onSmartSubmit: () => void;
  onSetSmartErrors: (errors: string[]) => void;
  onHelpOpenChange: (open: boolean) => void;
  onAdvancedOpenChange: (open: boolean) => void;
  onCreateOpen: () => void;
  onClearFilters: () => void;
  onSetTextParam: SetTextParam;
  onSetBoolParam: SetBoolParam;
}

export function UsersFilters({
  t,
  smart,
  smartNeedle,
  smartErrors,
  smartInputRef,
  smartSuggestions,
  filtersActive,
  shareUrl,
  helpOpen,
  advancedOpen,
  qText,
  role,
  level,
  mailerEnabled,
  lockout,
  passwordReset,
  mfa,
  onSmartChange,
  onSmartSubmit,
  onSetSmartErrors,
  onHelpOpenChange,
  onAdvancedOpenChange,
  onCreateOpen,
  onClearFilters,
  onSetTextParam,
  onSetBoolParam,
}: UsersFiltersProps) {
  const activeFilterChips: React.ReactNode[] = [];

  if (qText.trim()) {
    activeFilterChips.push(
      <FilterChip key="q" label={`q:${qText.trim()}`} tone="neutral" onRemove={() => onSetTextParam('q', undefined)} testId="admin.users.chip.q" />
    );
  }

  if (role) {
    activeFilterChips.push(
      <FilterChip key="role" label={`role:${role}`} tone="neutral" onRemove={() => onSetTextParam('role', undefined)} testId="admin.users.chip.role" />
    );
  }

  if (level !== undefined) {
    activeFilterChips.push(
      <FilterChip key="level" label={`level:${level}`} tone="neutral" onRemove={() => onSetTextParam('level', undefined)} testId="admin.users.chip.level" />
    );
  }

  if (mailerEnabled !== undefined) {
    activeFilterChips.push(
      <FilterChip
        key="mailer"
        label={`mailer:${mailerEnabled ? 'on' : 'off'}`}
        tone="neutral"
        onRemove={() => onSetBoolParam('mailer', undefined)}
        testId="admin.users.chip.mailer"
      />
    );
  }

  if (lockout !== undefined) {
    activeFilterChips.push(
      <FilterChip
        key="lockout"
        label={`lockout:${lockout ? 'on' : 'off'}`}
        tone={lockout ? 'danger' : 'neutral'}
        onRemove={() => onSetBoolParam('lockout', undefined)}
        testId="admin.users.chip.lockout"
      />
    );
  }

  if (passwordReset !== undefined) {
    activeFilterChips.push(
      <FilterChip
        key="password_reset"
        label={`password_reset:${passwordReset ? 'on' : 'off'}`}
        tone={passwordReset ? 'warn' : 'neutral'}
        onRemove={() => onSetBoolParam('password_reset', undefined)}
        testId="admin.users.chip.password_reset"
      />
    );
  }

  if (mfa !== undefined) {
    activeFilterChips.push(
      <FilterChip key="mfa" label={`mfa:${mfa ? 'on' : 'off'}`} tone="neutral" onRemove={() => onSetBoolParam('mfa', undefined)} testId="admin.users.chip.mfa" />
    );
  }

  smartErrors.forEach((e, idx) => {
    activeFilterChips.push(
      <FilterChip key={`err.${idx}`} label={e} tone="danger" onRemove={() => onSetSmartErrors([])} testId={`admin.users.chip.error.${idx}`} />
    );
  });

  const roleOptions = [
    { value: '', label: t('common.all') },
    { value: 'admin', label: t('admin.users.role.admin') },
    { value: 'support', label: t('admin.users.role.support') },
    { value: 'user', label: t('admin.users.role.user') },
  ];

  const enabledOptions = [
    { value: '', label: t('common.all') },
    { value: '1', label: t('common.enabled') },
    { value: '0', label: t('common.disabled') },
  ];

  const lockoutOptions = [
    { value: '', label: t('common.all') },
    { value: '1', label: t('admin.users.advanced.lockout.on') },
    { value: '0', label: t('admin.users.advanced.lockout.off') },
  ];

  const passwordResetOptions = [
    { value: '', label: t('common.all') },
    { value: '1', label: t('admin.users.advanced.password_reset.on') },
    { value: '0', label: t('admin.users.advanced.password_reset.off') },
  ];

  return (
    <>
      <FilterBar testId="admin.users.list.filters">
        <div className="w-full sm:max-w-xl">
          <SmartFilterInput
            ref={smartInputRef}
            value={smart}
            onChange={(v) => {
              onSmartChange(v);
              if (smartErrors.length) onSetSmartErrors([]);
            }}
            placeholder={t('admin.users.search.placeholder')}
            ariaLabel={t('admin.users.search.placeholder')}
            testId="admin.users.smart_filter.input"
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

          {activeFilterChips.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1" data-testid="admin.users.active_filters">
              {activeFilterChips}
            </div>
          ) : null}
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

        <Button variant="primary" size="sm" onClick={onCreateOpen} testId="admin.users.create.open">
          {t('admin.users.create.open')}
        </Button>

        <CopyButton size="sm" variant="secondary" label={t('common.copy_link')} text={shareUrl} testId="admin.users.copy_link" />

        {filtersActive ? (
          <Button variant="secondary" size="sm" onClick={onClearFilters} testId="admin.users.filter.clear">
            {t('common.clear_filters')}
          </Button>
        ) : null}
      </FilterBar>

      <SmartInputHelp
        open={helpOpen}
        onClose={() => {
          onHelpOpenChange(false);
          if (smartNeedle === '?') onSmartChange('');
        }}
        title={t('filters.help.title')}
        intro={t('admin.users.smart_help.intro')}
        examples={[
          { example: '?', description: t('admin.users.smart_help.examples.help') },
          { example: '123', description: t('admin.users.smart_help.examples.open_id') },
          { example: 'alice', description: t('admin.users.smart_help.examples.search') },
          { example: 'role:admin', description: t('admin.users.smart_help.examples.role') },
          { example: 'lockout:true', description: t('admin.users.smart_help.examples.lockout') },
          { example: 'password_reset:true', description: t('admin.users.smart_help.examples.password_reset') },
          { example: 'mfa:true', description: t('admin.users.smart_help.examples.mfa') },
          { example: 'mailer:false', description: t('admin.users.smart_help.examples.mailer') },
        ]}
        topKeys={[
          { key: 'role', description: t('admin.users.smart_help.keys.role'), example: 'role:admin' },
          { key: 'level', description: t('admin.users.smart_help.keys.level'), example: 'level:90' },
          { key: 'lockout', description: t('admin.users.smart_help.keys.lockout'), example: 'lockout:true' },
          { key: 'password_reset', description: t('admin.users.smart_help.keys.password_reset'), example: 'password_reset:true' },
        ]}
        moreKeys={[
          { key: 'mfa', description: t('admin.users.smart_help.keys.mfa'), example: 'mfa:true' },
          { key: 'mailer', description: t('admin.users.smart_help.keys.mailer'), example: 'mailer:false' },
          { key: 'q', description: t('admin.users.smart_help.keys.q'), example: 'q:alice' },
          { key: 'id', description: t('admin.users.smart_help.keys.id'), example: 'id:123' },
        ]}
        inference={[
          t('admin.users.smart_help.inference.enter_search'),
          t('admin.users.smart_help.inference.numeric_open'),
          t('admin.users.smart_help.inference.advanced'),
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
        testId="admin.users.smart_help"
        keyRowTestIdPrefix="admin.users.smart_help.key"
      />

      <Drawer open={advancedOpen} onClose={() => onAdvancedOpenChange(false)} title={t('filters.advanced.title')} width="lg" testId="admin.users.advanced.drawer">
        <div className="space-y-4">
          <div className="text-sm text-muted">{t('admin.users.advanced.hint')}</div>

          <div>
            <div className="text-sm font-medium">{t('admin.users.advanced.role')}</div>
            <div className="mt-2">
              <Select
                value={role}
                onChange={(e) => onSetTextParam('role', normalizeRole(e.target.value) || undefined)}
                options={roleOptions}
                testId="admin.users.advanced.role"
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium">{t('admin.users.advanced.level')}</div>
            <div className="mt-2 max-w-xs">
              <Input
                value={level !== undefined ? String(level) : ''}
                onChange={(e) => onSetTextParam('level', e.target.value.trim() ? e.target.value : undefined)}
                placeholder={t('admin.users.advanced.level.placeholder')}
                testId="admin.users.advanced.level"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm font-medium">{t('admin.users.advanced.mailer')}</div>
              <div className="mt-2">
                <Select
                  value={mailerEnabled === undefined ? '' : mailerEnabled ? '1' : '0'}
                  onChange={(e) => onSetBoolParam('mailer', parseBoolParam(e.target.value))}
                  options={enabledOptions}
                  testId="admin.users.advanced.mailer"
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">{t('admin.users.advanced.mfa')}</div>
              <div className="mt-2">
                <Select
                  value={mfa === undefined ? '' : mfa ? '1' : '0'}
                  onChange={(e) => onSetBoolParam('mfa', parseBoolParam(e.target.value))}
                  options={enabledOptions}
                  testId="admin.users.advanced.mfa"
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">{t('admin.users.advanced.lockout')}</div>
              <div className="mt-2">
                <Select
                  value={lockout === undefined ? '' : lockout ? '1' : '0'}
                  onChange={(e) => onSetBoolParam('lockout', parseBoolParam(e.target.value))}
                  options={lockoutOptions}
                  testId="admin.users.advanced.lockout"
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">{t('admin.users.advanced.password_reset')}</div>
              <div className="mt-2">
                <Select
                  value={passwordReset === undefined ? '' : passwordReset ? '1' : '0'}
                  onChange={(e) => onSetBoolParam('password_reset', parseBoolParam(e.target.value))}
                  options={passwordResetOptions}
                  testId="admin.users.advanced.password_reset"
                />
              </div>
            </div>
          </div>

          {filtersActive ? (
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={onClearFilters}>
                {t('common.clear_filters')}
              </Button>
              <Button variant="primary" onClick={() => onAdvancedOpenChange(false)}>
                {t('common.done')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end">
              <Button variant="primary" onClick={() => onAdvancedOpenChange(false)}>
                {t('common.done')}
              </Button>
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
}
