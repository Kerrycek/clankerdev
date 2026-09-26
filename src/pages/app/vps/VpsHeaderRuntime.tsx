import React from 'react';
import { Activity, Clock3, Cpu, Layers } from 'lucide-react';
import { useI18n } from '../../../app/i18n';
import type { Vps } from '../../../lib/api/vps';
import { formatDurationSeconds } from '../../../lib/format';

function nonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Use the same current VPS status fields as the legacy detail, never a history sample. */
export function VpsHeaderRuntime({ vps }: { vps: Vps }) {
  const { t } = useI18n();
  const running = vps.is_running === true;
  const load = [vps.loadavg1, vps.loadavg5, vps.loadavg15]
    .map((value) => nonNegative(value) ? value.toFixed(2) : '—');
  const stats = [
    { key: 'uptime', icon: Clock3, label: t('vps.overview.usage.uptime'), value: nonNegative(vps.uptime) ? formatDurationSeconds(vps.uptime) : '—' },
    { key: 'load', icon: Activity, label: t('vps.header.load'), value: load.every((value) => value === '—') ? '—' : load.join(' / ') },
    { key: 'processes', icon: Layers, label: t('vps.header.processes'), value: nonNegative(vps.process_count) && Number.isInteger(vps.process_count) ? String(vps.process_count) : '—' },
    { key: 'cpu', icon: Cpu, label: t('vps.header.cpu_usage'), value: nonNegative(vps.cpu_idle) && vps.cpu_idle <= 100 ? `${(100 - vps.cpu_idle).toFixed(2)} %` : '—' },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="vps.header.runtime">
      {stats.map(({ key, icon: Icon, label, value }) => (
        <div key={key} className="min-w-0 rounded-lg bg-surface-2 px-3 py-2.5" data-testid={`vps.header.runtime.${key}`}>
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {label}
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-fg">{running ? value : '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
