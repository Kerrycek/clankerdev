import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

import { getRuntimeConfig } from '../../app/config';
import { useAuth } from '../../app/auth';
import { useI18n } from '../../app/i18n';
import { clsx } from '../ui/clsx';
import { withRouterBasename, withSameOriginNextParam } from '../../lib/routerPaths';
import { ContextualHelpPanel } from './ContextualHelpPanel';
import { SkipLink } from './SkipLink';

function NavItem(props: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) =>
        clsx(
          'rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg'
        )
      }
    >
      {props.children}
    </NavLink>
  );
}

function PublicLayoutInner() {
  const cfg = useMemo(() => getRuntimeConfig(), []);
  const location = useLocation();
  const auth = useAuth();
  const i18n = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const appHref = withRouterBasename('/app', cfg.routerBasename);

  const loginHref = useMemo(() => {
    const base = cfg.loginUrl ?? withRouterBasename('/oauth/login', cfg.routerBasename);
    return withSameOriginNextParam(base, appHref);
  }, [cfg.loginUrl, cfg.routerBasename, appHref]);

  const isLoggedIn = auth.status === 'authenticated';
  const primaryHref = isLoggedIn ? appHref : loginHref;
  const primaryLabel = isLoggedIn ? i18n.t('public.primary.back_to_app') : i18n.t('public.primary.log_in');

  return (
    <div className="min-h-screen flex flex-col">
      <SkipLink targetId="public-main-content" label={i18n.t('accessibility.skip_to_content')} />
      <header className="sticky top-0 z-30 border-b border-border bg-bg">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-14 items-center gap-3">
            <NavLink to="/" className="font-semibold tracking-tight">
              vpsAdmin
            </NavLink>

            <nav className="hidden md:flex items-center gap-1" aria-label={i18n.t('accessibility.primary_navigation')} data-document-title-nav="section">
              <NavItem to="/">{i18n.t('public.nav.overview')}</NavItem>
              <NavItem to="/outages">{i18n.t('public.nav.outages')}</NavItem>
              <NavItem to="/security-advisories">{i18n.t('public.nav.security')}</NavItem>
              <NavItem to="/news">{i18n.t('public.nav.news')}</NavItem>
            </nav>

            <div className="flex-1" />

            <a
              href={primaryHref}
              className="hidden md:inline-flex items-center rounded-md border border-border bg-overlay-surface px-3 py-2 text-sm font-medium shadow-card hover:bg-surface-2"
            >
              {primaryLabel}
            </a>

            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-md border border-border bg-overlay-surface p-2 shadow-card hover:bg-surface-2"
              aria-label={mobileOpen ? i18n.t('public.menu.close') : i18n.t('public.menu.open')}
              aria-controls="public-mobile-navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {mobileOpen && (
            <div className="md:hidden pb-4">
              <nav id="public-mobile-navigation" className="flex flex-col gap-1" aria-label={i18n.t('accessibility.primary_navigation')} data-document-title-nav="section">
                <NavItem to="/">{i18n.t('public.nav.overview')}</NavItem>
                <NavItem to="/outages">{i18n.t('public.nav.outages')}</NavItem>
                <NavItem to="/security-advisories">{i18n.t('public.nav.security')}</NavItem>
                <NavItem to="/news">{i18n.t('public.nav.news')}</NavItem>
                <a
                  href={primaryHref}
                  className="mt-2 inline-flex items-center justify-center rounded-md border border-border bg-overlay-surface px-3 py-2 text-sm font-medium shadow-card hover:bg-surface-2"
                >
                  {primaryLabel}
                </a>
              </nav>
            </div>
          )}
        </div>
      </header>

      <main
        id="public-main-content"
        className="flex-1 outline-none"
        data-document-title-region
        tabIndex={-1}
        aria-label={i18n.t('accessibility.main_region')}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
          <div className="space-y-6">
            <ContextualHelpPanel pathname={location.pathname} scope="public" />
            <Outlet />
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 text-xs text-muted">
          {i18n.t('public.footer.prototype')}
        </div>
      </footer>
    </div>
  );
}

export function PublicLayout() {
  return <PublicLayoutInner />;
}
