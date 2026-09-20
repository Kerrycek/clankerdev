// i18n-ignore-file
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MailRoleRecipientsTable, MailTemplateRecipientsCard } from './UserMailRecipientsTables';

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
  pushToast: vi.fn(),
  updateRole: vi.fn(),
  updateTemplate: vi.fn(),
}));

const translations: Record<string, string> = {
  'mail.prefs.roles.copy_aria': 'Copy effective recipients for role {recipient}',
  'mail.prefs.roles.reset_aria': 'Reset recipient override for role {recipient}',
  'mail.prefs.roles.save_aria': 'Save recipient override for role {recipient}',
  'mail.prefs.roles.to_aria': 'Override recipients for role {recipient}',
  'mail.prefs.templates.copy_aria': 'Copy effective recipients for template {recipient}',
  'mail.prefs.templates.reset_aria': 'Reset recipient override for template {recipient}',
  'mail.prefs.templates.save_aria': 'Save recipient override for template {recipient}',
  'mail.prefs.templates.search.label': 'Search templates',
  'mail.prefs.templates.to_aria': 'Override recipients for template {recipient}',
  'mail.prefs.templates.view.label': 'Template view',
};

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      (translations[key] ?? key).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(vars ?? {}, name) ? String(vars?.[name]) : match
      ),
  }),
}));

vi.mock('../../app/toasts', () => ({
  useToasts: () => ({ pushToast: mocks.pushToast }),
}));

vi.mock('../../lib/api/userMail', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/api/userMail')>();
  return {
    ...original,
    updateUserMailRoleRecipient: mocks.updateRole,
    updateUserMailTemplateRecipient: mocks.updateTemplate,
  };
});

vi.mock('../../lib/clipboard', () => ({
  copyTextToClipboard: mocks.copy,
}));

const roleRecipients = [
  {
    id: 'account',
    label: 'Account messages',
    description: 'Messages related to the account.',
    to: 'account@example.test',
  },
  {
    id: 'billing',
    label: 'Billing messages',
    description: 'Messages related to billing.',
    to: 'billing@example.test',
  },
];

const templates = [
  {
    id: 'vps_created',
    label: 'VPS created',
    description: 'Sent after a VPS has been created.',
    roles: 'account',
    to: 'created@example.test',
    enabled: true,
  },
  {
    id: 'vps_deleted',
    label: 'VPS deleted',
    description: 'Sent after a VPS has been deleted.',
    roles: 'account',
    to: 'deleted@example.test',
    enabled: true,
  },
];

function renderTables() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MailRoleRecipientsTable
        userId={9}
        userEmail="primary@example.test"
        roleRecipients={roleRecipients}
        isLoading={false}
        isError={false}
        error={null}
        onRetry={vi.fn()}
      />
      <MailTemplateRecipientsCard
        userId={9}
        userEmail="primary@example.test"
        roleRecipients={roleRecipients}
        templates={templates}
        isLoading={false}
        isError={false}
        error={null}
        onRetry={vi.fn()}
        needle=""
        onNeedleChange={vi.fn()}
        view="all"
        onViewChange={vi.fn()}
      />
    </QueryClientProvider>
  );
}

describe('UserMailRecipientsTables accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.copy.mockResolvedValue(true);
    mocks.updateRole.mockResolvedValue({ data: roleRecipients[0] });
    mocks.updateTemplate.mockResolvedValue({ data: templates[0] });
  });

  it('gives filters and every repeated row control a recipient-specific name', () => {
    renderTables();

    expect(screen.getByRole('textbox', { name: 'Search templates' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Template view' })).toBeVisible();

    const accountTextarea = screen.getByRole('textbox', {
      name: 'Override recipients for role Account messages (account)',
    });
    const billingTextarea = screen.getByRole('textbox', {
      name: 'Override recipients for role Billing messages (billing)',
    });
    expect(accountTextarea).toHaveAccessibleDescription('Messages related to the account.');
    expect(billingTextarea).toHaveAccessibleDescription('Messages related to billing.');

    expect(
      screen.getByRole('button', { name: 'Save recipient override for role Account messages (account)' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Save recipient override for role Billing messages (billing)' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Copy effective recipients for role Account messages (account)' })
    ).toHaveTextContent('common.copy');
    expect(
      screen.getByRole('button', { name: 'Copy effective recipients for role Billing messages (billing)' })
    ).toHaveTextContent('common.copy');

    const createdTextarea = screen.getByRole('textbox', {
      name: 'Override recipients for template VPS created (vps_created)',
    });
    const deletedTextarea = screen.getByRole('textbox', {
      name: 'Override recipients for template VPS deleted (vps_deleted)',
    });
    expect(createdTextarea).toHaveAccessibleDescription('Sent after a VPS has been created.');
    expect(deletedTextarea).toHaveAccessibleDescription('Sent after a VPS has been deleted.');
    expect(
      screen.getByRole('button', { name: 'Copy effective recipients for template VPS created (vps_created)' })
    ).toHaveTextContent('common.copy');
    expect(
      screen.getByRole('button', { name: 'Copy effective recipients for template VPS deleted (vps_deleted)' })
    ).toHaveTextContent('common.copy');
  });

  it('keeps save and reset actions scoped to the edited recipient', async () => {
    renderTables();

    const accountTextarea = screen.getByRole('textbox', {
      name: 'Override recipients for role Account messages (account)',
    });
    fireEvent.change(accountTextarea, { target: { value: 'next-account@example.test' } });

    const accountReset = screen.getByRole('button', {
      name: 'Reset recipient override for role Account messages (account)',
    });
    expect(accountReset).toBeEnabled();
    fireEvent.click(accountReset);
    expect(accountTextarea).toHaveValue('account@example.test');

    fireEvent.change(accountTextarea, { target: { value: 'next-account@example.test' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save recipient override for role Account messages (account)' })
    );
    await waitFor(() =>
      expect(mocks.updateRole).toHaveBeenCalledWith(9, 'account', { to: 'next-account@example.test' })
    );

    const createdTextarea = screen.getByRole('textbox', {
      name: 'Override recipients for template VPS created (vps_created)',
    });
    fireEvent.change(createdTextarea, { target: { value: 'next-template@example.test' } });
    expect(
      screen.getByRole('button', { name: 'Reset recipient override for template VPS created (vps_created)' })
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Save recipient override for template VPS created (vps_created)' })
    );
    await waitFor(() =>
      expect(mocks.updateTemplate).toHaveBeenCalledWith(9, 'vps_created', {
        enabled: true,
        to: 'next-template@example.test',
      })
    );
  });
});
