import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';

import { createUser, fetchUsers, type CreateUserPayload } from '../../../lib/api/users';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { parseBoolParam, parseNonNegativeInt } from '../../../lib/parse';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../lib/smartFilter';

import { FilterBar } from '../../../components/layout/FilterBar';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';

import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Drawer } from '../../../components/ui/Drawer';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterChip } from '../../../components/ui/FilterChip';
import { Input } from '../../../components/ui/Input';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';

import { UsersListMobile } from './users/UsersListMobile';
import { UsersListTable } from './users/UsersListTable';
import { type UserListRecord } from './users/userListSemantics';

type RoleFilter = '' | 'user' | 'support' | 'admin';

interface CreateUserDraft {
  login: string;
  password: string;
  password2: string;
  fullName: string;
  email: string;
  address: string;
  level: string;
  info: string;
  monthlyPayment: string;
  mailerEnabled: boolean;
}

const initialCreateUserDraft: CreateUserDraft = {
  login: '',
  password: '',
  password2: '',
  fullName: '',
  email: '',
  address: '',
  level: '2',
  info: '',
  monthlyPayment: '300',
  mailerEnabled: true,
};

function normalizeRole(raw: string | null | undefined): RoleFilter {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'admin') return 'admin';
  if (v === 'support') return 'support';
  if (v === 'user') return 'user';
  return '';
}

function parseBoolToken(value: string): boolean | null | undefined {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return undefined;

  if (v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'on' || v === 'enabled') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'n' || v === 'off' || v === 'disabled') return false;

  if (v === 'any' || v === '*' || v === 'all') return undefined;
  return null;
}

type SmartKey = 'id' | 'q' | 'role' | 'level' | 'mailer' | 'lockout' | 'password_reset' | 'mfa';

function canonicalKey(raw: string): SmartKey | null {
  const k = String(raw ?? '').trim().toLowerCase();
  if (!k) return null;

  if (k === 'id' || k === '#') return 'id';
  if (k === 'q' || k === 'search' || k === 's' || k === 'text' || k === 'query') return 'q';

  if (k === 'role' || k === 'r') return 'role';
  if (k === 'level' || k === 'lvl') return 'level';

  if (k === 'mailer' || k === 'mail' || k === 'mailer_enabled') return 'mailer';
  if (k === 'lockout' || k === 'locked') return 'lockout';
  if (k === 'password_reset' || k === 'pwd_reset' || k === 'reset') return 'password_reset';
  if (k === 'mfa' || k === '2fa') return 'mfa';

  // Convenience alias
  if (k === 'admin') return 'role';

  return null;
}

function resolveRoleValue(raw: string): RoleFilter | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'all' || v === 'any' || v === '*') return '';
  if (v === 'admin' || v === 'admins') return 'admin';
  if (v === 'support' || v === 'supp') return 'support';
  if (v === 'user' || v === 'users') return 'user';

  const known: RoleFilter[] = ['admin', 'support', 'user'];
  const pref = known.filter((x) => x.startsWith(v));
  if (pref.length === 1) return pref[0] ?? null;
  return null;
}

export function UsersPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const toasts = useToasts();
  const navigate = useNavigate();

  const [sp, setSp] = useSearchParams();

  const qText = useMemo(() => String(sp.get('q') ?? ''), [sp]);
  const role = useMemo(() => normalizeRole(sp.get('role')), [sp]);
  const level = useMemo(() => parseNonNegativeInt(sp.get('level')), [sp]);

  const mailerEnabled = useMemo(() => parseBoolParam(sp.get('mailer')), [sp]);
  const lockout = useMemo(() => parseBoolParam(sp.get('lockout')), [sp]);
  const passwordReset = useMemo(() => parseBoolParam(sp.get('password_reset')), [sp]);
  const mfa = useMemo(() => parseBoolParam(sp.get('mfa')), [sp]);

  const setTextParam = (key: string, value: string | undefined) => {
    const v = String(value ?? '').trim();
    setSp((prev) => {
      const p = new URLSearchParams(prev);
      if (v) p.set(key, v);
      else p.delete(key);
      return p;
    });
  };

  const setBoolParamInUrl = (key: string, value: boolean | undefined) => {
    setSp((prev) => {
      const p = new URLSearchParams(prev);
      if (value === true) p.set(key, '1');
      else if (value === false) p.set(key, '0');
      else p.delete(key);
      return p;
    });
  };

  const filtersActive = Boolean(
    qText.trim() || role || level !== undefined || mailerEnabled !== undefined || lockout !== undefined || passwordReset !== undefined || mfa !== undefined
  );

  const clearFilters = () => {
    setSmart('');
    setSmartErrors([]);

    setSp((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('q');
      p.delete('role');
      p.delete('level');
      p.delete('mailer');
      p.delete('lockout');
      p.delete('password_reset');
      p.delete('mfa');
      return p;
    });
  };

  const pagination = useKeysetPagination({
    id: 'admin.users.list',
    filterKey: JSON.stringify({ q: qText.trim(), role, level, mailerEnabled, lockout, passwordReset, mfa, scope: basePath }),
    searchParams: sp,
    setSearchParams: setSp,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const listQ = useQuery({
    queryKey: [
      'users',
      'index',
      {
        limit: pagination.limit,
        fromId: pagination.fromId,
        q: qText.trim() || undefined,
        role: role || undefined,
        level,
        mailerEnabled,
        lockout,
        passwordReset,
        mfa,
      },
    ],
    queryFn: async () =>
      (
        await fetchUsers({
          limit: pagination.limit,
          fromId: pagination.fromId,
          q: qText.trim() || undefined,
          role: role || undefined,
          level,
          mailerEnabled,
          lockout,
          passwordReset,
          enableMfa: mfa,
        })
      ).data,
    staleTime: 10_000,
  });

  const pageData = (listQ.data ?? []) as UserListRecord[];
  const pageCursor = useMemo(() => cursorFromDescendingPage(pageData), [pageData]);

  const hasMore = pageData.length >= pagination.limit;
  const canNext = pagination.hasForward || (hasMore && pageCursor !== null);
  const canPaginate = pagination.stack.length > 1 || pageData.length > 0;

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const smartNeedle = smart.trim();
  const smartInputRef = useRef<HTMLInputElement>(null);

  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateUserDraft>(initialCreateUserDraft);
  const [createError, setCreateError] = useState<string | null>(null);

  const setCreateField = <K extends keyof CreateUserDraft>(key: K, value: CreateUserDraft[K]) => {
    setCreateDraft((prev) => ({ ...prev, [key]: value }));
    if (createError) setCreateError(null);
  };

  const buildCreatePayload = (): CreateUserPayload | null => {
    const login = createDraft.login.trim();
    const password = createDraft.password;
    const password2 = createDraft.password2;
    const level = Number(createDraft.level);
    const monthly = createDraft.monthlyPayment.trim() ? Number(createDraft.monthlyPayment) : undefined;

    if (!login) {
      setCreateError(t('admin.users.create.validation.login'));
      return null;
    }

    if (!password) {
      setCreateError(t('admin.users.create.validation.password'));
      return null;
    }

    if (password !== password2) {
      setCreateError(t('admin.users.create.validation.password_match'));
      return null;
    }

    if (!Number.isFinite(level) || level < 0) {
      setCreateError(t('admin.users.create.validation.level'));
      return null;
    }

    if (monthly !== undefined && (!Number.isFinite(monthly) || monthly < 0)) {
      setCreateError(t('admin.users.create.validation.monthly_payment'));
      return null;
    }

    return {
      login,
      password,
      full_name: createDraft.fullName.trim() || undefined,
      email: createDraft.email.trim() || undefined,
      address: createDraft.address.trim() || undefined,
      level,
      info: createDraft.info.trim() || undefined,
      monthly_payment: monthly,
      mailer_enabled: createDraft.mailerEnabled,
    };
  };

  const createM = useMutation({
    mutationFn: async () => {
      const payload = buildCreatePayload();
      if (!payload) throw new Error('validation');
      return createUser(payload);
    },
    onSuccess: (res) => {
      const user = res.data as any;
      const id = Number(user?.id);
      setCreateOpen(false);
      setCreateDraft(initialCreateUserDraft);
      setCreateError(null);
      void listQ.refetch();
      toasts.pushToast({ variant: 'ok', title: t('admin.users.create.toast.created') });
      if (Number.isFinite(id) && id > 0) navigate(`${basePath}/users/${id}`);
    },
    onError: (err: any) => {
      if (String(err?.message ?? '') === 'validation') return;
      setCreateError(String(err?.message ?? err));
    },
  });

  useEffect(() => {
    if (smartNeedle === '?') setHelpOpen(true);
  }, [smartNeedle]);

  const openUser = (userId: number) => {
    navigate(`${basePath}/users/${userId}`);
  };

  const applySmartText = (raw: string) => {
    const input = String(raw ?? '').trim();
    if (!input) return;

    if (input === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(input);

    // Fast path: numeric opens the user detail.
    if (tokens.length === 1) {
      const num = parseNumericToken(tokens[0] ?? '');
      if (num) {
        openUser(num);
        setSmart('');
        setSmartErrors([]);
        return;
      }
    }

    const plain: string[] = [];
    const errors: string[] = [];

    tokens.forEach((tok) => {
      const kv = splitKeyValueToken(tok);
      if (!kv) {
        plain.push(unquoteSmartValue(tok));
        return;
      }

      const key = canonicalKey(kv.rawKey);
      const valueRaw = unquoteSmartValue(kv.rawValue);

      if (!key) {
        errors.push(t('filters.smart.error.unknown_key', { key: kv.rawKey }));
        return;
      }

      if (!valueRaw.trim()) {
        errors.push(t('filters.smart.error.missing_value', { key: kv.rawKey.trim() }));
        return;
      }

      if (key === 'id') {
        const id = parseNumericToken(valueRaw);
        if (!id) {
          errors.push(t('admin.users.smart.error.id', { value: valueRaw }));
          return;
        }
        openUser(id);
        return;
      }

      if (key === 'q') {
        setTextParam('q', valueRaw);
        return;
      }

      if (key === 'role') {
        const r = resolveRoleValue(valueRaw);
        if (r === null) {
          errors.push(t('admin.users.smart.error.role', { value: valueRaw }));
          return;
        }
        setTextParam('role', r || undefined);
        return;
      }

      if (key === 'level') {
        const lv = parseNonNegativeInt(valueRaw);
        if (lv === undefined) {
          errors.push(t('admin.users.smart.error.level', { value: valueRaw }));
          return;
        }
        setTextParam('level', String(lv));
        return;
      }

      if (key === 'mailer') {
        const b = parseBoolToken(valueRaw);
        if (b === null) {
          errors.push(t('admin.users.smart.error.bool', { key: 'mailer', value: valueRaw }));
          return;
        }
        setBoolParamInUrl('mailer', b);
        return;
      }

      if (key === 'lockout') {
        const b = parseBoolToken(valueRaw);
        if (b === null) {
          errors.push(t('admin.users.smart.error.bool', { key: 'lockout', value: valueRaw }));
          return;
        }
        setBoolParamInUrl('lockout', b);
        return;
      }

      if (key === 'password_reset') {
        const b = parseBoolToken(valueRaw);
        if (b === null) {
          errors.push(t('admin.users.smart.error.bool', { key: 'password_reset', value: valueRaw }));
          return;
        }
        setBoolParamInUrl('password_reset', b);
        return;
      }

      if (key === 'mfa') {
        const b = parseBoolToken(valueRaw);
        if (b === null) {
          errors.push(t('admin.users.smart.error.bool', { key: 'mfa', value: valueRaw }));
          return;
        }
        setBoolParamInUrl('mfa', b);
        return;
      }
    });

    const q = plain.join(' ').trim();
    if (q) setTextParam('q', q);

    setSmart('');
    setSmartErrors(errors);

    if (errors.length > 0) {
      toasts.pushToast({ variant: 'danger', title: errors[0] ?? t('common.unknown_error') });
    }
  };

  const smartSuggestions: SmartFilterSuggestion[] = useMemo(() => {
    const out: SmartFilterSuggestion[] = [];
    const needle = smartNeedle;
    if (!needle) return out;

    if (needle === '?') {
      out.push({
        id: 'help',
        primary: t('filters.help.open'),
        secondary: t('filters.help.suggestion.secondary'),
        onPick: () => setHelpOpen(true),
        testId: 'admin.users.smart.suggest.help',
      });
      return out;
    }

    const num = parseNumericToken(needle);
    if (num) {
      out.push({
        id: `open.${num}`,
        primary: t('admin.users.smart.suggest.open_user', { id: num }),
        secondary: t('admin.users.smart.suggest.open_user.secondary'),
        onPick: () => {
          openUser(num);
          setSmart('');
        },
        testId: 'admin.users.smart.suggest.open_user',
      });
    }

    // Quick toggles
    const low = needle.toLowerCase();
    if (low === 'admins' || low === 'admin') {
      out.push({
        id: 'role.admin',
        primary: 'role:admin',
        secondary: t('admin.users.smart.suggest.role_admin'),
        onPick: () => {
          setTextParam('role', 'admin');
          setSmart('');
        },
      });
    }

    out.push({
      id: 'search',
      primary: t('admin.users.smart.suggest.search', { q: needle }),
      secondary: t('admin.users.smart.suggest.search.secondary'),
      onPick: () => {
        setTextParam('q', needle);
        setSmart('');
      },
      testId: 'admin.users.smart.suggest.search',
    });

    return out;
  }, [openUser, smartNeedle, t]);

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];

    if (qText.trim()) {
      chips.push(
        <FilterChip key="q" label={`q:${qText.trim()}`} tone="neutral" onRemove={() => setTextParam('q', undefined)} testId="admin.users.chip.q" />
      );
    }

    if (role) {
      chips.push(
        <FilterChip
          key="role"
          label={`role:${role}`}
          tone="neutral"
          onRemove={() => setTextParam('role', undefined)}
          testId="admin.users.chip.role"
        />
      );
    }

    if (level !== undefined) {
      chips.push(
        <FilterChip
          key="level"
          label={`level:${level}`}
          tone="neutral"
          onRemove={() => setTextParam('level', undefined)}
          testId="admin.users.chip.level"
        />
      );
    }

    if (mailerEnabled !== undefined) {
      chips.push(
        <FilterChip
          key="mailer"
          label={`mailer:${mailerEnabled ? 'on' : 'off'}`}
          tone="neutral"
          onRemove={() => setBoolParamInUrl('mailer', undefined)}
          testId="admin.users.chip.mailer"
        />
      );
    }

    if (lockout !== undefined) {
      chips.push(
        <FilterChip
          key="lockout"
          label={`lockout:${lockout ? 'on' : 'off'}`}
          tone={lockout ? 'danger' : 'neutral'}
          onRemove={() => setBoolParamInUrl('lockout', undefined)}
          testId="admin.users.chip.lockout"
        />
      );
    }

    if (passwordReset !== undefined) {
      chips.push(
        <FilterChip
          key="password_reset"
          label={`password_reset:${passwordReset ? 'on' : 'off'}`}
          tone={passwordReset ? 'warn' : 'neutral'}
          onRemove={() => setBoolParamInUrl('password_reset', undefined)}
          testId="admin.users.chip.password_reset"
        />
      );
    }

    if (mfa !== undefined) {
      chips.push(
        <FilterChip
          key="mfa"
          label={`mfa:${mfa ? 'on' : 'off'}`}
          tone="neutral"
          onRemove={() => setBoolParamInUrl('mfa', undefined)}
          testId="admin.users.chip.mfa"
        />
      );
    }

    smartErrors.forEach((e, idx) => {
      chips.push(
        <FilterChip
          key={`err.${idx}`}
          label={e}
          tone="danger"
          onRemove={() => setSmartErrors([])}
          testId={`admin.users.chip.error.${idx}`}
        />
      );
    });

    return chips;
  }, [
    lockout,
    mailerEnabled,
    mfa,
    passwordReset,
    qText,
    role,
    level,
    setBoolParamInUrl,
    smartErrors,
    t,
  ]);

  const shareUrl = useMemo(() => (typeof window !== 'undefined' ? window.location.href : ''), [sp]);

  const na = t('common.na');

  const roleOptions = useMemo(
    () => [
      { value: '', label: t('common.all') },
      { value: 'admin', label: t('admin.users.role.admin') },
      { value: 'support', label: t('admin.users.role.support') },
      { value: 'user', label: t('admin.users.role.user') },
    ],
    [t]
  );

  const enabledOptions = useMemo(
    () => [
      { value: '', label: t('common.all') },
      { value: '1', label: t('common.enabled') },
      { value: '0', label: t('common.disabled') },
    ],
    [t]
  );

  const lockoutOptions = useMemo(
    () => [
      { value: '', label: t('common.all') },
      { value: '1', label: t('admin.users.advanced.lockout.on') },
      { value: '0', label: t('admin.users.advanced.lockout.off') },
    ],
    [t]
  );

  const passwordResetOptions = useMemo(
    () => [
      { value: '', label: t('common.all') },
      { value: '1', label: t('admin.users.advanced.password_reset.on') },
      { value: '0', label: t('admin.users.advanced.password_reset.off') },
    ],
    [t]
  );

  return (
    <ListShell
      testId="admin.users.page"
      header={
        <PageHeader
          title={t('admin.users.title')}
          description={t('admin.users.subtitle')}
          meta={<span className="text-xs text-faint">{t('admin.users.filter_hint')}</span>}
          testId="admin.users.list.header"
        />
      }
      filters={
        <>
          <FilterBar testId="admin.users.list.filters">
            <div className="w-full sm:max-w-xl">
              <SmartFilterInput
                ref={smartInputRef}
                value={smart}
                onChange={(v) => {
                  setSmart(v);
                  if (smartErrors.length) setSmartErrors([]);
                }}
                placeholder={t('admin.users.search.placeholder')}
                ariaLabel={t('admin.users.search.placeholder')}
                testId="admin.users.smart_filter.input"
                suggestions={smartSuggestions}
                onSubmit={() => applySmartText(smart)}
                suffix={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 px-0"
                    onClick={() => setHelpOpen(true)}
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
              onClick={() => setAdvancedOpen(true)}
              aria-label={t('filters.advanced.open')}
              title={t('filters.advanced.open')}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span className="ml-2 hidden sm:inline">{t('filters.advanced.label')}</span>
            </Button>

            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)} testId="admin.users.create.open">
              {t('admin.users.create.open')}
            </Button>

            <CopyButton
              size="sm"
              variant="secondary"
              label={t('common.copy_link')}
              text={shareUrl}
              testId="admin.users.copy_link"
            />

            {filtersActive ? (
              <Button variant="secondary" size="sm" onClick={clearFilters} testId="admin.users.filter.clear">
                {t('common.clear_filters')}
              </Button>
            ) : null}
          </FilterBar>

          <SmartInputHelp
            open={helpOpen}
            onClose={() => {
              setHelpOpen(false);
              if (smartNeedle === '?') setSmart('');
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
              setSmart(prefix);
              setHelpOpen(false);
              window.setTimeout(() => smartInputRef.current?.focus(), 0);
            }}
            actions={[
              {
                label: t('filters.advanced.label'),
                onClick: () => {
                  setHelpOpen(false);
                  setAdvancedOpen(true);
                },
                variant: 'secondary',
              },
            ]}
            testId="admin.users.smart_help"
            keyRowTestIdPrefix="admin.users.smart_help.key"
          />

          <Drawer
            open={advancedOpen}
            onClose={() => setAdvancedOpen(false)}
            title={t('filters.advanced.title')}
            width="lg"
            testId="admin.users.advanced.drawer"
          >
            <div className="space-y-4">
              <div className="text-sm text-muted">{t('admin.users.advanced.hint')}</div>

              <div>
                <div className="text-sm font-medium">{t('admin.users.advanced.role')}</div>
                <div className="mt-2">
                  <Select
                    value={role}
                    onChange={(e) => setTextParam('role', normalizeRole(e.target.value) || undefined)}
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
                    onChange={(e) => setTextParam('level', e.target.value.trim() ? e.target.value : undefined)}
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
                      onChange={(e) => setBoolParamInUrl('mailer', parseBoolParam(e.target.value))}
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
                      onChange={(e) => setBoolParamInUrl('mfa', parseBoolParam(e.target.value))}
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
                      onChange={(e) => setBoolParamInUrl('lockout', parseBoolParam(e.target.value))}
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
                      onChange={(e) => setBoolParamInUrl('password_reset', parseBoolParam(e.target.value))}
                      options={passwordResetOptions}
                      testId="admin.users.advanced.password_reset"
                    />
                  </div>
                </div>
              </div>

              {filtersActive ? (
                <div className="flex items-center justify-end gap-2">
                  <Button variant="secondary" onClick={clearFilters}>
                    {t('common.clear_filters')}
                  </Button>
                  <Button variant="primary" onClick={() => setAdvancedOpen(false)}>
                    {t('common.done')}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-end">
                  <Button variant="primary" onClick={() => setAdvancedOpen(false)}>
                    {t('common.done')}
                  </Button>
                </div>
              )}
            </div>
          </Drawer>

          <Modal
            open={createOpen}
            onClose={() => {
              if (createM.isPending) return;
              setCreateOpen(false);
              setCreateError(null);
            }}
            title={t('admin.users.create.title')}
            size="lg"
            testId="admin.users.create.modal"
            footer={
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCreateOpen(false);
                    setCreateError(null);
                  }}
                  disabled={createM.isPending}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => createM.mutate()}
                  loading={createM.isPending}
                  testId="admin.users.create.submit"
                >
                  {t('admin.users.create.submit')}
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              {createError ? (
                <div className="rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger">
                  {createError}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">{t('admin.users.create.field.login')}</span>
                  <Input
                    value={createDraft.login}
                    onChange={(e) => setCreateField('login', e.target.value)}
                    autoComplete="off"
                    testId="admin.users.create.login"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium">{t('admin.users.create.field.level')}</span>
                  <Input
                    value={createDraft.level}
                    onChange={(e) => setCreateField('level', e.target.value)}
                    inputMode="numeric"
                    testId="admin.users.create.level"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium">{t('admin.users.create.field.password')}</span>
                  <Input
                    type="password"
                    value={createDraft.password}
                    onChange={(e) => setCreateField('password', e.target.value)}
                    autoComplete="new-password"
                    testId="admin.users.create.password"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium">{t('admin.users.create.field.password2')}</span>
                  <Input
                    type="password"
                    value={createDraft.password2}
                    onChange={(e) => setCreateField('password2', e.target.value)}
                    autoComplete="new-password"
                    testId="admin.users.create.password2"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium">{t('admin.users.create.field.full_name')}</span>
                  <Input
                    value={createDraft.fullName}
                    onChange={(e) => setCreateField('fullName', e.target.value)}
                    testId="admin.users.create.full_name"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium">{t('admin.users.create.field.email')}</span>
                  <Input
                    type="email"
                    value={createDraft.email}
                    onChange={(e) => setCreateField('email', e.target.value)}
                    testId="admin.users.create.email"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium">{t('admin.users.create.field.monthly_payment')}</span>
                  <Input
                    value={createDraft.monthlyPayment}
                    onChange={(e) => setCreateField('monthlyPayment', e.target.value)}
                    inputMode="decimal"
                    testId="admin.users.create.monthly_payment"
                  />
                </label>

                <Checkbox
                  checked={createDraft.mailerEnabled}
                  onChange={(checked) => setCreateField('mailerEnabled', checked)}
                  label={t('admin.users.create.field.mailer_enabled')}
                  testId="admin.users.create.mailer_enabled"
                />

                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium">{t('admin.users.create.field.address')}</span>
                  <Input
                    value={createDraft.address}
                    onChange={(e) => setCreateField('address', e.target.value)}
                    testId="admin.users.create.address"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium">{t('admin.users.create.field.info')}</span>
                  <textarea
                    className="mt-1 min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
                    value={createDraft.info}
                    onChange={(e) => setCreateField('info', e.target.value)}
                    data-testid="admin.users.create.info"
                  />
                </label>
              </div>
            </div>
          </Modal>
        </>
      }
    >
      {listQ.isLoading ? (
        <LoadingState testId="admin.users.loading" />
      ) : listQ.isError ? (
        <ErrorState
          testId="admin.users.error"
          title={t('admin.users.load_error')}
          error={listQ.error}
          onRetry={() => void listQ.refetch()}
          showBack={false}
          detailsExtra={{ page: 'admin.users' }}
        />
      ) : pageData.length === 0 ? (
        <EmptyState
          testId="admin.users.empty"
          title={filtersActive ? t('empty.list.no_matches.title') : t('admin.users.empty')}
          body={filtersActive ? t('empty.list.no_matches.body') : undefined}
          actionLabel={filtersActive ? t('common.clear_filters') : undefined}
          onAction={filtersActive ? clearFilters : undefined}
        />
      ) : (
        <>
          <UsersListMobile users={pageData} basePath={basePath} t={t} />

          {canPaginate ? (
            <Card className="md:hidden">
              <KeysetPagination
                page={pagination.page}
                pageCount={pagination.stack.length}
                canPrev={pagination.canPrev}
                canNext={canNext}
                onPrev={pagination.goPrev}
                onNext={() => pagination.goNext(pageCursor)}
                onGoToPage={pagination.goToPage}
                limit={pagination.limit}
                allowedLimits={pagination.allowedLimits}
                onLimitChange={pagination.setLimit}
                testId="admin.users.pagination.mobile"
              />
            </Card>
          ) : null}

          <UsersListTable
            users={pageData}
            basePath={basePath}
            t={t}
            na={na}
            pagination={pagination}
            canPaginate={canPaginate}
            canNext={canNext}
            pageCursor={pageCursor}
          />
        </>
      )}
    </ListShell>
  );
}
