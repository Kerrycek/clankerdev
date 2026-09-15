// i18n-ignore-file
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';

import { Button } from './Button';
import { LinkButton } from './LinkButton';

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
}

function renderInRouter(children: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      {children}
      <CurrentPath />
    </MemoryRouter>
  );
}

describe('Button link variants', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/start');
  });

  it('removes a disabled router button from tab order and blocks every activation path', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const parentClick = vi.fn();
    renderInRouter(
      <>
        <button type="button">Before</button>
        <div onClick={parentClick}>
          <Button to="/target" disabled tabIndex={0} onClick={onClick}>
            Disabled route
          </Button>
        </div>
        <button type="button">After</button>
      </>
    );

    const link = screen.getByRole('link', { name: 'Disabled route' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');
    expect(link).not.toHaveAttribute('href');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();

    link.focus();
    await user.keyboard('{Enter}');
    fireEvent.click(link);

    expect(onClick).not.toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/start');
  });

  it('treats loading router buttons as disabled links', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderInRouter(
      <Button to="/target" loading onClick={onClick}>
        Loading route
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Loading route' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');
    expect(link).not.toHaveAttribute('href');

    link.focus();
    await user.keyboard('{Enter}');
    fireEvent.click(link);

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/start');
  });

  it('blocks disabled anchors and the compatibility LinkButton', async () => {
    const user = userEvent.setup();
    const anchorClick = vi.fn();
    renderInRouter(
      <>
        <Button as="a" href="#target" disabled onClick={anchorClick}>
          Disabled anchor
        </Button>
        <LinkButton to="/compatibility-target" disabled>
          Disabled compatibility route
        </LinkButton>
      </>
    );

    const anchor = screen.getByRole('link', { name: 'Disabled anchor' });
    expect(anchor).toHaveAttribute('aria-disabled', 'true');
    expect(anchor).toHaveAttribute('tabindex', '-1');
    expect(anchor).not.toHaveAttribute('href');
    anchor.focus();
    await user.keyboard('{Enter}');
    fireEvent.click(anchor);

    const compatibilityLink = screen.getByRole('link', { name: 'Disabled compatibility route' });
    expect(compatibilityLink).toHaveAttribute('aria-disabled', 'true');
    expect(compatibilityLink).toHaveAttribute('tabindex', '-1');
    expect(compatibilityLink).not.toHaveAttribute('href');
    compatibilityLink.focus();
    await user.keyboard('{Enter}');
    fireEvent.click(compatibilityLink);

    expect(anchorClick).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(screen.getByTestId('current-path')).toHaveTextContent('/start');
  });

  it('keeps native disabled buttons natively inert', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Native action
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Native action' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps router-link semantics for an empty destination', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderInRouter(
      <>
        <Button to="" disabled>
          Disabled empty route
        </Button>
        <Button to="" onClick={onClick}>
          Enabled empty route
        </Button>
      </>
    );

    const disabledLink = screen.getByRole('link', { name: 'Disabled empty route' });
    expect(disabledLink).toHaveAttribute('aria-disabled', 'true');
    expect(disabledLink).toHaveAttribute('tabindex', '-1');
    expect(disabledLink).not.toHaveAttribute('href');

    const enabledLink = screen.getByRole('link', { name: 'Enabled empty route' });
    expect(enabledLink).toHaveAttribute('href', '/');
    await user.click(enabledLink);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('current-path')).toHaveTextContent('/');
  });

  it('preserves enabled router and anchor navigation and callbacks', async () => {
    const user = userEvent.setup();
    const routeClick = vi.fn();
    const anchorClick = vi.fn();
    renderInRouter(
      <>
        <Button to="/target" onClick={routeClick}>
          Enabled route
        </Button>
        <Button as="a" href="#target" onClick={anchorClick}>
          Enabled anchor
        </Button>
      </>
    );

    await user.click(screen.getByRole('link', { name: 'Enabled route' }));
    expect(routeClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('current-path')).toHaveTextContent('/target');

    await user.click(screen.getByRole('link', { name: 'Enabled anchor' }));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#target');
  });
});
