// i18n-ignore-file
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  buildUserDataValidationHints,
  canSaveUserDataForm,
  MAX_USER_DATA_CONTENT_LEN,
  type UserDataFormState,
  userDataContentOverLimit,
} from './UserDataTemplatesModel';
import { UserDataTemplateEditorDrawer } from './UserDataTemplatesDrawers';

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

const formatOptions = [
  { value: '', label: 'All' },
  { value: 'script', label: 'Script' },
  { value: 'cloudinit_config', label: 'Cloud-init config' },
];

function EditorHarness(props: { initialForm?: UserDataFormState; mode?: 'create' | 'edit' }) {
  const [form, setForm] = React.useState<UserDataFormState>(
    props.initialForm ?? { label: 'Provision app', format: 'script', content: '#!/bin/sh' }
  );
  const contentOverLimit = userDataContentOverLimit(form.content);

  return (
    <UserDataTemplateEditorDrawer
      prefix="profile.user_data"
      open
      mode={props.mode ?? 'create'}
      form={form}
      setForm={setForm}
      formatOptions={formatOptions}
      validationHints={buildUserDataValidationHints(form)}
      hintKey={null}
      contentOverLimit={contentOverLimit}
      canSave={canSaveUserDataForm(form)}
      busy={false}
      createPending={false}
      updatePending={false}
      onClose={vi.fn()}
      onCreate={vi.fn()}
      onUpdate={vi.fn()}
    />
  );
}

function describedElements(control: HTMLElement): HTMLElement[] {
  return (control.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => Boolean(element));
}

describe('UserDataTemplateEditorDrawer accessibility', () => {
  it('associates every visible field label and help text with a unique control', async () => {
    const user = userEvent.setup();
    render(<EditorHarness />);

    const labelInput = screen.getByRole('textbox', { name: 'user_data.fields.label' });
    const formatSelect = screen.getByRole('combobox', { name: 'user_data.fields.format' });
    const contentTextarea = screen.getByRole('textbox', { name: 'user_data.fields.content' });

    const ids = [labelInput.id, formatSelect.id, contentTextarea.id];
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(3);

    expect(describedElements(labelInput)).toHaveLength(1);
    expect(describedElements(labelInput)[0]).toHaveTextContent('user_data.help.label');
    expect(describedElements(formatSelect)).toHaveLength(1);
    expect(describedElements(formatSelect)[0]).toHaveTextContent('user_data.help.format');
    expect(describedElements(contentTextarea)).toHaveLength(1);
    expect(describedElements(contentTextarea)[0]).toHaveTextContent(
      `user_data.help.content_len 9 ${MAX_USER_DATA_CONTENT_LEN}`
    );

    await user.click(screen.getByText('user_data.fields.label', { selector: 'label' }));
    expect(labelInput).toHaveFocus();
    await user.click(screen.getByText('user_data.fields.format', { selector: 'label' }));
    expect(formatSelect).toHaveFocus();
    await user.click(screen.getByText('user_data.fields.content', { selector: 'label' }));
    expect(contentTextarea).toHaveFocus();

    await user.clear(labelInput);
    await user.type(labelInput, 'Updated label');
    expect(labelInput).toHaveValue('Updated label');
  });

  it('links an over-limit value to one atomic live status without duplicating live regions', () => {
    render(
      <EditorHarness
        initialForm={{
          label: 'Provision app',
          format: 'script',
          content: 'x'.repeat(MAX_USER_DATA_CONTENT_LEN + 1),
        }}
      />
    );

    const contentTextarea = screen.getByRole('textbox', { name: 'user_data.fields.content' });
    const descriptions = describedElements(contentTextarea);
    const status = screen.getByRole('status');

    expect(contentTextarea).toHaveAttribute('aria-invalid', 'true');
    expect(descriptions).toHaveLength(2);
    expect(descriptions[0]).toHaveTextContent(
      `user_data.help.content_len ${MAX_USER_DATA_CONTENT_LEN + 1} ${MAX_USER_DATA_CONTENT_LEN}`
    );
    expect(descriptions[1]).toBe(status);
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).toHaveTextContent('common.error: user_data.validation.content_max');
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(0);
    expect(screen.getByTestId('profile.user_data.editor.create')).toBeDisabled();
  });

  it('keeps editor fields and footer actions at least 44px high on narrow screens', () => {
    render(<EditorHarness mode="edit" />);

    expect(screen.getByTestId('profile.user_data.editor.label')).toHaveClass('min-h-11', 'sm:min-h-9');
    expect(screen.getByTestId('profile.user_data.editor.format')).toHaveClass('min-h-11', 'sm:min-h-9');
    expect(screen.getByRole('button', { name: 'common.cancel' })).toHaveClass('min-h-11', 'sm:min-h-9');
    expect(screen.getByTestId('profile.user_data.editor.save')).toHaveClass('min-h-11', 'sm:min-h-9');
  });
});
