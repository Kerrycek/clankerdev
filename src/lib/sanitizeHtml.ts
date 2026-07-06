const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'br',
  'code',
  'em',
  'i',
  'li',
  'ol',
  'p',
  'small',
  'span',
  'strong',
  'ul',
]);

const DROP_WITH_CONTENT = new Set(['iframe', 'object', 'script', 'style', 'template']);

function isSafeHref(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  if (value.startsWith('#') || value.startsWith('?') || value.startsWith('/')) return true;

  try {
    const url = new URL(value, 'https://example.invalid');
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function unwrapElement(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;

  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }

  parent.removeChild(el);
}

function sanitizeElement(el: Element): void {
  const tag = el.tagName.toLowerCase();

  if (DROP_WITH_CONTENT.has(tag)) {
    el.remove();
    return;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    unwrapElement(el);
    return;
  }

  const rawHref = el.getAttribute('href') ?? '';
  const rawTarget = el.getAttribute('target') ?? '';

  for (const attr of Array.from(el.attributes)) {
    el.removeAttribute(attr.name);
  }

  if (tag !== 'a') return;

  if (!isSafeHref(rawHref)) return;

  el.setAttribute('href', rawHref.trim());
  el.setAttribute('rel', 'noopener noreferrer');

  if (rawTarget === '_blank') {
    el.setAttribute('target', '_blank');
  }
}

export function sanitizeNewsHtml(rawHtml: string): string {
  const raw = String(rawHtml ?? '');
  if (!raw.trim()) return '';

  if (typeof document === 'undefined') {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const template = document.createElement('template');
  template.innerHTML = raw;

  for (const node of Array.from(template.content.querySelectorAll('*'))) {
    sanitizeElement(node);
  }

  for (const node of Array.from(template.content.childNodes)) {
    if (node.nodeType === Node.COMMENT_NODE) node.remove();
  }

  return template.innerHTML;
}
