import React from 'react';
import { ExternalLink, MapPin } from 'lucide-react';

import { useI18n } from '../../../app/i18n';

export function googleMapsAddressUrl(address: unknown): string | null {
  const normalized = String(address ?? '').trim();
  if (!normalized) return null;

  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', normalized);
  return url.toString();
}

export function RequestAddressMapLink(props: { address: unknown; testId?: string }) {
  const { t } = useI18n();
  const address = String(props.address ?? '').trim();
  const href = googleMapsAddressUrl(address);

  if (!href) return <div className="text-sm">—</div>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('requests.detail.address_map.aria', { address })}
      data-testid={props.testId}
      className="group mt-1 flex max-w-xl items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 transition hover:border-accent/60 focus:outline-none focus:ring-2 focus:ring-focus/35"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        <MapPin className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block whitespace-pre-line text-sm font-medium text-fg">{address}</span>
        <span className="mt-0.5 block text-xs text-muted group-hover:text-accent">
          {t('requests.detail.address_map.open')}
        </span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-faint group-hover:text-accent" aria-hidden="true" />
    </a>
  );
}
