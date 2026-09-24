import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAppMode } from '../../../app/appMode';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { fetchNode } from '../../../lib/api/nodes';
import { DetailShell } from '../../../components/layout/DetailShell';
import { ObjectHeader } from '../../../components/ui/ObjectHeader';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { NODE_HISTORY_DOC_IDS, NODE_HISTORY_SECTIONS, NodeHistoryPanels, type NodeHistorySection } from './NodeHistoryPanels';

export function NodeHistoryPage() {
  const { nodeId: rawId } = useParams();
  const nodeId = Number(rawId);
  const { basePath, mode } = useAppMode();
  const auth = useAuth();
  const { t } = useI18n();
  const [params] = useSearchParams();
  const requested = params.get('section') ?? 'kernel';
  const section = NODE_HISTORY_SECTIONS.includes(requested as NodeHistorySection) ? requested as NodeHistorySection : null;
  const restricted = section !== null && section !== 'kernel' && section !== 'system' && auth.role !== 'admin';
  const valid = Number.isSafeInteger(nodeId) && nodeId > 0;
  const node = useQuery({
    queryKey: ['node-history', auth.user?.id, auth.role, nodeId, 'node'],
    queryFn: async () => (await fetchNode(nodeId)).data,
    enabled: valid && !restricted, retry: false,
  });
  if (!valid || !section) return <ErrorState kindOverride="not_found" />;
  if (restricted) return <ErrorState kindOverride="forbidden" />;
  return <DetailShell variant="wide" testId="node.history.page">
    <ObjectHeader title={node.data?.domain_name ?? node.data?.name ?? `#${nodeId}`}
      kicker={<Link className="underline" to={mode === 'admin' ? `${basePath}/nodes/${nodeId}` : `${basePath}/nodes`}>{t('nav.nodes')}</Link>} />
    <nav aria-label={t('admin.node.history.navigation')} className="flex flex-wrap gap-2">
      {NODE_HISTORY_SECTIONS.filter((value) => auth.role === 'admin' || value === 'kernel' || value === 'system').map((value) => (
        <Link key={value} to={`?section=${value}`} aria-current={section === value ? 'page' : undefined}
          data-vpsadmin-doc-id={NODE_HISTORY_DOC_IDS[value]}
          className={`rounded-lg border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${section === value ? 'border-primary bg-surface-2 font-semibold' : 'border-border'}`}>
          {t(`admin.node.history.section.${value}`)}
        </Link>
      ))}
    </nav>
    <h2 className="text-lg font-semibold">{t(`admin.node.history.section.${section}`)}</h2>
    {node.isError ? <ErrorState error={node.error} onRetry={() => { void node.refetch(); }} /> : node.isPending ? <LoadingState /> : (
      <NodeHistoryPanels key={`${auth.user?.id}:${auth.role}:${nodeId}:${section}`} nodeId={nodeId} section={section} />
    )}
  </DetailShell>;
}
