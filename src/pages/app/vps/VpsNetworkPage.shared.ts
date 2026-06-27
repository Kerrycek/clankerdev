import type { IpAddress } from "../../../lib/api/ipAddresses";
import type { HostIpAddress } from "../../../lib/api/networking";
import type { NetworkInterfaceAccounting } from "../../../lib/api/networkInterfaces";
export function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null) return "—";
  const b = Math.max(0, bytes);
  if (b < 1024) return `${b} B`;
  const kib = b / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(1)} MiB`;
  const gib = mib / 1024;
  if (gib < 1024) return `${gib.toFixed(2)} GiB`;
  const tib = gib / 1024;
  return `${tib.toFixed(2)} TiB`;
}
export function formatMbpsFromBytesPerSec(value: number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  // Legacy webui treats max_tx/max_rx as bytes/s and displays MiB/s labelled as Mbps.
  // Keep the same arithmetic to avoid surprises.
  return `${Math.round(value / 1024 / 1024)} Mbps`;
}
export function groupIpByInterface(ips: IpAddress[]): Map<number, IpAddress[]> {
  const m = new Map<number, IpAddress[]>();
  for (const ip of ips) {
    const ni = ip.network_interface as LegacyAny;
    const id = typeof ni?.id === "number" ? ni.id : -1;
    if (!m.has(id)) m.set(id, []);
    m.get(id)!.push(ip);
  }
  return m;
}
export function monthKey(d: Date) {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
export function sumAccountingRows(rows: NetworkInterfaceAccounting[]): { bytesIn: number; bytesOut: number } {
  let bytesIn = 0;
  let bytesOut = 0;
  for (const r of rows) {
    if (typeof r.bytes_in === "number") bytesIn += r.bytes_in;
    if (typeof r.bytes_out === "number") bytesOut += r.bytes_out;
  }
  return { bytesIn, bytesOut };
}
export function canonicalBool(v: unknown, fallback: boolean): boolean {
  return v === true ? true : v === false ? false : fallback;
}
export function hostAddr(row: HostIpAddress): string {
  return String((row as LegacyAny).addr ?? (row as LegacyAny).ip_addr ?? `#${row.id}`);
}
export function hostAssigned(row: HostIpAddress): boolean {
  return row.assigned !== false;
}
export function parsePositiveId(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}
export function idFromResourceRef(v: unknown): number | null {
  if (!v) return null;
  if (typeof v === "number") return Number.isInteger(v) && v > 0 ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  if (typeof v === "object" && "id" in v) return idFromResourceRef((v as LegacyAny).id);
  return null;
}
export function labelFromResourceRef(v: unknown, fields: string[] = ["label", "name", "hostname", "login", "addr", "ip_addr"]): string {
  if (!v) return "—";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    for (const field of fields) {
      const raw = (v as LegacyAny)[field];
      if (raw !== undefined && raw !== null && String(raw).trim()) return String(raw);
    }
    const id = idFromResourceRef(v);
    if (id) return `#${id}`;
  }
  return "—";
}
export function ipAddressLabel(ip: IpAddress | null): string {
  if (!ip) return "—";
  return String((ip as LegacyAny).address ?? (ip as LegacyAny).addr ?? `#${ip.id}`);
}
export function ipFamilyLabel(ip: IpAddress): string {
  const raw = (ip.network as LegacyAny)?.ip_version ?? (ip as LegacyAny).ip_version ?? (ip as LegacyAny).version;
  return raw ? `IPv${raw}` : "—";
}
export function ipLocationLabel(ip: IpAddress): string {
  return labelFromResourceRef((ip.network as LegacyAny)?.location ?? (ip as LegacyAny).location);
}
