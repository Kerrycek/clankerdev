import React from 'react';
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
    { key: 'uptime', label: t('vps.overview.usage.uptime'), value: nonNegative(vps.uptime) ? formatDurationSeconds(vps.uptime) : '—' },
    { key: 'load', label: t('vps.header.load'), value: load.every((value) => value === '—') ? '—' : load.join(' / ') },
    { key: 'processes', label: t('vps.header.processes'), value: nonNegative(vps.process_count) && Number.isInteger(vps.process_count) ? String(vps.process_count) : '—' },
    { key: 'cpu', label: t('vps.header.cpu_usage'), value: nonNegative(vps.cpu_idle) && vps.cpu_idle <= 100 ? `${(100 - vps.cpu_idle).toFixed(2)} %` : '—' },
  ];

  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2" data-testid="vps.header.runtime">
      {stats.map(({ key, label, value }) => (
        <div key={key} className="min-w-0" data-testid={`vps.header.runtime.${key}`}>
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="text-sm font-medium tabular-nums text-fg">{running ? value : '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
