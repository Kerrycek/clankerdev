import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Grid2X2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { useI18n } from '../../app/i18n';
import { publicApiCall } from '../../lib/api/public';
import { nodeHeatmapUrl, type HeatmapNode } from '../../lib/nodeHeatmap';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

const Heatmaps = createContext<{
  baseUrl?: unknown;
  open: (url: string, name: string) => void;
}>({ open: () => {} });

/** The legacy webui plugin exposes this setting publicly (min_user_level: 0). */
export function NodeHeatmapProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const location = useLocation();
  const config = useQuery({
    queryKey: ['public', 'system_config', 'webui', 'goresheat_url'],
    queryFn: async () => (await publicApiCall<{ value?: unknown }>({
      path: '/system_configs/webui/goresheat_url',
    })).data,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const [selected, setSelected] = useState<{ url: string; name: string } | null>(null);
  const baseUrl = config.data?.value;

  useEffect(() => { setSelected(null); }, [location.pathname, baseUrl]);

  return (
    <Heatmaps.Provider value={{ baseUrl, open: (url, name) => setSelected({ url, name }) }}>
      {children}
      <Modal
        open={selected !== null}
        title={t('nodes.heatmap.title', { node: selected?.name ?? '' })}
        onClose={() => setSelected(null)}
        size="xl"
        mobileFullScreen
        testId="nodes.heatmap.modal"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            {selected ? (
              <Button href={selected.url} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm" testId="nodes.heatmap.external">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t('nodes.heatmap.external')}
              </Button>
            ) : null}
            <Button onClick={() => setSelected(null)} variant="secondary" size="sm" testId="nodes.heatmap.close">{t('common.close')}</Button>
          </div>
        }
      >
        {selected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t('nodes.heatmap.description')}</p>
            <iframe
              key={selected.url}
              src={selected.url}
              title={t('nodes.heatmap.title', { node: selected.name })}
              className="h-heatmap w-full rounded-lg border border-border bg-surface"
              referrerPolicy="no-referrer"
              data-testid="nodes.heatmap.frame"
            />
            <p className="text-xs text-muted">{t('nodes.heatmap.fallback')}</p>
          </div>
        ) : null}
      </Modal>
    </Heatmaps.Provider>
  );
}

export function useNodeHeatmapsAvailable(nodes: HeatmapNode[]): boolean {
  const { baseUrl } = useContext(Heatmaps);
  return nodes.some((node) => nodeHeatmapUrl(baseUrl, node) !== null);
}

export function NodeHeatmapButton({ node }: { node: HeatmapNode }) {
  const { t } = useI18n();
  const { baseUrl, open } = useContext(Heatmaps);
  const url = nodeHeatmapUrl(baseUrl, node);
  if (!url) return null;
  const name = node.fqdn as string;

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => open(url, name)}
      title={t('nodes.heatmap.title', { node: name })}
      ariaLabel={t('nodes.heatmap.title', { node: name })}
      testId={`nodes.heatmap.open.${name}`}
    >
      <Grid2X2 className="h-4 w-4 text-accent" aria-hidden="true" />
      {t('nodes.heatmap.action')}
    </Button>
  );
}
