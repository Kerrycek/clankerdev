import type { ActionState } from './api/actionStates';
import type { Transaction, TransactionChain } from './api/transactions';
import { extractConcernRefs } from './concerns';
import { resourceId, refLabel } from './resources';

export type OperationCategory =
  | 'vps'
  | 'dataset'
  | 'download'
  | 'export'
  | 'dns'
  | 'network'
  | 'storage'
  | 'node'
  | 'migration'
  | 'user'
  | 'billing'
  | 'system'
  | 'other';

export type OperationSeverity = 'normal' | 'risky' | 'destructive' | 'background' | 'admin';
export type OperationVisibility = 'user' | 'system' | 'admin';

export interface OperationTaxonomy {
  key: string;
  labelKey: string;
  fallbackLabel: string;
  category: OperationCategory;
  categoryKey: string;
  severity: OperationSeverity;
  severityKey: string;
  visibility: OperationVisibility;
  visibilityKey: string;
  /** Routine/internal activity that should not dominate the default user Activity view. */
  systemNoise: boolean;
  /** Normalized source text used for matching/debugging. */
  matchText: string;
  /** Best backend-provided label/name. */
  rawLabel?: string;
}

export type OperationTranslator = (key: string, params?: Record<string, unknown>) => string;

interface OperationInput {
  label?: unknown;
  name?: unknown;
  concerns?: unknown;
  objectClass?: unknown;
  objectLabel?: unknown;
  categoryHint?: OperationCategory;
  relatedRefs?: unknown[];
}

interface OperationRule {
  key: string;
  labelKey: string;
  fallbackLabel: string;
  category: OperationCategory;
  severity?: OperationSeverity;
  visibility?: OperationVisibility;
  systemNoise?: boolean;
  match: (ctx: OperationMatchContext) => boolean;
}

interface OperationMatchContext {
  raw: string;
  normalized: string;
  tokens: Set<string>;
  classes: string[];
  categoryHint?: OperationCategory;
}

const CATEGORY_KEYS: Record<OperationCategory, string> = {
  vps: 'operation.category.vps',
  dataset: 'operation.category.dataset',
  download: 'operation.category.download',
  export: 'operation.category.export',
  dns: 'operation.category.dns',
  network: 'operation.category.network',
  storage: 'operation.category.storage',
  node: 'operation.category.node',
  migration: 'operation.category.migration',
  user: 'operation.category.user',
  billing: 'operation.category.billing',
  system: 'operation.category.system',
  other: 'operation.category.other',
};

const SEVERITY_KEYS: Record<OperationSeverity, string> = {
  normal: 'operation.severity.normal',
  risky: 'operation.severity.risky',
  destructive: 'operation.severity.destructive',
  background: 'operation.severity.background',
  admin: 'operation.severity.admin',
};

const VISIBILITY_KEYS: Record<OperationVisibility, string> = {
  user: 'operation.visibility.user',
  system: 'operation.visibility.system',
  admin: 'operation.visibility.admin',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function fieldText(obj: unknown, keys: string[]): string | null {
  if (!isRecord(obj)) return null;
  for (const key of keys) {
    const value = textValue(obj[key]);
    if (value) return value;
  }
  return null;
}

function shortClassName(value: string): string {
  return value.split('::').filter(Boolean).slice(-1)[0] ?? value;
}

function normalizeText(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[._:/\\-]+/g, ' ')
    .replace(/[^a-zA-Z0-9#]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function addRecordHints(parts: string[], obj: Record<string, unknown>): void {
  const keys = [
    'label',
    'name',
    'action',
    'operation',
    'class_name',
    'className',
    'object_class',
    'objectClass',
    'resource',
    'kind',
    'type_name',
    'typeName',
  ];
  for (const key of keys) {
    const value = textValue(obj[key]);
    if (value) parts.push(value);
  }
}

function collectRefHints(parts: string[], values: unknown[]): void {
  for (const value of values) {
    const label = refLabel(value);
    if (label) parts.push(label);

    if (isRecord(value)) addRecordHints(parts, value);
  }
}

function classHints(input: OperationInput): string[] {
  const out: string[] = [];
  const direct = textValue(input.objectClass);
  if (direct) out.push(shortClassName(direct));

  for (const ref of extractConcernRefs(input.concerns, { maxDepth: 3 })) {
    out.push(shortClassName(ref.class_name));
    if (ref.label) out.push(ref.label);
  }

  for (const ref of input.relatedRefs ?? []) {
    if (!isRecord(ref)) continue;
    const cls = fieldText(ref, ['class_name', 'className', 'class', 'object_class', 'objectClass']);
    if (cls) out.push(shortClassName(cls));
  }

  return out;
}

function buildContext(input: OperationInput): OperationMatchContext {
  const parts: string[] = [];
  const label = textValue(input.label);
  const name = textValue(input.name);
  const objectLabel = textValue(input.objectLabel);
  if (label) parts.push(label);
  if (name) parts.push(name);
  if (objectLabel) parts.push(objectLabel);

  const concerns = extractConcernRefs(input.concerns, { maxDepth: 3 });
  for (const ref of concerns) {
    parts.push(ref.class_name);
    if (ref.label) parts.push(ref.label);
  }
  collectRefHints(parts, input.relatedRefs ?? []);

  const classes = classHints(input).map(normalizeText).filter(Boolean);
  parts.push(...classes);

  const raw = parts.filter(Boolean).join(' | ');
  const normalized = normalizeText(raw);
  const tokens = new Set(normalized.split(' ').filter(Boolean));
  return { raw, normalized, tokens, classes, categoryHint: input.categoryHint };
}

function hasAny(ctx: OperationMatchContext, words: string[]): boolean {
  return words.some((word) => ctx.tokens.has(word) || ctx.normalized.includes(normalizeText(word)));
}

function hasAll(ctx: OperationMatchContext, words: string[]): boolean {
  return words.every((word) => ctx.tokens.has(word) || ctx.normalized.includes(normalizeText(word)));
}

function classIs(ctx: OperationMatchContext, ...classes: string[]): boolean {
  const wanted = classes.map(normalizeText);
  return ctx.classes.some((cls) => wanted.some((w) => cls === w || cls.endsWith(w)));
}

function vps(ctx: OperationMatchContext): boolean {
  return ctx.categoryHint === 'vps' || classIs(ctx, 'vps') || hasAny(ctx, ['vps', 'server']);
}

function dataset(ctx: OperationMatchContext): boolean {
  return ctx.categoryHint === 'dataset' || classIs(ctx, 'dataset') || hasAny(ctx, ['dataset', 'datasets']);
}

function dns(ctx: OperationMatchContext): boolean {
  return ctx.categoryHint === 'dns' || classIs(ctx, 'dnszone', 'dnsrecord') || hasAny(ctx, ['dns', 'zone', 'record']);
}

function network(ctx: OperationMatchContext): boolean {
  return ctx.categoryHint === 'network' || classIs(ctx, 'network', 'ipaddress', 'hostipaddress') || hasAny(ctx, ['network', 'ip', 'route', 'ptr', 'interface']);
}

function user(ctx: OperationMatchContext): boolean {
  return ctx.categoryHint === 'user' || classIs(ctx, 'user', 'userpublickey', 'usersession') || hasAny(ctx, ['user', 'profile', 'session', 'key']);
}

function node(ctx: OperationMatchContext): boolean {
  return ctx.categoryHint === 'node' || classIs(ctx, 'node') || hasAny(ctx, ['node']);
}

function migration(ctx: OperationMatchContext): boolean {
  return ctx.categoryHint === 'migration' || classIs(ctx, 'migrationplan') || hasAny(ctx, ['migration', 'migrate']);
}

function systemBackupNoise(ctx: OperationMatchContext): boolean {
  if (hasAny(ctx, ['backup', 'backups', 'autosnapshot', 'auto snapshot', 'retention', 'garbage collect', 'gc', 'scrub'])) return true;
  if (hasAll(ctx, ['snapshot', 'sync'])) return true;
  if (hasAll(ctx, ['snapshot', 'prune'])) return true;
  if (hasAll(ctx, ['snapshot', 'rotate'])) return true;
  if (hasAll(ctx, ['download', 'expire'])) return true;
  if (hasAll(ctx, ['artifact', 'cleanup'])) return true;
  if (hasAll(ctx, ['generated', 'cleanup'])) return true;
  if (hasAll(ctx, ['storage', 'cleanup'])) return true;
  return false;
}

const RULES: OperationRule[] = [
  {
    key: 'system.storage_maintenance',
    labelKey: 'operation.system.storage_maintenance.label',
    fallbackLabel: 'Storage maintenance',
    category: 'system',
    severity: 'background',
    visibility: 'system',
    systemNoise: true,
    match: systemBackupNoise,
  },

  // VPS daily/lifecycle actions.
  { key: 'vps.create', labelKey: 'action.vps.create.label', fallbackLabel: 'Create VPS', category: 'vps', match: (ctx) => vps(ctx) && hasAny(ctx, ['create', 'new']) },
  { key: 'vps.start', labelKey: 'action.vps.start.label', fallbackLabel: 'Start', category: 'vps', match: (ctx) => vps(ctx) && hasAny(ctx, ['start']) },
  { key: 'vps.stop', labelKey: 'action.vps.stop.label', fallbackLabel: 'Stop', category: 'vps', severity: 'risky', match: (ctx) => vps(ctx) && hasAny(ctx, ['stop', 'shutdown']) },
  { key: 'vps.restart', labelKey: 'action.vps.restart.label', fallbackLabel: 'Restart', category: 'vps', severity: 'risky', match: (ctx) => vps(ctx) && hasAny(ctx, ['restart', 'reboot']) },
  { key: 'vps.reinstall', labelKey: 'action.vps.reinstall.label', fallbackLabel: 'Reinstall VPS', category: 'vps', severity: 'destructive', match: (ctx) => vps(ctx) && hasAny(ctx, ['reinstall']) },
  { key: 'vps.delete', labelKey: 'action.vps.delete.label', fallbackLabel: 'Delete VPS', category: 'vps', severity: 'destructive', match: (ctx) => vps(ctx) && hasAny(ctx, ['delete', 'destroy', 'remove']) },
  { key: 'vps.clone', labelKey: 'action.vps.clone.label', fallbackLabel: 'Clone VPS', category: 'vps', match: (ctx) => vps(ctx) && hasAny(ctx, ['clone']) },
  { key: 'vps.swap', labelKey: 'action.vps.swap.label', fallbackLabel: 'Swap VPS', category: 'vps', severity: 'risky', match: (ctx) => vps(ctx) && hasAny(ctx, ['swap']) },
  { key: 'vps.migrate', labelKey: 'action.vps.migrate.label', fallbackLabel: 'Migrate VPS', category: 'vps', severity: 'admin', visibility: 'admin', match: (ctx) => vps(ctx) && hasAny(ctx, ['migrate', 'migration']) },
  { key: 'vps.replace', labelKey: 'action.vps.replace.label', fallbackLabel: 'Replace VPS', category: 'vps', severity: 'admin', visibility: 'admin', match: (ctx) => vps(ctx) && hasAny(ctx, ['replace']) },
  { key: 'vps.boot', labelKey: 'action.vps.boot.label', fallbackLabel: 'Boot VPS from template', category: 'vps', severity: 'admin', visibility: 'admin', match: (ctx) => vps(ctx) && hasAny(ctx, ['boot']) },
  { key: 'vps.template', labelKey: 'action.vps.template.label', fallbackLabel: 'Update VPS template info', category: 'vps', severity: 'admin', visibility: 'admin', match: (ctx) => vps(ctx) && hasAny(ctx, ['template']) },
  { key: 'vps.config', labelKey: 'action.vps.config.save.label', fallbackLabel: 'Save VPS configuration', category: 'vps', severity: 'risky', match: (ctx) => vps(ctx) && hasAny(ctx, ['config', 'configuration', 'update', 'modify']) },
  { key: 'vps.root_password', labelKey: 'action.vps.root_password.label', fallbackLabel: 'Generate root password', category: 'vps', severity: 'risky', match: (ctx) => vps(ctx) && hasAll(ctx, ['root', 'password']) },
  { key: 'vps.ssh_key', labelKey: 'action.vps.access.deploy_public_key.label', fallbackLabel: 'Deploy SSH public key', category: 'vps', match: (ctx) => vps(ctx) && hasAny(ctx, ['ssh', 'public key', 'deploy key']) },
  { key: 'vps.features', labelKey: 'action.vps.features.apply.label', fallbackLabel: 'Apply features', category: 'vps', severity: 'risky', match: (ctx) => vps(ctx) && hasAny(ctx, ['feature', 'features']) },
  { key: 'vps.mount', labelKey: 'operation.vps.mount.label', fallbackLabel: 'Update VPS mount', category: 'storage', severity: 'risky', match: (ctx) => vps(ctx) && hasAny(ctx, ['mount', 'mounts']) },
  { key: 'vps.network', labelKey: 'operation.vps.network.label', fallbackLabel: 'Update VPS network', category: 'network', severity: 'risky', match: (ctx) => vps(ctx) && network(ctx) },

  // Dataset / generated artifact lifecycle.
  { key: 'dataset.download.create', labelKey: 'action.dataset.download.create.label', fallbackLabel: 'Create snapshot download', category: 'download', match: (ctx) => dataset(ctx) && hasAny(ctx, ['download']) && hasAny(ctx, ['create', 'new']) },
  { key: 'dataset.download.delete', labelKey: 'action.dataset.download.delete.label', fallbackLabel: 'Delete snapshot download', category: 'download', severity: 'destructive', match: (ctx) => dataset(ctx) && hasAny(ctx, ['download']) && hasAny(ctx, ['delete', 'remove']) },
  { key: 'dataset.snapshot.rollback', labelKey: 'action.dataset.snapshot.rollback.label', fallbackLabel: 'Rollback snapshot', category: 'storage', severity: 'destructive', match: (ctx) => dataset(ctx) && hasAll(ctx, ['snapshot', 'rollback']) },
  { key: 'dataset.snapshot.create', labelKey: 'action.dataset.snapshot.create.label', fallbackLabel: 'Create snapshot', category: 'storage', match: (ctx) => dataset(ctx) && hasAll(ctx, ['snapshot', 'create']) },
  { key: 'dataset.snapshot.delete', labelKey: 'action.dataset.snapshot.delete.label', fallbackLabel: 'Delete snapshot', category: 'storage', severity: 'destructive', match: (ctx) => dataset(ctx) && hasAny(ctx, ['snapshot']) && hasAny(ctx, ['delete', 'remove']) },
  { key: 'dataset.create', labelKey: 'action.dataset.create.label', fallbackLabel: 'Create dataset', category: 'dataset', match: (ctx) => dataset(ctx) && hasAny(ctx, ['create', 'new']) },
  { key: 'dataset.delete', labelKey: 'action.dataset.delete.label', fallbackLabel: 'Delete dataset', category: 'dataset', severity: 'destructive', match: (ctx) => dataset(ctx) && hasAny(ctx, ['delete', 'destroy', 'remove']) },
  { key: 'dataset.update', labelKey: 'action.dataset.update.label', fallbackLabel: 'Update dataset', category: 'dataset', severity: 'risky', match: (ctx) => dataset(ctx) && hasAny(ctx, ['update', 'modify', 'resize', 'plan']) },

  // Exports and NFS/NAS access.
  { key: 'export.create', labelKey: 'operation.export.create.label', fallbackLabel: 'Create export', category: 'export', match: (ctx) => hasAny(ctx, ['export']) && hasAny(ctx, ['create', 'new']) },
  { key: 'export.update', labelKey: 'operation.export.update.label', fallbackLabel: 'Update export', category: 'export', severity: 'risky', match: (ctx) => hasAny(ctx, ['export']) && hasAny(ctx, ['update', 'edit', 'modify']) },
  { key: 'export.delete', labelKey: 'operation.export.delete.label', fallbackLabel: 'Delete export', category: 'export', severity: 'destructive', match: (ctx) => hasAny(ctx, ['export']) && hasAny(ctx, ['delete', 'remove', 'destroy']) },
  { key: 'export.host', labelKey: 'operation.export.host.label', fallbackLabel: 'Update export host access', category: 'export', severity: 'risky', match: (ctx) => hasAny(ctx, ['export']) && hasAny(ctx, ['host', 'allowed']) },

  // DNS / network / cluster admin.
  { key: 'dns.record.create', labelKey: 'action.dns.record.create.label', fallbackLabel: 'Add DNS record', category: 'dns', match: (ctx) => dns(ctx) && hasAny(ctx, ['record']) && hasAny(ctx, ['create', 'add']) },
  { key: 'dns.record.update', labelKey: 'action.dns.record.update.label', fallbackLabel: 'Update DNS record', category: 'dns', severity: 'risky', match: (ctx) => dns(ctx) && hasAny(ctx, ['record']) && hasAny(ctx, ['update', 'edit', 'modify']) },
  { key: 'dns.record.delete', labelKey: 'action.dns.record.delete.label', fallbackLabel: 'Delete DNS record', category: 'dns', severity: 'destructive', match: (ctx) => dns(ctx) && hasAny(ctx, ['record']) && hasAny(ctx, ['delete', 'remove']) },
  { key: 'dns.zone.create', labelKey: 'action.dns.zone.create.label', fallbackLabel: 'Create DNS zone', category: 'dns', match: (ctx) => dns(ctx) && hasAny(ctx, ['zone']) && hasAny(ctx, ['create', 'add']) },
  { key: 'dns.zone.update', labelKey: 'action.dns.zone.update.label', fallbackLabel: 'Update DNS zone', category: 'dns', severity: 'risky', match: (ctx) => dns(ctx) && hasAny(ctx, ['zone']) && hasAny(ctx, ['update', 'edit', 'modify']) },
  { key: 'dns.zone.delete', labelKey: 'action.dns.zone.delete.label', fallbackLabel: 'Delete DNS zone', category: 'dns', severity: 'destructive', match: (ctx) => dns(ctx) && hasAny(ctx, ['zone']) && hasAny(ctx, ['delete', 'remove']) },
  { key: 'network.update', labelKey: 'operation.network.update.label', fallbackLabel: 'Update network', category: 'network', severity: 'risky', match: (ctx) => network(ctx) && hasAny(ctx, ['update', 'assign', 'free', 'enable', 'disable', 'route', 'ptr', 'interface']) },
  { key: 'node.maintenance', labelKey: 'action.node.maintenance_lock.label', fallbackLabel: 'Node maintenance', category: 'node', severity: 'admin', visibility: 'admin', match: (ctx) => node(ctx) && hasAny(ctx, ['maintenance', 'lock', 'unlock']) },
  { key: 'node.evacuate', labelKey: 'action.node.evacuate.label', fallbackLabel: 'Evacuate node', category: 'node', severity: 'admin', visibility: 'admin', match: (ctx) => node(ctx) && hasAny(ctx, ['evacuate', 'evacuation']) },
  { key: 'migration.plan', labelKey: 'action.migration_plan.create.label', fallbackLabel: 'Migration plan', category: 'migration', severity: 'admin', visibility: 'admin', match: migration },

  // User and billing.
  { key: 'user.key', labelKey: 'operation.user.key.label', fallbackLabel: 'Update public key', category: 'user', match: (ctx) => user(ctx) && hasAny(ctx, ['key', 'ssh', 'public']) },
  { key: 'user.security', labelKey: 'operation.user.security.label', fallbackLabel: 'Update account security', category: 'user', severity: 'risky', match: (ctx) => user(ctx) && hasAny(ctx, ['mfa', 'totp', 'webauthn', 'password', 'session', 'security']) },
  { key: 'billing.payment', labelKey: 'action.user_payment.create.label', fallbackLabel: 'Add payment', category: 'billing', match: (ctx) => hasAny(ctx, ['payment', 'invoice', 'billing']) },
];

function fallbackFromInput(input: OperationInput, ctx: OperationMatchContext): string {
  const label = textValue(input.label) ?? textValue(input.name) ?? textValue(input.objectLabel);
  if (label) return label;
  if (ctx.categoryHint && ctx.categoryHint !== 'other') return `${ctx.categoryHint} operation`;
  return 'Operation';
}

function inferCategory(ctx: OperationMatchContext): OperationCategory {
  if (ctx.categoryHint) return ctx.categoryHint;
  if (vps(ctx)) return 'vps';
  if (dataset(ctx)) return 'dataset';
  if (dns(ctx)) return 'dns';
  if (network(ctx)) return 'network';
  if (node(ctx)) return 'node';
  if (migration(ctx)) return 'migration';
  if (user(ctx)) return 'user';
  if (hasAny(ctx, ['export'])) return 'export';
  if (hasAny(ctx, ['download'])) return 'download';
  if (hasAny(ctx, ['storage', 'snapshot', 'mount', 'zfs'])) return 'storage';
  if (hasAny(ctx, ['payment', 'billing', 'invoice'])) return 'billing';
  return 'other';
}

function fallbackVisibility(category: OperationCategory): OperationVisibility {
  if (category === 'node' || category === 'migration' || category === 'system') return category === 'system' ? 'system' : 'admin';
  return 'user';
}

function fallbackSeverity(ctx: OperationMatchContext, category: OperationCategory): OperationSeverity {
  if (category === 'system') return 'background';
  if (category === 'node' || category === 'migration') return 'admin';
  if (hasAny(ctx, ['delete', 'destroy', 'remove', 'rollback', 'reinstall'])) return 'destructive';
  if (hasAny(ctx, ['stop', 'restart', 'migrate', 'replace', 'network', 'route', 'ptr', 'password'])) return 'risky';
  return 'normal';
}

export function classifyOperation(input: OperationInput): OperationTaxonomy {
  const ctx = buildContext(input);
  const rule = RULES.find((candidate) => candidate.match(ctx));
  const rawLabel = textValue(input.label) ?? textValue(input.name) ?? undefined;

  if (rule) {
    const severity = rule.severity ?? fallbackSeverity(ctx, rule.category);
    const visibility = rule.visibility ?? fallbackVisibility(rule.category);
    return {
      key: rule.key,
      labelKey: rule.labelKey,
      fallbackLabel: rule.fallbackLabel,
      category: rule.category,
      categoryKey: CATEGORY_KEYS[rule.category],
      severity,
      severityKey: SEVERITY_KEYS[severity],
      visibility,
      visibilityKey: VISIBILITY_KEYS[visibility],
      systemNoise: Boolean(rule.systemNoise),
      matchText: ctx.normalized,
      rawLabel,
    };
  }

  const category = inferCategory(ctx);
  const severity = fallbackSeverity(ctx, category);
  const visibility = fallbackVisibility(category);
  const systemNoise = category === 'system' || (visibility === 'system' && severity === 'background');

  return {
    key: `${category}.unknown`,
    labelKey: 'operation.unknown.label',
    fallbackLabel: fallbackFromInput(input, ctx),
    category,
    categoryKey: CATEGORY_KEYS[category],
    severity,
    severityKey: SEVERITY_KEYS[severity],
    visibility,
    visibilityKey: VISIBILITY_KEYS[visibility],
    systemNoise,
    matchText: ctx.normalized,
    rawLabel,
  };
}

export function classifyTransaction(tx: Transaction): OperationTaxonomy {
  return classifyOperation({
    label: tx.name,
    name: tx.name,
    concerns: undefined,
    categoryHint: resourceId(tx.vps) ? 'vps' : undefined,
    relatedRefs: [tx.vps, tx.node, tx.user, tx.transaction_chain],
  });
}

export function classifyTransactionChain(chain: TransactionChain): OperationTaxonomy {
  return classifyOperation({
    label: chain.label,
    name: chain.label,
    concerns: chain.concerns,
  });
}

export function classifyActionState(state: ActionState): OperationTaxonomy {
  return classifyOperation({
    label: state.label,
    name: state.label,
    concerns: state['concerns'],
  });
}

export function operationLabel(op: OperationTaxonomy, t: OperationTranslator): string {
  const translated = t(op.labelKey);
  if (translated && translated !== op.labelKey) return translated;
  return op.fallbackLabel;
}

export function operationCategoryLabel(op: OperationTaxonomy, t: OperationTranslator): string {
  const translated = t(op.categoryKey);
  if (translated && translated !== op.categoryKey) return translated;
  return op.category;
}

export function operationSeverityLabel(op: OperationTaxonomy, t: OperationTranslator): string {
  const translated = t(op.severityKey);
  if (translated && translated !== op.severityKey) return translated;
  return op.severity;
}

export function operationVisibilityLabel(op: OperationTaxonomy, t: OperationTranslator): string {
  const translated = t(op.visibilityKey);
  if (translated && translated !== op.visibilityKey) return translated;
  return op.visibility;
}

export function operationBadgeVariant(op: OperationTaxonomy): 'neutral' | 'ok' | 'warn' | 'danger' | 'info' {
  if (op.severity === 'destructive') return 'danger';
  if (op.severity === 'risky') return 'warn';
  if (op.severity === 'background') return 'info';
  if (op.severity === 'admin') return 'neutral';
  return 'neutral';
}

export function shouldCollapseSystemOperation(op: OperationTaxonomy, state?: unknown): boolean {
  const st = String(state ?? '').trim().toLowerCase();
  const active = st && !['done', 'failed', 'fatal', 'resolved', 'cancelled', 'canceled'].includes(st);
  if (active) return false;
  return op.systemNoise || op.visibility === 'system';
}
