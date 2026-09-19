import type { Environment } from '../../../../lib/api/infra';
import { parsePositiveInt } from '../../../../lib/parse';

export type ResourcePackageScope = 'global' | 'personal' | 'all';

export function normalizeResourcePackageScope(value: string | null): ResourcePackageScope {
  if (value === 'personal' || value === 'all') return value;
  return 'global';
}

export function resourcePackageScopeFilters(
  scope: ResourcePackageScope,
  environmentId: number | undefined,
  userId: number | undefined,
) {
  return {
    environmentId: scope === 'global' ? undefined : environmentId,
    userId: scope === 'global' ? null : scope === 'personal' ? userId : undefined,
    personalUserRequired: scope === 'personal' && !userId,
  };
}

export function resourcePackageEnvironmentLabel(env: Environment | null | undefined): string {
  const label = typeof env?.label === 'string' ? env.label.trim() : '';
  return label || (typeof env?.id === 'number' ? `#${env.id}` : '—');
}

export function resourcePackageUserLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const user = value as { id?: unknown; login?: unknown };
  const login = typeof user.login === 'string' ? user.login.trim() : '';
  if (login) return login;
  return typeof user.id === 'number' ? `#${user.id}` : '—';
}

export function resolveResourcePackageEnvironment(environments: Environment[], value: string): number | undefined {
  const id = parsePositiveInt(value);
  if (id) return id;

  const needle = value.trim().toLowerCase();
  if (!needle) return undefined;
  return environments.find((env) => resourcePackageEnvironmentLabel(env).toLowerCase() === needle)?.id;
}
