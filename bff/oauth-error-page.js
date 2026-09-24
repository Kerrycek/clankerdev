'use strict';

const COPY = {
  cs: {
    lang: 'cs',
    title: 'Přihlášení se nezdařilo',
    message: 'Odpověď přihlašovací služby se nepodařilo dokončit. Zkuste se přihlásit znovu.',
    retry: 'Přihlásit znovu',
    status: 'Přejít na stav služeb',
  },
  en: {
    lang: 'en',
    title: 'Sign-in failed',
    message: 'The sign-in response could not be completed. Try signing in again.',
    retry: 'Sign in again',
    status: 'Go to service status',
  },
};

function preferredLanguage(value) {
  if (typeof value !== 'string') return 'en';

  let best;
  for (const [index, part] of value.split(',').entries()) {
    const [rawTag, ...parameters] = part.trim().split(';');
    const tag = rawTag.toLowerCase();
    let quality = 1;

    for (const parameter of parameters) {
      const match = parameter.trim().match(/^q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i);
      if (match) quality = Number(match[1]);
    }

    if (quality <= 0) continue;

    let language;
    if (tag === 'cs' || tag.startsWith('cs-')) language = 'cs';
    else if (tag === 'en' || tag.startsWith('en-') || tag === '*') language = 'en';
    else continue;

    if (!best || quality > best.quality || (quality === best.quality && index < best.index)) {
      best = { language, quality, index };
    }
  }

  return best?.language || 'en';
}

function setOAuthRecoverySecurityHeaders(res) {
  res.setHeader('cache-control', 'no-store, max-age=0');
  res.setHeader('pragma', 'no-cache');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('cross-origin-resource-policy', 'same-origin');
  res.setHeader(
    'content-security-policy',
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
}

function renderOAuthErrorPage(language) {
  const copy = COPY[language] || COPY.en;

  return `<!doctype html>
<html lang="${copy.lang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <title>vpsAdmin · ${copy.title}</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f3f6fb;
        color: #17233b;
      }
      * { box-sizing: border-box; }
      body {
        min-width: 0;
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        background: radial-gradient(circle at top, #ffffff 0, #f3f6fb 52%, #e9eef7 100%);
      }
      main {
        width: min(100%, 34rem);
        padding: clamp(1.5rem, 5vw, 2.5rem);
        border: 1px solid #d6deeb;
        border-radius: 1.25rem;
        background: #ffffff;
        box-shadow: 0 1.25rem 3.5rem rgb(23 35 59 / 12%);
        overflow-wrap: anywhere;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: .75rem;
        margin-bottom: 2rem;
        color: #3e4b62;
        font-weight: 700;
      }
      .brand-mark {
        display: grid;
        width: 2.5rem;
        height: 2.5rem;
        place-items: center;
        border-radius: .75rem;
        background: #f28c28;
        color: #17233b;
        font-size: .875rem;
      }
      .error-mark {
        display: grid;
        width: 3rem;
        height: 3rem;
        margin-bottom: 1.25rem;
        place-items: center;
        border-radius: 999px;
        background: #fee9e7;
        color: #b42318;
        font-size: 1.5rem;
        font-weight: 800;
      }
      h1 {
        margin: 0;
        font-size: clamp(1.6rem, 7vw, 2.25rem);
        line-height: 1.15;
        letter-spacing: -.025em;
      }
      p {
        margin: 1rem 0 0;
        color: #536078;
        font-size: 1rem;
        line-height: 1.65;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: .75rem;
        margin-top: 2rem;
      }
      a {
        min-height: 2.75rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: .75rem 1rem;
        border: 1px solid #c8d2e2;
        border-radius: .75rem;
        color: #17233b;
        font-weight: 700;
        line-height: 1.2;
        text-decoration: none;
      }
      a.primary {
        border-color: #f28c28;
        background: #f28c28;
      }
      a:hover { filter: brightness(.96); }
      a:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
      @media (max-width: 30rem) {
        body { padding: 1rem; }
        main { border-radius: 1rem; }
        .actions { flex-direction: column; }
        a { width: 100%; }
      }
      @media (prefers-color-scheme: dark) {
        :root { background: #101624; color: #f2f5fa; }
        body { background: radial-gradient(circle at top, #1e293b 0, #101624 58%, #0b101b 100%); }
        main { border-color: #354158; background: #182133; box-shadow: 0 1.25rem 3.5rem rgb(0 0 0 / 35%); }
        .brand, p { color: #bac5d7; }
        .brand-mark, a.primary { color: #17233b; }
        .error-mark { background: #4a1f24; color: #ffb4ab; }
        a { border-color: #536078; color: #f2f5fa; }
      }
      @media (prefers-reduced-motion: reduce) {
        * { scroll-behavior: auto !important; }
      }
    </style>
  </head>
  <body>
    <main aria-labelledby="oauth-error-title">
      <div class="brand"><span class="brand-mark" aria-hidden="true">VA</span><span>vpsAdmin</span></div>
      <div class="error-mark" aria-hidden="true">!</div>
      <h1 id="oauth-error-title">${copy.title}</h1>
      <p>${copy.message}</p>
      <nav class="actions" aria-label="${copy.title}">
        <a class="primary" href="/oauth/login?next=%2Fapp">${copy.retry}</a>
        <a href="/">${copy.status}</a>
      </nav>
    </main>
  </body>
</html>`;
}

module.exports = {
  preferredLanguage,
  renderOAuthErrorPage,
  setOAuthRecoverySecurityHeaders,
};
