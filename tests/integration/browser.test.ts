import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { BrowserExecutor } from "@/lib/browser/executor";

const HTML = `<!DOCTYPE html><html><body>
  <p>Hello world</p>
  <div id="target">Goodbye</div>
</body></html>`;

describe("BrowserExecutor assert_text", () => {
  let server: http.Server;
  let url: string;

  beforeAll(async () => {
    process.env.ALLOW_LOCAL_DEMO = "true";
    server = http.createServer((_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(HTML); });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address() as { port: number };
    url = `http://127.0.0.1:${addr.port}/`;
  });

  afterAll(() => server?.close());

  it("passes when text is in body without locator", async () => {
    const exec = new BrowserExecutor({ allowedDomain: "127.0.0.1", maxPages: 5, localDemo: true });
    await exec.start();
    exec.attachListeners();
    await exec.execute({ type: "navigate", url });
    const res = await exec.execute({ type: "assert_text", text: "Hello world" });
    await exec.stop();
    expect(res.ok).toBe(true);
  });

  it("fails when text exists elsewhere but not in target element (regression)", async () => {
    const exec = new BrowserExecutor({ allowedDomain: "127.0.0.1", maxPages: 5, localDemo: true });
    await exec.start();
    exec.attachListeners();
    await exec.execute({ type: "navigate", url });
    const res = await exec.execute({ type: "assert_text", text: "Hello world", locator: { text: "Goodbye" } });
    await exec.stop();
    expect(res.ok).toBe(false);
  });
});