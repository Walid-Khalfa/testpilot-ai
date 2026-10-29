import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { BrowserExecutor } from "@/lib/browser/executor";

const HTML = `<!DOCTYPE html><html><body>
  <p id="visible-msg">Hello world</p>
  <div id="target">Goodbye</div>
  <div id="hidden-msg" style="display:none">Secret confirmation</div>
  <div id="visible-note" class="note">Order confirmed — thank you!</div>
  <div id="hidden-note" class="note" style="display:none">Hidden order note</div>
</body></html>`;

describe("BrowserExecutor assert_text", () => {
  let server: http.Server;
  let url: string;

  beforeAll(async () => {
    process.env.ALLOW_LOCAL_DEMO = "true";
    server = http.createServer((_req, res) => { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(HTML); });
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

  it("passes when locator targets a visible element containing the text", async () => {
    const exec = new BrowserExecutor({ allowedDomain: "127.0.0.1", maxPages: 5, localDemo: true });
    await exec.start();
    exec.attachListeners();
    await exec.execute({ type: "navigate", url });
    const res = await exec.execute({ type: "assert_text", text: "Hello world", locator: { text: "Hello world" } });
    await exec.stop();
    expect(res.ok).toBe(true);
  });

  it("fails when locator targets a hidden element (regression)", async () => {
    const exec = new BrowserExecutor({ allowedDomain: "127.0.0.1", maxPages: 5, localDemo: true });
    await exec.start();
    exec.attachListeners();
    await exec.execute({ type: "navigate", url });
    const res = await exec.execute({ type: "assert_text", text: "Secret confirmation", locator: { text: "Secret confirmation" } });
    await exec.stop();
    expect(res.ok).toBe(false);
  });

  it("fails when expected text is completely absent (unscoped and locator-scoped)", async () => {
    const exec = new BrowserExecutor({ allowedDomain: "127.0.0.1", maxPages: 5, localDemo: true });
    await exec.start();
    exec.attachListeners();
    await exec.execute({ type: "navigate", url });
    const resUnscoped = await exec.execute({ type: "assert_text", text: "Non-existent text" });
    const resScoped = await exec.execute({ type: "assert_text", text: "Non-existent text", locator: { text: "Goodbye" } });
    await exec.stop();
    expect(resUnscoped.ok).toBe(false);
    expect(resScoped.ok).toBe(false);
  }, 15000);

  it("includes visible .note elements in observe() visibleText and excludes hidden .note elements", async () => {
    const exec = new BrowserExecutor({ allowedDomain: "127.0.0.1", maxPages: 5, localDemo: true });
    await exec.start();
    exec.attachListeners();
    await exec.execute({ type: "navigate", url });
    const obs = await exec.observe();
    await exec.stop();
    expect(obs.visibleText).toContain("Order confirmed — thank you!");
    expect(obs.visibleText).not.toContain("Hidden order note");
    expect(obs.visibleText).not.toContain("Secret confirmation");
  }, 15000);
});