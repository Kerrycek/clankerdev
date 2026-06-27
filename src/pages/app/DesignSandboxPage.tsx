// i18n-ignore-file: developer-only component gallery uses intentional sample copy.

import React, { useMemo, useState } from 'react';

import { useAuth } from '../../app/auth';
import { useAppMode } from '../../app/appMode';
import { useI18n } from '../../app/i18n';
import { useUiSettings } from '../../app/uiSettings';
import { useToasts } from '../../app/toasts';
import { isDesignSandboxEnabled } from '../../app/designSandbox';

import { PageContainer } from '../../components/layout/PageContainer';
import { PageHeader } from '../../components/layout/PageHeader';

import { NotFoundPage } from '../NotFoundPage';

import { ActionButton } from '../../components/ui/ActionButton';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Checkbox } from '../../components/ui/Checkbox';
import { CopyButton } from '../../components/ui/CopyButton';
import { Drawer } from '../../components/ui/Drawer';
import { GaugeRing } from '../../components/ui/GaugeRing';
import { Input } from '../../components/ui/Input';
import { KeysetPagination } from '../../components/ui/KeysetPagination';
import { LinkButton } from '../../components/ui/LinkButton';
import { LockBadge } from '../../components/ui/LockBadge';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Sparkline } from '../../components/ui/Sparkline';
import { TableCard } from '../../components/ui/TableCard';
import { Textarea } from '../../components/ui/Textarea';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { UsageBar } from '../../components/ui/UsageBar';

import { gateVpsAction } from '../../lib/gates/vps';
import { type Vps } from '../../lib/api/vps';
import { clsx } from '../../components/ui/clsx';

function Section(props: {
  testId: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card testId={props.testId}>
      <CardHeader title={props.title} subtitle={props.subtitle} />
      <CardBody>{props.children}</CardBody>
    </Card>
  );
}

function TokenSwatch(props: { label: string; swatchClassName: string; testId?: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-md border border-border bg-surface p-3"
      data-testid={props.testId}
    >
      <div className={clsx('h-8 w-8 rounded-md border border-border', props.swatchClassName)} />
      <div className="min-w-0">
        <div className="text-sm font-medium text-fg">{props.label}</div>
        <div className="text-xs text-muted">{props.swatchClassName}</div>
      </div>
    </div>
  );
}

function DemoVpsActionRow(props: {
  title: string;
  vps: Vps;
  busyTransaction?: boolean;
  busyLocal?: boolean;
  testId?: string;
}) {
  const { t } = useI18n();
  const start = gateVpsAction('start', { vps: props.vps, busyLocal: props.busyLocal, busyTransaction: props.busyTransaction });
  const stop = gateVpsAction('stop', { vps: props.vps, busyLocal: props.busyLocal, busyTransaction: props.busyTransaction });
  const restart = gateVpsAction('restart', { vps: props.vps, busyLocal: props.busyLocal, busyTransaction: props.busyTransaction });

  const running = (props.vps as LegacyAny).is_running;
  const runtimeLabel =
    running === true ? t('state.running') : running === false ? t('state.stopped') : t('state.unknown');
  const runtimeVariant = running === true ? 'ok' : running === false ? 'danger' : 'neutral';

  return (
    <div className="rounded-md border border-border bg-surface p-3" data-testid={props.testId}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-medium text-fg">{props.title}</div>
          <div className="mt-1">
            <Badge variant={runtimeVariant}>{runtimeLabel}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            size="sm"
            variant="secondary"
            disabled={!start.allowed}
            disabledReason={start.allowed ? undefined : start.reason}
          >
            {t('action.vps.start.label')}
          </ActionButton>
          <ActionButton
            size="sm"
            variant="secondary"
            disabled={!stop.allowed}
            disabledReason={stop.allowed ? undefined : stop.reason}
          >
            {t('action.vps.stop.label')}
          </ActionButton>
          <ActionButton
            size="sm"
            variant="secondary"
            disabled={!restart.allowed}
            disabledReason={restart.allowed ? undefined : restart.reason}
          >
            {t('action.vps.restart.label')}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export function DesignSandboxPage() {
  const auth = useAuth();
  const app = useAppMode();
  const ui = useUiSettings();
  const { t, lang } = useI18n();
  const toasts = useToasts();

  const enabled = isDesignSandboxEnabled();
  if (!enabled) {
    return <NotFoundPage appBasePath={app.basePath} />;
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [drawerLeft, setDrawerLeft] = useState(false);
  const [drawerRight, setDrawerRight] = useState(false);
  const [blockingOpen, setBlockingOpen] = useState(false);

  const series = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => ({
        x: new Date(Date.UTC(2026, 0, 1, 0, i * 2, 0)).toISOString(),
        y: 25 + 15 * Math.sin(i / 3) + (i % 7) * 0.6,
      })),
    []
  );

  const spark = useMemo(() => Array.from({ length: 24 }, (_, i) => 10 + Math.sin(i / 2) * 3 + (i % 5) * 0.4), []);

  const vpsRunning: Vps = useMemo(
    () => ({
      id: 101,
      hostname: 'demo-running.vpsfree.test',
      object_state: 'active',
      is_running: true,
      cpus: 2,
      memory: 2048,
      diskspace: 20480,
      node: { id: 1, domain_name: 'node1' },
    }) as LegacyAny,
    []
  );

  const vpsStopped: Vps = useMemo(
    () => ({
      id: 102,
      hostname: 'demo-stopped.vpsfree.test',
      object_state: 'active',
      is_running: false,
      cpus: 1,
      memory: 1024,
      diskspace: 10240,
      node: { id: 2, domain_name: 'node2' },
    }) as LegacyAny,
    []
  );

  const vpsUnknown: Vps = useMemo(
    () => ({
      id: 103,
      hostname: 'demo-unknown.vpsfree.test',
      object_state: 'active',
      is_running: null,
      cpus: 4,
      memory: 4096,
      diskspace: 40960,
      node: { id: 3, domain_name: 'node3' },
    }) as LegacyAny,
    []
  );

  const otherSandboxPath = app.mode === 'admin' ? '/app/_design' : '/admin/_design';
  const canSwitchShell = auth.canUseAdminUi;

  return (
    <PageContainer variant="wide">
      <div className="space-y-4" data-testid="design.page">
        <PageHeader
          testId="design.header"
          title="Design sandbox"
          description="Component gallery + visual regression surface."
          meta={
            <span>
              Theme: <span className="font-medium">{ui.settings.theme}</span> · Language:{' '}
              <span className="font-medium">{ui.settings.language}</span> · Shell:{' '}
              <span className="font-medium">{app.mode}</span>
            </span>
          }
          actions={
            canSwitchShell ? (
              <LinkButton to={otherSandboxPath} variant="secondary" size="sm" testId="design.switch_shell">
                Open {app.mode === 'admin' ? 'My view' : 'Admin'} sandbox
              </LinkButton>
            ) : null
          }
        />

        <Card testId="design.controls">
          <CardHeader
            title="Controls"
            subtitle="These controls modify UI settings without leaving the page (useful for reviews and E2E)."
          />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs text-muted">Theme</div>
                <div className="mt-1">
                  <Select
                    testId="design.controls.theme"
                    value={ui.settings.theme}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'system' || v === 'light' || v === 'dark') ui.setTheme(v);
                    }}
                    options={[
                      { value: 'system', label: 'System' },
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <div className="text-xs text-muted">Language</div>
                <div className="mt-1">
                  <Select
                    testId="design.controls.language"
                    value={ui.settings.language}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'system' || v === 'en' || v === 'cs') ui.setLanguage(v);
                    }}
                    options={[
                      { value: 'system', label: 'System' },
                      { value: 'en', label: 'English' },
                      { value: 'cs', label: 'Čeština' },
                    ]}
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">Resolved language</div>
                <div className="mt-1 text-xs text-muted">{lang}</div>
              </div>
            </div>

            <div
              className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted"
              data-testid="design.controls.summary"
              data-theme={ui.settings.theme}
              data-language={ui.settings.language}
            >
              {ui.settings.theme} · {ui.settings.language}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4" data-testid="design.sections">
          <Section
            testId="design.section.tokens"
            title="A. Tokens"
            subtitle="Verify semantic surfaces, typography colors, status colors and size tokens."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <TokenSwatch label="App background" swatchClassName="bg-bg" />
              <TokenSwatch label="Surface" swatchClassName="bg-surface" />
              <TokenSwatch label="Surface 2" swatchClassName="bg-surface-2" />
              <TokenSwatch label="Border" swatchClassName="bg-border" />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-sm font-medium text-fg">Text levels</div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="text-fg">Primary text (text-fg)</div>
                  <div className="text-muted">Secondary text (text-muted)</div>
                  <div className="text-faint">Tertiary text (text-faint)</div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-sm font-medium text-fg">Status colors</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="ok">OK</Badge>
                  <Badge variant="warn">Warn</Badge>
                  <Badge variant="danger">Danger</Badge>
                  <Badge variant="neutral">Neutral</Badge>
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-sm font-medium text-fg">Focus ring</div>
                <div className="mt-2">
                  <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 ring-2 ring-focus/35">
                    <span className="text-sm">ring-focus/35</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-sm font-medium text-fg">Drawer widths</div>
                <div className="mt-2 overflow-x-auto">
                  <div className="min-w-max space-y-2">
                    <div className="h-7 w-drawer-sm rounded bg-surface-2 px-2 py-1 text-xs text-muted">w-drawer-sm</div>
                    <div className="h-7 w-drawer-md rounded bg-surface-2 px-2 py-1 text-xs text-muted">w-drawer-md</div>
                    <div className="h-7 w-drawer-lg rounded bg-surface-2 px-2 py-1 text-xs text-muted">w-drawer-lg</div>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-sm font-medium text-fg">Table min widths</div>
                <div className="mt-2 space-y-2 overflow-x-auto">
                  <div className="min-w-table-sm rounded bg-surface-2 px-2 py-1 text-xs text-muted">min-w-table-sm</div>
                  <div className="min-w-table-md rounded bg-surface-2 px-2 py-1 text-xs text-muted">min-w-table-md</div>
                  <div className="min-w-table-lg rounded bg-surface-2 px-2 py-1 text-xs text-muted">min-w-table-lg</div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-sm font-medium text-fg">Console height</div>
                <div className="mt-2">
                  <div className="flex h-console items-center justify-center rounded-md bg-surface-2 text-xs text-muted">
                    h-console
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section
            testId="design.section.typography"
            title="B. Typography"
            subtitle="Verify scale, truncation and Czech wrapping."
          >
            <div className="space-y-4">
              <div>
                <div className="text-3xl font-semibold text-fg">Heading 1 – The quick brown fox</div>
                <div className="mt-2 text-2xl font-semibold text-fg">Heading 2 – jumps over the lazy dog</div>
                <div className="mt-2 text-xl font-semibold text-fg">Heading 3 – vpsAdmin WebUI Next</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-fg">
                    Body text: This sentence exists purely to verify readability and line height.
                  </div>
                  <div className="mt-2 text-sm text-muted">
                    Muted text: used for hints, secondary metadata and less important labels.
                  </div>
                  <div className="mt-2 text-xs text-faint">
                    Faint text: tertiary information. Should remain readable in both themes.
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-fg">Long Czech sample</div>
                  <div className="mt-2 text-sm text-muted">
                    Příliš žluťoučký kůň úpěl ďábelské ódy — dlouhá věta pro otestování zalamování a typografie.
                  </div>
                  <div className="mt-3 rounded-md border border-border bg-surface-2 p-2 font-mono text-xs text-muted">
                    mono: ssh root@198.51.100.10 -p 2222
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section
            testId="design.section.components"
            title="C. Core components"
            subtitle="Buttons, inputs, selects, checkboxes, alerts, modal & drawers."
          >
            <div className="space-y-5">
              <div data-testid="design.components.buttons">
                <div className="text-sm font-medium text-fg">Buttons</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="secondary" disabled>
                    Disabled
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2" data-testid="design.components.inputs">
                <div>
                  <div className="text-sm font-medium text-fg">Input</div>
                  <div className="mt-2 space-y-2">
                    <Input placeholder="Search…" />
                    <Input placeholder="Invalid…" className="border-danger-border" />
                    <Input placeholder="Disabled" disabled />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-fg">Select</div>
                  <div className="mt-2">
                    <Select
                      value="a"
                      onChange={() => undefined}
                      options={[
                        { value: 'a', label: 'Option A' },
                        { value: 'b', label: 'Option B' },
                        { value: 'c', label: 'Option C' },
                      ]}
                    />
                  </div>
                  <div className="mt-3 text-sm font-medium text-fg">Checkbox</div>
                  <div className="mt-2">
                    <Checkbox checked={true} onChange={() => undefined} label="Checked" description="Example checkbox" />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-fg">Textarea</div>
                <div className="mt-2">
                  <Textarea placeholder="Multiline input…" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2" data-testid="design.components.alerts">
                <Alert title="Info" variant="neutral">
                  Neutral alert.
                </Alert>
                <Alert title="Warning" variant="warn">
                  Warn alert.
                </Alert>
                <Alert title="Success" variant="ok">
                  OK alert.
                </Alert>
                <Alert title="Danger" variant="danger">
                  Danger alert.
                </Alert>
              </div>

              <div data-testid="design.components.modal_drawer">
                <div className="text-sm font-medium text-fg">Modal & drawers</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => setModalOpen(true)}>
                    Open modal
                  </Button>
                  <Button variant="secondary" onClick={() => setDrawerLeft(true)}>
                    Open drawer (left)
                  </Button>
                  <Button variant="secondary" onClick={() => setDrawerRight(true)}>
                    Open drawer (right)
                  </Button>
                </div>
              </div>

              <div data-testid="design.components.copy">
                <div className="text-sm font-medium text-fg">Copy button</div>
                <div className="mt-2 flex items-center gap-2">
                  <CopyButton text="ssh root@198.51.100.10" />
                  <span className="text-sm text-muted">ssh root@198.51.100.10</span>
                </div>
              </div>
            </div>
          </Section>

          <Section
            testId="design.section.states"
            title="D. States + locks"
            subtitle="Canonical lock widgets + action gating examples."
          >
            <div className="grid gap-3 md:grid-cols-3" data-testid="design.states.locks">
              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-sm font-medium text-fg">Transaction busy</div>
                <div className="mt-2">
                  <LockBadge kind="transaction" t={t} chainIds={[123, 124]} showDetails />
                </div>
              </div>
              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-sm font-medium text-fg">Local busy</div>
                <div className="mt-2">
                  <LockBadge kind="local" t={t} />
                </div>
              </div>
              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-sm font-medium text-fg">Maintenance</div>
                <div className="mt-2">
                  <LockBadge kind="maintenance" t={t} maintenanceReason="Kernel upgrade" />
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3" data-testid="design.states.actions">
              <DemoVpsActionRow title="VPS running" vps={vpsRunning} />
              <DemoVpsActionRow title="VPS stopped" vps={vpsStopped} />
              <DemoVpsActionRow title="VPS unknown runtime" vps={vpsUnknown} />
              <DemoVpsActionRow title="Blocked by transaction" vps={vpsRunning} busyTransaction />
              <DemoVpsActionRow title="Blocked locally" vps={vpsRunning} busyLocal />
            </div>
          </Section>

          <Section
            testId="design.section.tables"
            title="E. Tables + pagination"
            subtitle="Desktop table + pagination patterns (and a mobile-friendly card list preview)."
          >
            <TableCard
              testId="design.tables.tablecard"
              tableTestId="design.tables.table"
              minWidth="md"
              footer={
                <KeysetPagination
                  testId="design.tables.pagination"
                  page={3}
                  pageCount={9}
                  canPrev
                  canNext
                  onPrev={() => undefined}
                  onNext={() => undefined}
                  onGoToPage={() => undefined}
                  limit={50}
                  allowedLimits={[25, 50, 100]}
                  onLimitChange={() => undefined}
                />
              }
            >
              <thead className="bg-surface-2">
                <tr className="text-left text-xs text-muted">
                  <th className="px-3 py-2">Object</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr data-row-clickable="true" tabIndex={0}>
                  <td className="px-3 py-2 font-medium">demo01</td>
                  <td className="px-3 py-2"><Badge variant="ok">Active</Badge></td>
                  <td className="px-3 py-2"><UsageBar used={2.4} max={4} unit="vCPU" layout="row" /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">demo02</td>
                  <td className="px-3 py-2"><Badge variant="warn">Busy</Badge></td>
                  <td className="px-3 py-2"><UsageBar used={7.5} max={8} unit="GiB" layout="row" /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">demo03</td>
                  <td className="px-3 py-2"><Badge variant="danger">Error</Badge></td>
                  <td className="px-3 py-2"><UsageBar used={95} max={100} unit="%" layout="row" /></td>
                </tr>
              </tbody>
            </TableCard>

            <Card className="mt-4" testId="design.tables.raw_table_card">
              <CardBody>
                <div className="text-xs text-muted">
                  Raw <span className="font-mono">.table-list</span> table (parity with the Table primitive).
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm table-list" data-testid="design.tables.raw_table">
                    <thead className="bg-surface-2">
                      <tr className="text-left text-xs text-muted">
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="px-3 py-2 font-medium">#101</td>
                        <td className="px-3 py-2 text-right">1000</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium">#102</td>
                        <td className="px-3 py-2 text-right">9999</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>

            <div className="mt-4 grid gap-3 md:grid-cols-3" data-testid="design.tables.mobile_cards">
              {['demo01', 'demo02', 'demo03'].map((name) => (
                <Card key={name}>
                  <CardBody className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{name}</div>
                      <Badge variant="neutral">Card</Badge>
                    </div>
                    <div className="text-xs text-muted">Mobile-friendly summary layout.</div>
                    <UsageBar used={2} max={4} unit="GiB" layout="block" />
                  </CardBody>
                </Card>
              ))}
            </div>
          </Section>

          <Section
            testId="design.section.tasks"
            title="F. Tasks + notifications"
            subtitle="Deterministic task examples + toast and blocking modal demos."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-border bg-surface p-3" data-testid="design.tasks.examples">
                <div className="text-sm font-medium text-fg">Task examples</div>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Restart VPS</span>
                      <Badge variant="warn">Running</Badge>
                    </div>
                    <div className="mt-2 h-2 w-full rounded bg-surface-2">
                      <div className="h-2 rounded bg-accent" style={{ width: '65%' }} />
                    </div>
                    <div className="mt-1 text-xs text-muted">65%</div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Create snapshot</span>
                      <Badge variant="ok">Done</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted">Finished</div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Update DNS records</span>
                      <Badge variant="danger">Failed</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted">Permission denied</div>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface p-3" data-testid="design.tasks.demos">
                <div className="text-sm font-medium text-fg">Demos</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      toasts.push({
                        variant: 'ok',
                        title: 'Operation complete',
                        body: 'Your task finished successfully.',
                      })
                    }
                  >
                    Toast OK
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      toasts.push({
                        variant: 'danger',
                        title: 'Operation failed',
                        body: 'Something went wrong.',
                      })
                    }
                  >
                    Toast danger
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setBlockingOpen(true)}>
                    Blocking modal
                  </Button>
                </div>

                <div className="mt-3 text-xs text-muted">
                  Notes: in the real app, tasks are driven by tracked action states and the Tasks drawer.
                </div>
              </div>
            </div>
          </Section>

          <Section
            testId="design.section.visualization"
            title="G. Data visualization"
            subtitle="Usage bar, gauge ring, sparkline, time-series chart."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-border bg-surface p-3" data-testid="design.viz.usage">
                <div className="text-sm font-medium text-fg">UsageBar</div>
                <div className="mt-3 space-y-3">
                  <UsageBar used={3.2} max={8} unit="GiB" layout="block" />
                  <UsageBar used={7.5} max={8} unit="GiB" layout="block" />
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface p-3" data-testid="design.viz.gauge">
                <div className="text-sm font-medium text-fg">GaugeRing</div>
                <div className="mt-3 flex items-center gap-4">
                  <GaugeRing ratio={0.35} label="35%" />
                  <GaugeRing ratio={0.82} label="82%" />
                  <GaugeRing ratio={0.97} label="97%" />
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface p-3" data-testid="design.viz.sparkline">
                <div className="text-sm font-medium text-fg">Sparkline</div>
                <div className="mt-3 flex items-center gap-3">
                  <Sparkline ariaLabel="demo sparkline" points={spark} variant="accent" />
                  <div className="text-xs text-muted">24 points</div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface p-3" data-testid="design.viz.timeseries">
                <div className="text-sm font-medium text-fg">TimeSeriesChart</div>
                <div className="mt-3">
                  <TimeSeriesChart
                    testId="design.viz.timeseries.chart"
                    ariaLabel="demo time series"
                    points={series}
                    yMin={0}
                    yMax={100}
                    formatValue={(n) => `${n.toFixed(1)}%`}
                  />
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Demo modal"
        testId="design.modal"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setModalOpen(false);
                toasts.push({ variant: 'ok', title: 'Saved', body: 'This is a demo toast.' });
              }}
            >
              Save
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          This modal exists to exercise overlay, focus, spacing and footer layout.
        </p>
      </Modal>

      <Drawer
        open={drawerLeft}
        onClose={() => setDrawerLeft(false)}
        title="Demo drawer"
        side="left"
        width="md"
        testId="design.drawer.left"
        closeTestId="design.drawer.left.close"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerLeft(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">Drawer content.</p>
          <Input placeholder="Input inside drawer" />
          <Alert title="Hint" variant="neutral">
            Drawers must always have an explicit close button.
          </Alert>
        </div>
      </Drawer>

      <Drawer
        open={drawerRight}
        onClose={() => setDrawerRight(false)}
        title="Demo drawer"
        side="right"
        width="sm"
        testId="design.drawer.right"
        closeTestId="design.drawer.right.close"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">Right drawer content.</p>
          <div className="rounded-md border border-border bg-surface-2 p-2 text-xs text-muted">
            This is intentionally short to keep the sandbox stable.
          </div>
        </div>
      </Drawer>

      <Modal
        open={blockingOpen}
        onClose={() => setBlockingOpen(false)}
        title="Blocking action"
        testId="design.blocking_modal"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setBlockingOpen(false)}>
              Continue in background
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">This simulates a blocking progress surface.</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Progress</span>
              <span>42%</span>
            </div>
            <div className="h-2 w-full rounded bg-surface-2">
              <div className="h-2 rounded bg-accent" style={{ width: '42%' }} />
            </div>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
