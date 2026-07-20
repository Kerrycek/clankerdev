import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

import { getRuntimeConfig } from '../../app/config';
import { useAuth } from '../../app/auth';
import { useI18n } from '../../app/i18n';
import { useUiSettings, type UiLanguagePreference } from '../../app/uiSettings';
import { clsx } from '../ui/clsx';
import { withRouterBasename, withSameOriginNextParam } from '../../lib/routerPaths';

type IdleCapableWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const LazyContextualHelpPanel = React.lazy(async () => {
  const mod = await import('./ContextualHelpPanel');
  return { default: mod.ContextualHelpPanel };
});

function DeferredPublicHelpPanel(props: { pathname: string; scope: 'public' }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return undefined;
    if (typeof window === 'undefined') {
      setReady(true);
      return undefined;
    }

    const win = window as IdleCapableWindow;
    let idleHandle: number | undefined;
    let timerHandle: number | undefined;

    const show = () => setReady(true);
    if (win.requestIdleCallback) idleHandle = win.requestIdleCallback(show, { timeout: 1500 });
    else timerHandle = window.setTimeout(show, 250);

    return () => {
      if (idleHandle !== undefined) win.cancelIdleCallback?.(idleHandle);
      if (timerHandle !== undefined) window.clearTimeout(timerHandle);
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <React.Suspense fallback={null}>
      <LazyContextualHelpPanel pathname={props.pathname} scope={props.scope} />
    </React.Suspense>
  );
}

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

function languageButtonClass(active: boolean): string {
  return clsx(
    'rounded-md px-2 py-1 text-xs font-semibold transition-colors',
    active ? 'bg-primary text-primary-contrast' : 'text-muted hover:bg-surface-2 hover:text-fg'
  );
}

function PublicLanguageSwitcher(props: {
  language: UiLanguagePreference;
  onSetLanguage: (language: UiLanguagePreference) => void;
  t: (key: string) => string;
}) {
  return (
    <div
      className="hidden items-center gap-1 rounded-lg border border-border bg-overlay-surface p-1 shadow-card sm:flex"
      aria-label={props.t('settings.language.label')}
      data-testid="public.language.switcher"
    >
      <button
        type="button"
        className={languageButtonClass(props.language === 'system')}
        onClick={() => props.onSetLanguage('system')}
        title={props.t('settings.language.system')}
        data-testid="public.language.system"
      >
        Auto
      </button>
      <button
        type="button"
        className={languageButtonClass(props.language === 'en')}
        onClick={() => props.onSetLanguage('en')}
        title={props.t('settings.language.en')}
        data-testid="public.language.en"
      >
        EN
      </button>
      <button
        type="button"
        className={languageButtonClass(props.language === 'cs')}
        onClick={() => props.onSetLanguage('cs')}
        title={props.t('settings.language.cs')}
        data-testid="public.language.cs"
      >
        CS
      </button>
    </div>
  );
}

function PublicLayoutInner() {
  const cfg = useMemo(() => getRuntimeConfig(), []);
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const i18n = useI18n();
  const ui = useUiSettings();
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

  useEffect(() => {
    if (!isLoggedIn) return;
    if (location.pathname !== '/') return;
    if (new URLSearchParams(location.search).get('session') === 'expired') return;

    navigate('/app', { replace: true });
  }, [isLoggedIn, location.pathname, location.search, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-bg">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-14 items-center gap-3">
            <NavLink to="/" className="font-semibold tracking-tight">
              vpsAdmin
            </NavLink>

            <nav className="hidden md:flex items-center gap-1" data-document-title-nav="section">
              <NavItem to="/">{i18n.t('public.nav.overview')}</NavItem>
              <NavItem to="/outages">{i18n.t('public.nav.outages')}</NavItem>
              <NavItem to="/security-advisories">{i18n.t('public.nav.security_advisories')}</NavItem>
            </nav>

            <div className="flex-1" />

            <PublicLanguageSwitcher language={ui.settings.language} onSetLanguage={ui.setLanguage} t={i18n.t} />

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
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {mobileOpen && (
            <div className="md:hidden pb-4">
              <div className="flex flex-col gap-1" data-document-title-nav="section">
                <NavItem to="/">{i18n.t('public.nav.overview')}</NavItem>
                <NavItem to="/outages">{i18n.t('public.nav.outages')}</NavItem>
                <NavItem to="/security-advisories">{i18n.t('public.nav.security_advisories')}</NavItem>
                <div className="mt-2 flex items-center gap-1 rounded-lg border border-border bg-overlay-surface p-1 shadow-card">
                  <button
                    type="button"
                    className={languageButtonClass(ui.settings.language === 'system')}
                    onClick={() => ui.setLanguage('system')}
                    title={i18n.t('settings.language.system')}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className={languageButtonClass(ui.settings.language === 'en')}
                    onClick={() => ui.setLanguage('en')}
                    title={i18n.t('settings.language.en')}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    className={languageButtonClass(ui.settings.language === 'cs')}
                    onClick={() => ui.setLanguage('cs')}
                    title={i18n.t('settings.language.cs')}
                  >
                    CS
                  </button>
                </div>
                <a
                  href={primaryHref}
                  className="mt-2 inline-flex items-center justify-center rounded-md border border-border bg-overlay-surface px-3 py-2 text-sm font-medium shadow-card hover:bg-surface-2"
                >
                  {primaryLabel}
                </a>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1" data-document-title-region>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
          <div className="space-y-6">
            <DeferredPublicHelpPanel pathname={location.pathname} scope="public" />
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
