import dns from "node:dns/promises";
import { loadEnv } from "../schemas";

export type UrlCheckResult = { ok: true; url: URL } | { ok: false; reason: string };

const PRIVATE_RANGES: Array<(ip: string) => boolean> = [
  (ip) => ip === "127.0.0.1" || ip === "::1" || ip === "localhost",
  (ip) => ip.startsWith("10."),
  (ip) => /^172\.(1[6-9]|2\d|3[01])\./.test(ip),
  (ip) => ip.startsWith("192.168."),
  (ip) => ip.startsWith("169.254."), // link-local / metadata
  (ip) => ip === "0.0.0.0",
  (ip) => ip.startsWith("fc") || ip.startsWith("fd"), // IPv6 ULA
  (ip) => ip === "::",
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((fn) => fn(ip.toLowerCase()));
}

export function normalizeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

export function hostMatchesDomain(host: string, allowedDomain: string): boolean {
  const h = host.toLowerCase();
  const d = allowedDomain.toLowerCase().replace(/^\.+/, "");
  return h === d || h.endsWith("." + d);
}

export async function resolveHost(host: string): Promise<string[]> {
  try {
    const res = await dns.lookup(host, { all: true });
    return res.map((r) => r.address);
  } catch {
    return [];
  }
}

export function localDemoAllowed(): boolean {
  return loadEnv().ALLOW_LOCAL_DEMO === "true";
}

export async function validateTargetUrl(
  raw: string,
  allowedDomain: string,
): Promise<UrlCheckResult> {
  const u = normalizeUrl(raw);
  if (!u) return { ok: false, reason: "Invalid URL or unsupported scheme." };

  const host = u.hostname.toLowerCase();

  // Localhost handling: only allowed in explicit demo mode.
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (isLocal && !localDemoAllowed()) {
    return { ok: false, reason: "Localhost targets are blocked unless ALLOW_LOCAL_DEMO=true." };
  }
  if (isLocal && localDemoAllowed()) {
    // still require domain match for demo
    if (!hostMatchesDomain(host, allowedDomain) && allowedDomain !== "localhost" && allowedDomain !== "127.0.0.1") {
      return { ok: false, reason: "Target host does not match authorized domain." };
    }
    return { ok: true, url: u };
  }

  if (!hostMatchesDomain(host, allowedDomain)) {
    return { ok: false, reason: `Host ${host} is not within authorized domain ${allowedDomain}.` };
  }

  const ips = await resolveHost(host);
  if (ips.length === 0) {
    return { ok: false, reason: `Could not resolve host ${host}.` };
  }
  for (const ip of ips) {
    if (isPrivateIp(ip)) {
      return { ok: false, reason: `Host resolves to a private/blocked address (${ip}).` };
    }
  }
  return { ok: true, url: u };
}

export function validateNavigationUrl(
  raw: string,
  allowedDomain: string,
): UrlCheckResult {
  const u = normalizeUrl(raw);
  if (!u) return { ok: false, reason: "Invalid URL or unsupported scheme." };
  const host = u.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (isLocal && !localDemoAllowed()) {
    return { ok: false, reason: "Localhost navigation blocked." };
  }
  if (!isLocal && !hostMatchesDomain(host, allowedDomain)) {
    return { ok: false, reason: `Navigation to ${host} not within authorized domain.` };
  }
  return { ok: true, url: u };
}

export const MAX_REDIRECTS = 5;