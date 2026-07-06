import { describe, expect, it } from 'vitest';

import type { UserMailRoleRecipient, UserMailTemplateRecipient } from '../../lib/api/userMail';

import {
  buildMailSettingsPayload,
  computeEffectiveRoleTo,
  computeEffectiveTemplateTo,
  filterMailTemplates,
  formatEmailsForTextarea,
  getUserLanguageId,
  isMailTemplateView,
  normalizeEmailsForApi,
} from './UserMailPreferencesModel';

describe('UserMailPreferencesModel', () => {
  it('normalizes e-mail textarea values for display and API payloads', () => {
    expect(formatEmailsForTextarea('a@example.test, b@example.test')).toBe('a@example.test,\nb@example.test');
    expect(normalizeEmailsForApi('a@example.test;\nb@example.test c@example.test')).toBe(
      'a@example.test,b@example.test,c@example.test'
    );
  });

  it('computes role and template recipient precedence', () => {
    const roles: UserMailRoleRecipient[] = [
      { id: 'account', to: 'billing@example.test' },
      { id: 'admin', to: '' },
    ];

    expect(computeEffectiveRoleTo({ role: roles[1]!, userEmail: 'primary@example.test' })).toEqual(['primary@example.test']);

    expect(
      computeEffectiveTemplateTo({
        template: { id: 'explicit', to: 'template@example.test', roles: 'account' },
        userEmail: 'primary@example.test',
        roleRecipients: roles,
      })
    ).toEqual({ source: 'template', to: ['template@example.test'], rolesUsed: [] });

    expect(
      computeEffectiveTemplateTo({
        template: { id: 'role', to: '', roles: 'account,admin' },
        userEmail: 'primary@example.test',
        roleRecipients: roles,
      })
    ).toEqual({ source: 'role', to: ['billing@example.test'], rolesUsed: ['account'] });

    expect(
      computeEffectiveTemplateTo({
        template: { id: 'disabled', enabled: false, roles: 'account' },
        userEmail: 'primary@example.test',
        roleRecipients: roles,
      })
    ).toEqual({ source: 'disabled', to: [], rolesUsed: [] });
  });

  it('filters templates by view and search text', () => {
    const templates: UserMailTemplateRecipient[] = [
      { id: 'welcome', label: 'Welcome', enabled: true },
      { id: 'quota', label: 'Quota warning', to: 'ops@example.test' },
      { id: 'maintenance', label: 'Maintenance', enabled: false },
    ];

    expect(filterMailTemplates({ templates, view: 'changed', needle: '' }).map((r) => r.id)).toEqual([
      'quota',
      'maintenance',
    ]);
    expect(filterMailTemplates({ templates, view: 'disabled', needle: '' }).map((r) => r.id)).toEqual(['maintenance']);
    expect(filterMailTemplates({ templates, view: 'all', needle: 'quo' }).map((r) => r.id)).toEqual(['quota']);
  });

  it('builds settings payloads only for changed fields', () => {
    expect(
      buildMailSettingsPayload({
        mailerEnabled: false,
        storedMailerEnabled: true,
        languageId: '2',
        storedLanguageId: '2',
      })
    ).toEqual({ mailer_enabled: false });

    expect(
      buildMailSettingsPayload({
        mailerEnabled: true,
        storedMailerEnabled: true,
        languageId: '3',
        storedLanguageId: '2',
      })
    ).toEqual({ language: 3 });
  });

  it('normalizes user language ids and template view values', () => {
    expect(getUserLanguageId({ language: { id: 42, code: 'cs' } })).toBe('42');
    expect(getUserLanguageId({ language: null })).toBe('');
    expect(isMailTemplateView('disabled')).toBe(true);
    expect(isMailTemplateView('other')).toBe(false);
  });
});
