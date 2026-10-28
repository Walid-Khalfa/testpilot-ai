import { describe, it, expect } from "vitest";
import { normalizeUrl, hostMatchesDomain, validateTargetUrl } from "@/lib/security/url-safety";

describe("url-safety", () => {
  it("normalizes http/https", () => {
    expect(normalizeUrl("https://example.com/x")?.host).toBe("example.com");
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
  });
  it("hostMatchesDomain", () => {
    expect(hostMatchesDomain("app.example.com", "example.com")).toBe(true);
    expect(hostMatchesDomain("evil.com", "example.com")).toBe(false);
  });
  it("blocks private IPs", async () => {
    const r = await validateTargetUrl("http://127.0.0.1/", "127.0.0.1");
    // local demo not allowed by default in test env
    expect(r.ok).toBe(false);
  });
});