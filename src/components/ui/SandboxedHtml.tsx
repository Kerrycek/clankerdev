import React, { useEffect, useMemo, useRef } from 'react';

import { staticT } from '../../lib/staticI18n';
import { clsx } from './clsx';

type SandboxedHtmlVariant = 'default' | 'helpBox';
type SandboxedHtmlTheme = 'light' | 'dark';

function isFullDocument(rawHtml: string): boolean {
  const trimmed = rawHtml.trim().toLowerCase();

  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('<html') ||
    trimmed.includes('<body')
  );
}

function buildDefaultSrcDoc(rawHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; }
  body {
    padding: 16px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    font-size: 14px;
    line-height: 1.45;
    background: #ffffff;
    color: #111827;
    word-break: break-word;
  }
  a { color: #2563eb; }
  pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
</style>
</head><body>${rawHtml}</body></html>`;
}

function buildHelpBoxSrcDoc(rawHtml: string, theme: SandboxedHtmlTheme): string {
  const palette =
    theme === 'dark'
      ? {
          text: '#dce7f5',
          strong: '#ffffff',
          muted: '#b0c0d6',
          link: '#ec8c35',
          linkHover: '#f2a35a',
          border: '#2a4463',
          shellBg: '#16273f',
          tableHeadBg: '#1f3959',
          quoteBg: '#152741',
          quoteBorder: '#406a95',
          codeBg: '#142339',
          codeText: '#f8fafc',
          inlineCodeBg: '#1f3959',
        }
      : {
          text: '#16273f',
          strong: '#16273f',
          muted: '#64748b',
          link: '#b75c13',
          linkHover: '#92400e',
          border: '#c8d3e3',
          shellBg: '#ffffff',
          tableHeadBg: '#e8eef7',
          quoteBg: '#eef4ff',
          quoteBorder: '#93c5fd',
          codeBg: '#f1f5fb',
          codeText: '#16273f',
          inlineCodeBg: '#f3f6fb',
        };

  const colorScheme = theme === 'dark' ? 'dark' : 'light';

  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: ${colorScheme}; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
  }
  body {
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    font-size: 14px;
    line-height: 1.6;
    color: ${palette.text};
    word-break: break-word;
    overflow-wrap: anywhere;
    background: transparent;
  }
  .helpbox-shell {
    padding: 16px 18px;
    background: ${palette.shellBg};
    border: 1px solid ${palette.border};
    border-radius: 12px;
  }
  .helpbox-shell > :first-child { margin-top: 0 !important; }
  .helpbox-shell > :last-child { margin-bottom: 0 !important; }
  h1, h2, h3, h4, h5, h6 {
    margin: 1.15em 0 0.6em;
    color: ${palette.strong};
    font-weight: 600;
    line-height: 1.25;
  }
  h1 { font-size: 1.25rem; }
  h2 { font-size: 1.125rem; }
  h3 { font-size: 1rem; }
  p, ul, ol, dl, pre, blockquote, table, hr {
    margin: 0 0 0.95em;
  }
  ul, ol {
    padding-left: 1.35rem;
  }
  li + li {
    margin-top: 0.35em;
  }
  a {
    color: ${palette.link};
    font-weight: 500;
    text-decoration: none;
    border-bottom: 1px solid ${palette.link};
  }
  a:hover {
    color: ${palette.linkHover};
    border-bottom-color: ${palette.linkHover};
  }
  strong, b {
    color: ${palette.strong};
    font-weight: 600;
  }
  small {
    color: ${palette.muted};
  }
  hr {
    border: 0;
    border-top: 1px solid ${palette.border};
  }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.92em;
    color: ${palette.codeText};
    background: ${palette.inlineCodeBg};
    border: 1px solid ${palette.border};
    border-radius: 6px;
    padding: 0.1rem 0.35rem;
  }
  pre {
    overflow: auto;
    padding: 12px 14px;
    background: ${palette.codeBg};
    border: 1px solid ${palette.border};
    border-radius: 10px;
  }
  pre code {
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
  }
  blockquote {
    margin-left: 0;
    padding: 12px 14px;
    background: ${palette.quoteBg};
    border-left: 3px solid ${palette.quoteBorder};
    border-radius: 10px;
    color: ${palette.muted};
  }
  img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    display: block;
    overflow-x: auto;
  }
  th, td {
    padding: 0.55rem 0.7rem;
    border: 1px solid ${palette.border};
    text-align: left;
    vertical-align: top;
  }
  th {
    background: ${palette.tableHeadBg};
    color: ${palette.strong};
    font-weight: 600;
  }
</style>
</head><body><div class="helpbox-shell">${rawHtml}</div></body></html>`;
}

function buildSrcDoc(rawHtml: string, opts: { variant: SandboxedHtmlVariant; theme: SandboxedHtmlTheme }): {
  srcDoc: string;
  fullDocument: boolean;
} {
  const raw = String(rawHtml ?? '');
  const fullDocument = isFullDocument(raw);

  if (fullDocument) {
    return {
      srcDoc: raw,
      fullDocument,
    };
  }

  return {
    srcDoc: opts.variant === 'helpBox' ? buildHelpBoxSrcDoc(raw, opts.theme) : buildDefaultSrcDoc(raw),
    fullDocument: false,
  };
}

/**
 * SandboxedHtml
 *
 * Renders HTML in an iframe sandbox so that untrusted content can be inspected safely.
 * We intentionally do NOT allow scripts.
 */
export function SandboxedHtml(props: {
  html: string;
  title?: string;
  className?: string;
  testId?: string;
  autoHeight?: boolean;
  maxAutoHeight?: number;
  variant?: SandboxedHtmlVariant;
  theme?: SandboxedHtmlTheme;
}) {
  const variant = props.variant ?? 'default';
  const theme = props.theme ?? 'light';
  const { srcDoc, fullDocument } = useMemo(
    () => buildSrcDoc(props.html, { variant, theme }),
    [props.html, theme, variant]
  );
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!props.autoHeight) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const resize = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;

        const contentHeight = Math.max(
          doc.body?.scrollHeight ?? 0,
          doc.documentElement?.scrollHeight ?? 0,
          96
        );
        const height = props.maxAutoHeight
          ? Math.max(96, Math.min(contentHeight + 2, props.maxAutoHeight))
          : contentHeight + 2;

        iframe.style.height = `${height}px`;
      } catch {
        // Ignore sizing failures; iframe will keep its fallback height.
      }
    };

    resize();
    iframe.addEventListener('load', resize);
    const timer = window.setTimeout(resize, 0);
    const delayedTimer = window.setTimeout(resize, 200);

    return () => {
      iframe.removeEventListener('load', resize);
      window.clearTimeout(timer);
      window.clearTimeout(delayedTimer);
    };
  }, [props.autoHeight, props.maxAutoHeight, srcDoc]);

  return (
    <iframe
      ref={iframeRef}
      data-testid={props.testId}
      title={props.title ?? staticT('common.html_preview')}
      // allow-same-origin lets us render srcDoc with predictable sizing/behavior while still disallowing scripts.
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      allow=""
      srcDoc={srcDoc}
      className={clsx(
        props.autoHeight
          ? 'min-h-24 w-full rounded-md'
          : 'h-96 w-full rounded-md',
        variant === 'helpBox' && !fullDocument
          ? 'border-0 bg-transparent'
          : 'border border-border bg-surface',
        props.className,
      )}
    />
  );
}
