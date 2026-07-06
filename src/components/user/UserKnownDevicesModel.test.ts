import { describe, expect, it } from "vitest";

import {
  buildKnownDeviceSummary,
  filterKnownDevices,
  isKnownDeviceMfaTrusted,
  knownDeviceSearchHaystack,
  parseUserAgent,
  shortenUserAgent,
} from "./UserKnownDevicesModel";

const now = Date.parse("2026-07-04T12:00:00Z");

describe("UserKnownDevicesModel", () => {
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
