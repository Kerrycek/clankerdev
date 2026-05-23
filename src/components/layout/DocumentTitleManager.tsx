import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useI18n } from '../../app/i18n';
import { formatDocumentTitle, normalizeDocumentTitleText, pushUniqueDocumentTitlePart } from '../../lib/documentTitle';

const APP_NAME = 'vpsAdmin';

type HeadingKind = 'page' | 'object' | 'plain';

function titleScopeLabel(pathname: string, t: (key: string) => string): string | null {
  if (pathname.startsWith('/admin')) return t('settings.scope.all');
  if (pathname.startsWith('/app')) return t('settings.scope.mine');
  return null;
}

function activeLabelFromRoot(root: ParentNode): string {
  const activeEls = Array.from(root.querySelectorAll<HTMLElement>('[aria-current="page"]'));
  if (activeEls.length === 0) return '';

  const best = activeEls.reduce((currentBest, candidate) => {
    const currentHref = currentBest.getAttribute('href') ?? '';
    const candidateHref = candidate.getAttribute('href') ?? '';
    if (candidateHref.length > currentHref.length) return candidate;
    return currentBest;
  });

  return normalizeDocumentTitleText(best.textContent);
}

function collectTitleSnapshot(doc: Document): {
  overrideTitle: string | null;
  headingTitle: string | null;
  headingKind: HeadingKind;
  tabLabels: string[];
  sectionLabel: string | null;
} {
  const region = doc.querySelector<HTMLElement>('[data-document-title-region]') ?? doc.querySelector<HTMLElement>('main') ?? doc.body;

  const overrideEls = Array.from(region.querySelectorAll<HTMLElement>('[data-document-title-override]'));
  const overrideTitle = normalizeDocumentTitleText(overrideEls.at(-1)?.textContent);

  const titleRoots = Array.from(region.querySelectorAll<HTMLElement>('[data-document-title-root]'));
  const titleRoot = titleRoots.at(-1) ?? null;

  let headingKind: HeadingKind = 'plain';
  let headingTitle = '';

  if (titleRoot) {
    headingKind = titleRoot.dataset.documentTitleKind === 'object' ? 'object' : 'page';
    headingTitle = normalizeDocumentTitleText(titleRoot.querySelector<HTMLElement>('[data-document-title-heading]')?.textContent);
  } else {
    const headings = Array.from(region.querySelectorAll<HTMLElement>('h1'));
    headingTitle = normalizeDocumentTitleText(headings.at(-1)?.textContent);
  }

  const tabRoots = Array.from(region.querySelectorAll<HTMLElement>('[data-document-title-tabs]'));
  const tabLabels = tabRoots
    .map((root) => activeLabelFromRoot(root))
    .filter(Boolean)
    .reverse();

  const sectionRoots = Array.from(doc.querySelectorAll<HTMLElement>('[data-document-title-nav="section"]'));
  const sectionLabel = normalizeDocumentTitleText(sectionRoots.map((root) => activeLabelFromRoot(root)).filter(Boolean).at(-1));

  return {
    overrideTitle: overrideTitle || null,
    headingTitle: headingTitle || null,
    headingKind,
    tabLabels,
    sectionLabel: sectionLabel || null,
  };
}

function buildTitle(doc: Document, opts: { pathname: string; t: (key: string) => string }): string {
  const snapshot = collectTitleSnapshot(doc);
  const parts: string[] = [];

  if (snapshot.overrideTitle) {
    pushUniqueDocumentTitlePart(parts, snapshot.overrideTitle);
  } else {
    for (const tabLabel of snapshot.tabLabels) {
      pushUniqueDocumentTitlePart(parts, tabLabel);
    }

    pushUniqueDocumentTitlePart(parts, snapshot.headingTitle);

    if (!snapshot.headingTitle) {
      pushUniqueDocumentTitlePart(parts, snapshot.sectionLabel);
    } else if (snapshot.headingKind === 'object' && snapshot.tabLabels.length < 2) {
      pushUniqueDocumentTitlePart(parts, snapshot.sectionLabel);
    } else if (snapshot.headingKind === 'plain') {
      pushUniqueDocumentTitlePart(parts, snapshot.sectionLabel);
    }
  }

  return formatDocumentTitle(parts, APP_NAME, titleScopeLabel(opts.pathname, opts.t));
}

export function DocumentTitleManager() {
  const location = useLocation();
  const { lang, t } = useI18n();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let frame = 0;

    const apply = () => {
      frame = 0;
      document.title = buildTitle(document, {
        pathname: location.pathname,
        t,
      });
    };

    const schedule = () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }

      frame = window.requestAnimationFrame(apply);
    };

    schedule();

    const root = document.getElementById('root') ?? document.body;
    const observer = new MutationObserver(() => {
      schedule();
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-current', 'data-document-title-kind', 'hidden'],
    });

    return () => {
      observer.disconnect();
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [lang, location.hash, location.pathname, location.search, t]);

  return null;
}
