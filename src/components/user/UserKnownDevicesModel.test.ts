import { describe, expect, it } from "vitest";

import {
  buildKnownDevicePageWindow,
  buildKnownDeviceSummary,
  filterKnownDevices,
  isKnownDeviceMfaTrusted,
  knownDeviceSearchHaystack,
  parseUserAgent,
  shortenUserAgent,
} from "./UserKnownDevicesModel";

const now = Date.parse("2026-07-04T12:00:00Z");

describe("UserKnownDevicesModel", () => {
  for (const limit of [25, 50, 100]) {
    it(`hides the limit ${limit} lookahead and derives an ascending cursor from visible rows`, () => {
      const devices = Array.from({ length: limit + 1 }, (_, index) => ({ id: index + 1 }));

      expect(buildKnownDevicePageWindow(devices, limit)).toEqual({
        rows: devices.slice(0, limit),
        cursor: limit,
        hasMore: true,
      });
    });
  }

  it("recognizes terminal pages and fails closed without a valid visible cursor", () => {
    expect(buildKnownDevicePageWindow([{ id: 2 }, { id: 1 }], 2)).toEqual({
      rows: [{ id: 2 }, { id: 1 }],
      cursor: 2,
      hasMore: false,
    });
    expect(buildKnownDevicePageWindow([{ id: "invalid" }, { id: 3 }, { id: 4 }], 2)).toEqual({
      rows: [{ id: "invalid" }, { id: 3 }],
      cursor: 3,
      hasMore: true,
    });
    expect(buildKnownDevicePageWindow([{ id: "invalid" }, { id: 4 }], 1)).toEqual({
      rows: [{ id: "invalid" }],
      cursor: null,
      hasMore: true,
    });
    expect(buildKnownDevicePageWindow(undefined, 25)).toEqual({ rows: [], cursor: null, hasMore: false });
  });

  it("parses common user agents and shortens long raw strings", () => {
    const chrome = parseUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
    );
    expect(chrome).toEqual({ browser: "Chrome 126.0.0.0", os: "Linux" });

    const safari = parseUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Version/17.5 Safari/605.1.15",
    );
    expect(safari).toEqual({ browser: "Safari 17.5", os: "macOS 14.5" });

    expect(shortenUserAgent("abcdef", 6)).toBe("abcdef");
    expect(shortenUserAgent("abcdef", 4)).toBe("abc…");
  });

  it("builds local search and trusted-device summaries", () => {
    const devices = [
      {
        id: 1,
        api_ip_addr: "198.51.100.10",
        client_ip_addr: "203.0.113.10",
        user_agent: "Firefox/128.0",
        skip_multi_factor_auth_until: "2026-07-05T12:00:00Z",
      },
      {
        id: 2,
        api_ip_addr: "198.51.100.10",
        client_ip_addr: "203.0.113.11",
        user_agent: "curl/8.0",
        skip_multi_factor_auth_until: "2026-07-01T12:00:00Z",
      },
    ];

    expect(knownDeviceSearchHaystack(devices[0]!).includes("firefox")).toBe(
      true,
    );
    expect(isKnownDeviceMfaTrusted(devices[0]!, now)).toBe(true);
    expect(isKnownDeviceMfaTrusted(devices[1]!, now)).toBe(false);
    expect(filterKnownDevices(devices, "firefox").map((device) => device.id)).toEqual([1]);
    expect(filterKnownDevices(devices, "").map((device) => device.id)).toEqual([1, 2]);

    expect(buildKnownDeviceSummary(devices, now)).toEqual({
      total: 2,
      trusted: 1,
      uniqueClientIps: 2,
      uniqueApiIps: 1,
    });
  });
});
