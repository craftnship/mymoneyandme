/**
 * Human-readable session details (section 14: list of active devices). The
 * user agent is reduced to browser + platform, and the address is masked so the
 * page shows roughly where a session is without printing a full IP.
 */
export type Device = { browser: string; platform: string };

export function describeDevice(userAgent: string | null): Device {
  const ua = userAgent ?? "";
  const platform = /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Linux/.test(ua) ? "Linux"
    : "unknown";
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox\/|FxiOS\//.test(ua) ? "Firefox"
    : /Chrome\/|CriOS\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : "unknown";
  return { browser, platform };
}

/** 203.0.113.42 -> 203.0.113.x; 2001:db8:1:2:3:4:5:6 -> 2001:db8:1:2:… */
export function approximateIp(ip: string | null): string | null {
  if (!ip) return null;
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.x`;
  if (ip.includes(":")) return `${ip.split(":").slice(0, 4).join(":")}:…`;
  return null;
}
