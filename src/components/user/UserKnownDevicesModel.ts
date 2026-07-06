import type { UserKnownDevice } from "../../lib/api/userDossier";

export interface ParsedUserAgent {
  os: string;
  browser: string;
}

export function knownDeviceSearchHaystack(device: UserKnownDevice): string {
  return [
    String(device.id ?? ""),
    String(device.api_ip_addr ?? ""),
    String(device.api_ip_ptr ?? ""),
    String(device.client_ip_addr ?? ""),
    String(device.client_ip_ptr ?? ""),
    String(device.user_agent ?? ""),
  ]
    .join(" ")
    .toLowerCase();
}

export function filterKnownDevices(
  devices: readonly UserKnownDevice[] | undefined,
  search: string,
): UserKnownDevice[] {
  const raw = devices ?? [];
  const needle = search.trim().toLowerCase();
  if (!needle) return [...raw];
  return raw.filter((device) => knownDeviceSearchHaystack(device).includes(needle));
}

export function shortenUserAgent(ua: string | undefined, max = 90): string {
  const value = String(ua ?? "").trim();
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function matchFirst(value: string, re: RegExp): string | null {
  const match = value.match(re);
  return match?.[1] ? String(match[1]) : null;
}

export function parseUserAgent(ua: string | undefined): ParsedUserAgent {
  const value = String(ua ?? "").trim();
  if (!value) return { os: "—", browser: "—" };

  let browser = "Unknown";
  const edge = matchFirst(value, /Edg\/([0-9.]+)/);
  const opera = matchFirst(value, /OPR\/([0-9.]+)/);
  const firefox = matchFirst(value, /Firefox\/([0-9.]+)/);
  const chrome = matchFirst(value, /Chrome\/([0-9.]+)/);
  const safari = matchFirst(value, /Version\/([0-9.]+).*Safari\//);
  const curl = matchFirst(value, /curl\/([0-9.]+)/);
  const wget = matchFirst(value, /Wget\/([0-9.]+)/);

  if (edge) browser = `Edge ${edge}`;
  else if (opera) browser = `Opera ${opera}`;
  else if (firefox) browser = `Firefox ${firefox}`;
  else if (chrome && !value.includes("Edg/") && !value.includes("OPR/"))
    browser = `Chrome ${chrome}`;
  else if (
    safari &&
    !value.includes("Chrome/") &&
    !value.includes("Edg/") &&
    !value.includes("OPR/")
  )
    browser = `Safari ${safari}`;
  else if (curl) browser = `curl ${curl}`;
  else if (wget) browser = `Wget ${wget}`;

  let os = "Unknown";
  const windows = matchFirst(value, /Windows NT ([0-9.]+)/);
  const mac = matchFirst(value, /Mac OS X ([0-9_]+)/);
  const android = matchFirst(value, /Android ([0-9.]+)/);
  const iphone = matchFirst(value, /iPhone OS ([0-9_]+)/);
  const ipad = matchFirst(value, /CPU OS ([0-9_]+)/);

  if (android) os = `Android ${android}`;
  else if (iphone) os = `iOS ${iphone.replaceAll("_", ".")}`;
  else if (ipad && value.includes("iPad"))
    os = `iPadOS ${ipad.replaceAll("_", ".")}`;
  else if (windows) os = `Windows NT ${windows}`;
  else if (mac) os = `macOS ${mac.replaceAll("_", ".")}`;
  else if (value.includes("Linux")) os = "Linux";

  return { os, browser };
}

export function isKnownDeviceMfaTrusted(
  device: UserKnownDevice,
  nowMs = Date.now(),
): boolean {
  const rawUntil = device.skip_multi_factor_auth_until;
  if (!rawUntil) return false;

  const untilMs = Date.parse(rawUntil);
  if (!Number.isFinite(untilMs)) return true;
  return untilMs > nowMs;
}

export interface KnownDeviceSummary {
  total: number;
  trusted: number;
  uniqueClientIps: number;
  uniqueApiIps: number;
}

export function buildKnownDeviceSummary(
  devices: readonly UserKnownDevice[] | undefined,
  nowMs = Date.now(),
): KnownDeviceSummary {
  const rows = devices ?? [];
  const clientIps = new Set<string>();
  const apiIps = new Set<string>();
  let trusted = 0;

  for (const device of rows) {
    if (device.client_ip_addr) clientIps.add(device.client_ip_addr);
    if (device.api_ip_addr) apiIps.add(device.api_ip_addr);
    if (isKnownDeviceMfaTrusted(device, nowMs)) trusted += 1;
  }

  return {
    total: rows.length,
    trusted,
    uniqueClientIps: clientIps.size,
    uniqueApiIps: apiIps.size,
  };
}
