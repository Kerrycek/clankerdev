// i18n-ignore-file
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { ConfirmDialog } from './ConfirmDialog';
import { Drawer } from './Drawer';
import { Modal } from './Modal';

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('ConfirmDialog', () => {
  it('keeps every cancellation path inert while confirmation is pending', () => {
    const onCancel = vi.fn();
    const renderDialog = (confirmLoading: boolean) => (
      <ConfirmDialog
        open
        title="Apply maintenance lock"
        confirmLabel="Lock"
        confirmLoading={confirmLoading}
        onCancel={onCancel}
        onConfirm={() => undefined}
        testId="confirm"
      />
    );

    const { rerender } = render(renderDialog(true));

    const dialog = screen.getByTestId('confirm');
    const cancel = screen.getByTestId('confirm.cancel');
    const backdrop = document.querySelector('[data-overlay-backdrop="true"]');

    expect(cancel).toBeDisabled();
    expect(backdrop).not.toBeNull();

    fireEvent.keyDown(cancel, { key: 'Escape' });
    fireEvent.click(backdrop!);
    fireEvent.click(cancel);

    expect(onCancel).not.toHaveBeenCalled();
    expect(dialog).toBeVisible();

    rerender(renderDialog(false));
    fireEvent.keyDown(screen.getByTestId('confirm.cancel'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('honors cancelDisabled and the legacy onClose callback', () => {
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Apply maintenance lock"
        cancelDisabled
        onClose={onClose}
        onConfirm={() => undefined}
        testId="confirm"
      />
    );

    fireEvent.keyDown(screen.getByTestId('confirm.cancel'), { key: 'Escape' });
    fireEvent.click(document.querySelector('[data-overlay-backdrop="true"]')!);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm')).toBeVisible();
  });

  it('honors the legacy loading alias', () => {
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Apply maintenance lock"
        loading
        onCancel={onCancel}
        onConfirm={() => undefined}
        testId="confirm"
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(document.querySelector('[data-overlay-backdrop="true"]')!);

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does not let pending Escape dismiss an underlying drawer', () => {
    const onCancel = vi.fn();
    const onDrawerClose = vi.fn();

    function PendingDialogInDrawer() {
      const [pending, setPending] = React.useState(false);

      return (
        <Drawer open title="Tasks" onClose={onDrawerClose} testId="tasks">
          <ConfirmDialog
            open
            title="Cancel task"
            confirmLoading={pending}
            onCancel={onCancel}
            onConfirm={() => setPending(true)}
            testId="confirm"
          />
        </Drawer>
      );
    }

    render(<PendingDialogInDrawer />);

    const confirm = screen.getByTestId('confirm.confirm');
    confirm.focus();
    fireEvent.click(confirm);

    expect(confirm).toBeDisabled();
    expect(document.activeElement).not.toBe(confirm);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(onCancel).not.toHaveBeenCalled();
    expect(onDrawerClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm')).toBeVisible();
    expect(screen.getByTestId('tasks')).toBeVisible();
  });

  it('lets a newer modal handle Escape while confirmation is pending', () => {
    const onCancel = vi.fn();
    const onNewerModalClose = vi.fn();

    render(
      <>
        <ConfirmDialog
          open
          title="Apply maintenance lock"
          confirmLoading
          onCancel={onCancel}
          onConfirm={() => undefined}
          testId="confirm"
        />
        <Modal open title="Command palette" onClose={onNewerModalClose} testId="palette">
          <button type="button">Search commands</button>
        </Modal>
      </>
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Search commands' }), { key: 'Escape' });

    expect(onNewerModalClose).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('closes a newer modal without dismissing a drawer around a pending confirmation', () => {
    const onCancel = vi.fn();
    const onDrawerClose = vi.fn();
    const onNewerModalClose = vi.fn();

    render(
      <>
        <Drawer open title="Tasks" onClose={onDrawerClose} testId="tasks">
          <ConfirmDialog
            open
            title="Cancel task"
            confirmLoading
            onCancel={onCancel}
            onConfirm={() => undefined}
            testId="confirm"
          />
        </Drawer>
        <Modal open title="Command palette" onClose={onNewerModalClose} testId="palette">
          <button type="button">Search commands</button>
        </Modal>
      </>
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Search commands' }), { key: 'Escape' });

    expect(onNewerModalClose).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onDrawerClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm')).toBeVisible();
    expect(screen.getByTestId('tasks')).toBeVisible();
  });

  it('allows cancellation when only confirmation is disabled', () => {
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Apply maintenance lock"
        confirmDisabled
        onCancel={onCancel}
        onConfirm={() => undefined}
        testId="confirm"
      />
    );

    expect(screen.getByTestId('confirm.confirm')).toBeDisabled();
    expect(screen.getByTestId('confirm.cancel')).toBeEnabled();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(document.querySelector('[data-overlay-backdrop="true"]')!);
    fireEvent.click(screen.getByTestId('confirm.cancel'));

    expect(onCancel).toHaveBeenCalledTimes(3);
  });
});
