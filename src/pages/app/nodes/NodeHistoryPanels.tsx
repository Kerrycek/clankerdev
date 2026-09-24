import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import {
  fetchNodeKernelEvidence, fetchNodeKernelHistory, fetchNodeKernelParameters,
  fetchNodeSoftwareVersions, fetchNodeSysctls, fetchNodeSystemHistory,
  type KernelHistoryEvent,
} from '../../../lib/api/nodeHistory';
import { formatMiB } from '../../../lib/format';
import { Badge } from '../../../components/ui/Badge';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { NodeHistoryTable } from './NodeHistoryTable';
import { formatNodeHistoryTime } from './nodeHistoryFormatting';

function useHistoryTime() {
  const { lang } = useI18n();
  const { user } = useAuth();
  return (value: string | null | undefined) => formatNodeHistoryTime(value, lang, user?.time_zone);
}

export const NODE_HISTORY_SECTIONS = ['kernel', 'system', 'parameters', 'sysctls', 'software'] as const;
export type NodeHistorySection = typeof NODE_HISTORY_SECTIONS[number];
export const NODE_HISTORY_DOC_IDS: Record<NodeHistorySection, string> = {
  kernel: 'node.kernel-history', system: 'node.system-history', parameters: 'node.kernel-parameters',
  sysctls: 'node.sysctls', software: 'node.software-versions',
};

function ObservedTime({ event }: { event: KernelHistoryEvent }) {
  const { t } = useI18n();
  const formatTime = useHistoryTime();
  if (event.effective_at) return <>{formatTime(event.effective_at)}</>;
  return <>{event.observed_after
    ? t('admin.node.history.observed_interval', { after: formatTime(event.observed_after), before: formatTime(event.observed_before) })
    : t('admin.node.history.observed_by', { time: formatTime(event.observed_before) })}</>;
}

function KernelParameters({ nodeId }: { nodeId: number }) {
  const { t } = useI18n();
  const auth = useAuth();
  const evidence = useQuery({
    queryKey: ['node-history', auth.user?.id, auth.role, nodeId, 'command-line'],
    queryFn: ({ signal }) => fetchNodeKernelEvidence(nodeId, signal), retry: false,
  });
  return <div className="space-y-4">
    <section className="min-w-0 rounded-lg border border-border p-4">
      <h2 className="mb-2 font-semibold">{t('admin.node.history.command_line')}</h2>
      {evidence.isError ? <ErrorState error={evidence.error} onRetry={() => { void evidence.refetch(); }} /> : evidence.isPending ? <LoadingState /> : (
        <code className="block whitespace-pre-wrap break-all">{evidence.data?.kernel_command_line ?? t('common.na')}</code>
      )}
    </section>
    <NodeHistoryTable nodeId={nodeId} section="parameters" load={fetchNodeKernelParameters} columns={[
      { label: 'admin.node.history.position', render: (row) => row.position },
      { label: 'admin.node.history.name', render: (row) => row.name },
      { label: 'admin.node.history.value', render: (row) => row.value ?? '—' },
    ]} />
  </div>;
}

export function NodeHistoryPanels({ nodeId, section }: { nodeId: number; section: NodeHistorySection }) {
  const { t } = useI18n();
  const formatTime = useHistoryTime();
  const auth = useAuth();
  // Enforce this at the data boundary as well as hiding navigation. Restricted
  // components must not mount or issue requests for member/support accounts.
  if (section !== 'kernel' && section !== 'system' && auth.role !== 'admin') return <ErrorState kindOverride="forbidden" />;
  const current = (value: boolean) => value ? <Badge variant="ok">{t('admin.node.history.current')}</Badge> : null;
  if (section === 'parameters') return <KernelParameters nodeId={nodeId} />;
  if (section === 'kernel') return <NodeHistoryTable nodeId={nodeId} section={section} load={fetchNodeKernelHistory} columns={[
    { label: 'admin.node.history.event', render: (row) => <div className="space-y-1"><div>{row.event_type === 'livepatch'
      ? t(`admin.node.history.livepatch.${row.livepatch_action === 'applied' || row.livepatch_action === 'removed' ? row.livepatch_action : 'changed'}`)
      : row.event_type === 'boot' || row.event_type === 'reported_release_change' ? t(`admin.node.history.event.${row.event_type}`) : row.event_type}</div>{current(row.current)}</div> },
    { label: 'admin.node.history.observed', render: (row) => <ObservedTime event={row} /> },
    { label: 'admin.node.history.booted_kernel', render: (row) => row.booted_release ?? '—' },
    { label: 'admin.node.history.reported_kernel', render: (row) => row.reported_release ?? '—' },
    { label: 'admin.node.history.source', render: (row) => row.source === 'node_report' || row.source === 'reconstructed_node_status' ? t(`admin.node.history.source.${row.source}`) : row.source },
    { label: 'admin.node.history.precision', render: (row) => ['exact', 'inferred', 'incomplete'].includes(row.confidence) ? t(`admin.node.history.precision.${row.confidence}`) : row.confidence },
  ]} />;
  if (section === 'system') return <NodeHistoryTable nodeId={nodeId} section={section} load={fetchNodeSystemHistory} columns={[
    { label: 'admin.node.history.period', render: (row) => <div>{t('admin.node.history.period_value', { first: formatTime(row.first_observed_at), last: formatTime(row.last_observed_at) })}{current(row.current)}</div> },
    { label: 'admin.node.history.cpus', render: (row) => row.cpus ?? '—' },
    { label: 'admin.node.history.memory', render: (row) => formatMiB(row.total_memory) },
    { label: 'admin.node.history.swap', render: (row) => formatMiB(row.total_swap) },
    { label: 'admin.node.history.cgroups', render: (row) => row.cgroup_version?.replace(/^cgroup_/, '') ?? '—' },
  ]} />;
  if (section === 'sysctls') return <NodeHistoryTable nodeId={nodeId} section={section} load={fetchNodeSysctls} columns={[
    { label: 'admin.node.history.name', render: (row) => row.name },
    { label: 'admin.node.history.configured', render: (row) => row.configured_value ?? t('admin.node.history.not_configured') },
    { label: 'admin.node.history.effective', render: (row) => row.available ? row.effective_value ?? t('common.na') : t('admin.node.history.unavailable') },
    { label: 'admin.node.history.result', render: (row) => <Badge variant={!row.available ? 'warn' : row.configured_value !== null && row.configured_value !== row.effective_value ? 'warn' : 'neutral'}>{t(!row.available ? 'admin.node.history.unavailable' : row.configured_value === null ? 'admin.node.history.not_configured' : row.configured_value === row.effective_value ? 'admin.node.history.matches' : 'admin.node.history.differs')}</Badge> },
  ]} />;
  return <NodeHistoryTable nodeId={nodeId} section={section} load={fetchNodeSoftwareVersions} columns={[
    { label: 'admin.node.history.component', render: (row) => row.component === 'system_configuration' ? t('admin.node.history.system_configuration') : row.component },
    { label: 'admin.node.history.generation', render: (row) => row.generation === 'booted' || row.generation === 'current' ? t(`admin.node.history.generation.${row.generation}`) : row.generation },
    { label: 'admin.node.history.version', render: (row) => row.version ?? '—' },
    { label: 'admin.node.history.revision', render: (row) => <><code>{row.revision ?? '—'}</code>{row.revision_dirty ? <Badge variant="warn">{t('admin.node.history.modified')}</Badge> : null}</> },
  ]} />;
}
