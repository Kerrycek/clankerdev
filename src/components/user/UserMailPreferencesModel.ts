import type { UserMailRoleRecipient, UserMailTemplateRecipient } from '../../lib/api/userMail';

export type EffectiveToSource = 'disabled' | 'template' | 'role' | 'primary';
export type MailTemplateView = 'all' | 'changed' | 'disabled';

export interface EffectiveTemplateRecipients {
  source: EffectiveToSource;
  to: string[];
  rolesUsed: string[];
}

export function formatEmailsForTextarea(raw: string | null | undefined): string {
  if (!raw) return '';

  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',\n');
}

/** Accept commas, semicolons, whitespace and newlines as separators. */
export function normalizeEmailsForApi(raw: string): string {
  return String(raw ?? '')
    .replace(/;/g, ',')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',');
}

export function parseRoles(rolesRaw: string | undefined): string[] {
  if (!rolesRaw) return [];

  return rolesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];

  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getUserLanguageId(user: { language?: unknown } | null | undefined): string {
  const lang = user?.language;
  if (typeof lang === 'number') return String(lang);
  if (isRecord(lang) && typeof lang['id'] === 'number') return String(lang['id']);
  return '';
}

export function computeEffectiveRoleTo(args: { role: UserMailRoleRecipient; userEmail?: string }): string[] {
  const override = parseEmails(args.role.to);
  if (override.length > 0) return override;
  return args.userEmail ? [args.userEmail] : [];
}

export function computeEffectiveTemplateTo(args: {
  template: UserMailTemplateRecipient;
  userEmail?: string;
  roleRecipients: UserMailRoleRecipient[];
}): EffectiveTemplateRecipients {
  const enabled = args.template.enabled !== false;
  if (!enabled) return { source: 'disabled', to: [], rolesUsed: [] };

  const templateTo = parseEmails(args.template.to);
  if (templateTo.length > 0) return { source: 'template', to: templateTo, rolesUsed: [] };

  const roles = parseRoles(args.template.roles);
  const roleTo: string[] = [];
  const rolesUsed: string[] = [];

  for (const r of roles) {
    const recp = args.roleRecipients.find((x) => String(x.id) === r);
    const addr = parseEmails(recp?.to ?? null);
    if (addr.length > 0) {
      roleTo.push(...addr);
      rolesUsed.push(r);
    }
  }

  if (roleTo.length > 0) return { source: 'role', to: roleTo, rolesUsed };

  return { source: 'primary', to: args.userEmail ? [args.userEmail] : [], rolesUsed: [] };
}

export function isMailTemplateChanged(template: UserMailTemplateRecipient): boolean {
  const enabled = template.enabled !== false;
  return Boolean((template.to && String(template.to).trim().length > 0) || !enabled);
}

export function filterMailTemplates(args: {
  templates: UserMailTemplateRecipient[];
  view: MailTemplateView;
  needle: string;
}): UserMailTemplateRecipient[] {
  const needle = args.needle.trim().toLowerCase();

  return args.templates.filter((r) => {
    const enabled = r.enabled !== false;

    if (args.view === 'changed' && !isMailTemplateChanged(r)) return false;
    if (args.view === 'disabled' && enabled) return false;

    if (!needle) return true;

    const label = (r.label ?? '').toString().toLowerCase();
    const id = (r.id ?? '').toString().toLowerCase();
    return label.includes(needle) || id.includes(needle);
  });
}

export function isMailTemplateView(value: string): value is MailTemplateView {
  return value === 'all' || value === 'changed' || value === 'disabled';
}

export function buildMailSettingsPayload(args: {
  mailerEnabled: boolean;
  storedMailerEnabled: boolean;
  languageId: string;
  storedLanguageId: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (args.mailerEnabled !== args.storedMailerEnabled) payload['mailer_enabled'] = args.mailerEnabled;
  if (args.languageId !== args.storedLanguageId) payload['language'] = Number(args.languageId);
  return payload;
}
