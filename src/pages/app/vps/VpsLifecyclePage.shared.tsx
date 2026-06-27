import React from "react";
import type { Location } from "../../../lib/api/infra";
import type { Node } from "../../../lib/api/nodes";
import type { IpAddress } from "../../../lib/api/ipAddresses";
import type { OsTemplate } from "../../../lib/api/osTemplates";
import type { Vps } from "../../../lib/api/vps";
import { formatMiB } from "../../../lib/format";
import { parseLookupIdLike } from "../../../lib/lookupInput";
export type CloneForm = {
  user: string;
  node: string;
  location: string;
  hostname: string;
  subdatasets: boolean;
  datasetPlans: boolean;
  resources: boolean;
  features: boolean;
  stop: boolean;
  confirm: boolean;
};
export type SwapForm = {
  targetVps: number | null;
  hostname: boolean;
  resources: boolean;
  expirations: boolean;
  confirm: boolean;
};
export type ReplaceForm = {
  node: string;
  expirationDate: string;
  start: boolean;
  reason: string;
  confirm: boolean;
};
export type TemplateForm = {
  osTemplate: string;
  autoUpdate: boolean;
  confirm: boolean;
};
export type BootForm = {
  osTemplate: string;
  mountRootDataset: boolean;
  mountpoint: string;
  confirm: boolean;
};
export type ReinstallForm = {
  osTemplate: string;
  confirm: boolean;
};
export type MigrateForm = {
  node: string;
  replaceIpAddresses: boolean;
  transferIpAddresses: boolean;
  scheduleMode: "now" | "maintenance" | "custom";
  finishWeekday: string;
  finishHour: string;
  stopOnError: boolean;
  cleanupData: boolean;
  noStart: boolean;
  skipStart: boolean;
  sendMail: boolean;
  reason: string;
  confirm: boolean;
};
export type DeleteForm = {
  lazy: boolean;
  confirm: boolean;
};
export type LifecycleActionKind = "lifetime" | "template" | "boot" | "reinstall" | "clone" | "swap" | "replace" | "migrate" | "delete";
export const lifecycleActionKinds = new Set<LifecycleActionKind>(["lifetime", "template", "boot", "reinstall", "clone", "swap", "replace", "migrate", "delete"]);
export function resourceId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  if (value && typeof value === "object") {
    const raw = (value as LegacyAny).id;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  }
  return null;
}
export function parseOptionalId(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = parseLookupIdLike(trimmed);
  if (n === null || !Number.isInteger(n) || n <= 0) throw new Error("invalid-id");
  return n;
}
export function parseRequiredId(raw: string): number {
  const n = parseOptionalId(raw);
  if (n === undefined) throw new Error("required-id");
  return n;
}
export function parseOptionalNonNegativeInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) throw new Error("invalid-id");
  return n;
}
export const migrateWeekdayOptions = [
  { value: "0", labelKey: "common.weekday.sun" },
  { value: "1", labelKey: "common.weekday.mon" },
  { value: "2", labelKey: "common.weekday.tue" },
  { value: "3", labelKey: "common.weekday.wed" },
  { value: "4", labelKey: "common.weekday.thu" },
  { value: "5", labelKey: "common.weekday.fri" },
  { value: "6", labelKey: "common.weekday.sat" },
] as const;
export const migrateHourOptions = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, "0")}:00`,
}));
export function defaultExpirationInput(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function toIsoDateTime(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  if (!Number.isFinite(d.getTime())) throw new Error("invalid-date");
  return d.toISOString();
}
export function Field(props: { label: React.ReactNode; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted">{props.label}</div>
      <div className="mt-1">{props.children}</div>
      {props.help ? <div className="mt-1 text-xs text-faint">{props.help}</div> : null}
    </label>
  );
}
export function templateLabel(tpl: OsTemplate): string {
  return String(tpl.label ?? tpl.name ?? `#${tpl.id}`);
}
export function locationLabel(location: Location): string {
  return String(location.label ?? location.description ?? location.domain ?? `#${location.id}`);
}
export function nodeLabel(vps: unknown): string {
  const node = vps && typeof vps === "object" ? (vps as LegacyAny).node : null;
  if (!node || typeof node !== "object") return "—";
  return String(node.domain_name ?? node.name ?? node.label ?? `#${resourceId(node) ?? ""}`).trim() || "—";
}
export function pickedNodeLabel(node: { id?: number; domain_name?: unknown; name?: unknown; fqdn?: unknown }): string {
  const name = String(node.domain_name ?? node.name ?? node.fqdn ?? "").trim();
  const id = typeof node.id === "number" && Number.isFinite(node.id) ? `#${node.id}` : "";
  if (name && id) return `${name} (${id})`;
  return name || id || "";
}
export function nodeLocation(node: Node | undefined): Location | undefined {
  const location = node?.location;
  return location && typeof location === "object" ? location : undefined;
}
export function ownerLabel(vps: unknown): string {
  const user = vps && typeof vps === "object" ? (vps as LegacyAny).user : null;
  if (!user || typeof user !== "object") return "—";
  return String(user.login ?? user.label ?? `#${resourceId(user) ?? ""}`).trim() || "—";
}
export function datasetLabel(vps: unknown): string {
  if (!vps || typeof vps !== "object") return "—";
  const dataset = (vps as LegacyAny).dataset ?? (vps as LegacyAny).root_dataset;
  if (typeof dataset === "string" && dataset.trim()) return dataset.trim();
  if (typeof dataset === "number" && Number.isFinite(dataset)) return `#${dataset}`;
  if (dataset && typeof dataset === "object") {
    return String(dataset.name ?? dataset.full_name ?? dataset.label ?? dataset.dataset ?? dataset.mountpoint ?? `#${resourceId(dataset) ?? ""}`).trim() || "—";
  }
  return "—";
}
export function stateLabel(vps: unknown): string {
  if (!vps || typeof vps !== "object") return "—";
  return String((vps as LegacyAny).object_state ?? "active").trim() || "active";
}
export function vpsLocationId(vps: unknown): number | null {
  if (!vps || typeof vps !== "object") return null;
  return resourceId((vps as LegacyAny).node?.location ?? (vps as LegacyAny).location);
}
export function vpsLocationLabel(vps: unknown): string {
  if (!vps || typeof vps !== "object") return "—";
  const location = (vps as LegacyAny).node?.location ?? (vps as LegacyAny).location;
  if (!location || typeof location !== "object") return vpsLocationId(vps) ? `#${vpsLocationId(vps)}` : "—";
  return String(location.label ?? location.description ?? location.domain ?? `#${resourceId(location) ?? ""}`).trim() || "—";
}
export function resourceSummary(vps: unknown): string {
  if (!vps || typeof vps !== "object") return "—";
  const row = vps as LegacyAny;
  const cpu = row.cpu ?? row.cpus;
  const parts = [typeof cpu === "number" ? `${cpu} vCPU` : null, row.memory !== undefined ? formatMiB(row.memory) : null, row.swap !== undefined ? `${formatMiB(row.swap)} swap` : null, row.diskspace !== undefined ? `${formatMiB(row.diskspace)} disk` : null].filter(Boolean);
  return parts.length ? parts.join(" / ") : "—";
}
export function looksLikeSwapCandidate(vps: Vps): boolean {
  const text = `${String(vps.hostname ?? "")} ${String((vps as LegacyAny).label ?? "")} ${vpsLocationLabel(vps)} ${nodeLabel(vps)}`.toLowerCase();
  return /\b(playground|pgnd|staging|stage|test|testing|dev)\b/.test(text);
}
export function swapCandidateReasonKeys(candidate: Vps, source: Vps, sourceNodeId: number | null, sourceLocationId: number | null): string[] {
  const reasons: string[] = [];
  if (looksLikeSwapCandidate(candidate)) reasons.push("vps.lifecycle.swap.candidate.reason.environment");
  if (resourceId(candidate.user) === resourceId(source.user)) reasons.push("vps.lifecycle.swap.candidate.reason.owner");
  if (resourceId(candidate.node) === sourceNodeId) reasons.push("vps.lifecycle.swap.candidate.reason.node");
  if (vpsLocationId(candidate) === sourceLocationId) reasons.push("vps.lifecycle.swap.candidate.reason.location");
  if (String(candidate.object_state ?? "active") === "active") reasons.push("vps.lifecycle.swap.candidate.reason.active");
  return reasons;
}
export function rankSwapCandidate(candidate: Vps, source: Vps, sourceNodeId: number | null, sourceLocationId: number | null): number {
  let score = 0;
  if (looksLikeSwapCandidate(candidate)) score += 50;
  if (resourceId(candidate.node) === sourceNodeId) score += 20;
  if (vpsLocationId(candidate) === sourceLocationId) score += 16;
  if (resourceId(candidate.user) === resourceId(source.user)) score += 10;
  if (String(candidate.object_state ?? "active") === "active") score += 4;
  return score;
}
export function locationEnvironmentId(location: Location | undefined): number | undefined {
  const nested = location?.environment?.id;
  if (typeof nested === "number" && Number.isFinite(nested)) return nested;
  const raw = location ? (location as LegacyAny).environment_id : undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  return undefined;
}
export function vpsLabel(vps: unknown, fallbackId?: number | null): string {
  if (vps && typeof vps === "object") {
    const row = vps as LegacyAny;
    const id = resourceId(row) ?? fallbackId;
    const hostname = row.hostname ? String(row.hostname) : "";
    if (hostname && id) return `${hostname} (#${id})`;
    if (hostname) return hostname;
    if (row.label && id) return `${String(row.label)} (#${id})`;
    if (row.label) return String(row.label);
    if (id) return `#${id}`;
  }
  return fallbackId ? `#${fallbackId}` : "—";
}
export function ipAddressText(ip: IpAddress): string {
  const addr = String(ip.addr ?? "").trim();
  const prefix = typeof ip.prefix === "number" ? `/${ip.prefix}` : "";
  const role = ip.network?.role || ip.network?.purpose;
  return `${addr || `#${ip.id}`}${prefix}${role ? ` · ${String(role)}` : ""}`;
}
export function IpList(props: { ips: IpAddress[] | undefined; loading: boolean; empty: string; loadingText: string; testId: string }) {
  if (props.loading) return <div className="text-sm text-muted">{props.loadingText}</div>;
  if (!props.ips?.length) return <div className="text-sm text-muted">{props.empty}</div>;
  return (
    <ul className="space-y-1 text-sm" data-testid={props.testId}>
      {props.ips.map((ip) => (
        <li key={ip.id} className="font-mono text-xs">
          {ipAddressText(ip)}
        </li>
      ))}
    </ul>
  );
}
export function CompactValueList(props: { values: string[]; empty: string; testId: string }) {
  if (!props.values.length)
    return (
      <span className="text-muted" data-testid={props.testId}>
        {props.empty}
      </span>
    );
  return (
    <span className="inline-flex flex-col gap-0.5" data-testid={props.testId}>
      {props.values.map((value) => (
        <span key={value} className="font-mono text-xs">
          {value}
        </span>
      ))}
    </span>
  );
}
export function ImpactItem(props: { label: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3" data-testid={props.testId}>
      <div className="text-xs font-medium text-muted">{props.label}</div>
      <div className="mt-1 text-sm">{props.children}</div>
    </div>
  );
}
export function LifecycleActionPanel(props: { kind: LifecycleActionKind; title: React.ReactNode; subtitle: React.ReactNode; danger?: boolean; open: boolean; openLabel: string; closeLabel: string; onToggle: (kind: LifecycleActionKind, open: boolean) => void; children: React.ReactNode }) {
  return (
    <details open={props.open} className="group rounded-lg border border-border bg-surface shadow-card" data-testid={`vps.lifecycle.action.${props.kind}`} onToggle={(e) => props.onToggle(props.kind, e.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-4 py-3 hover:bg-surface-2 [&::-webkit-details-marker]:hidden" data-testid={`vps.lifecycle.action.${props.kind}.toggle`}>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-fg">{props.title}</span>
          <span className="mt-0.5 block text-xs text-muted">{props.subtitle}</span>
        </span>
        <span className={["shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium", props.danger ? "border-danger-border text-danger" : "border-border text-muted"].join(" ")}>
          <span className="group-open:hidden">{props.openLabel}</span>
          <span className="hidden group-open:inline">{props.closeLabel}</span>
        </span>
      </summary>
      <div className="border-t border-border p-4">{props.children}</div>
    </details>
  );
}
export function mutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message && error.message !== "invalid-id" && error.message !== "required-id" && error.message !== "invalid-date") {
    return error.message;
  }
  return fallback;
}
