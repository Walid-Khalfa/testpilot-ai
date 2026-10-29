import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import type { AgentAction, Observation, InteractiveElement, FormField, Locator } from "../schemas";
import { validateNavigationUrl } from "../security/url-safety";
import type { ActionResult } from "../schemas";

export interface BrowserPolicy {
  allowedDomain: string;
  maxPages: number;
  localDemo: boolean;
}

export class BrowserExecutor {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private pagesVisited = 0;
  private policy: BrowserPolicy;

  constructor(policy: BrowserPolicy) {
    this.policy = policy;
  }

  async start(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({ viewport: { width: 1280, height: 800 } });
    // Egress control: only same-origin as target host allowed.
    await this.context.route("**/*", async (route) => {
      const reqUrl = new URL(route.request().url());
      const host = reqUrl.hostname.toLowerCase();
      const allowed = this.policy.allowedDomain.toLowerCase();
      const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
      const ok =
        host === allowed ||
        host.endsWith("." + allowed) ||
        isLocal ||
        reqUrl.protocol === "data:" ||
        reqUrl.protocol === "blob:";
      if (!ok) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    this.page = await this.context.newPage();
  }

  async stop(): Promise<void> {
    try { await this.context?.close(); } catch {}
    try { await this.browser?.close(); } catch {}
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  getPage(): Page {
    if (!this.page) throw new Error("Browser not started.");
    return this.page;
  }

  getPagesVisited(): number { return this.pagesVisited; }

  private async observeInteractive(): Promise<InteractiveElement[]> {
    const page = this.getPage();
    // Use accessibility snapshot via page accessibility (Playwright)
    const els: InteractiveElement[] = [];
    // Buttons
    const buttons = page.getByRole("button");
    const btnCount = await buttons.count();
    for (let i = 0; i < Math.min(btnCount, 40); i++) {
      const b = buttons.nth(i);
      const name = (await b.innerText().catch(() => "")).trim().slice(0, 80);
      els.push({ role: "button", name, locator: { role: "button", name: name || undefined } });
    }
    // Links
    const links = page.getByRole("link");
    const linkCount = await links.count();
    for (let i = 0; i < Math.min(linkCount, 40); i++) {
      const l = links.nth(i);
      const name = (await l.innerText().catch(() => "")).trim().slice(0, 80);
      els.push({ role: "link", name, locator: { role: "link", name: name || undefined } });
    }
    // Inputs handled in formFields
    return els;
  }

  private async observeForms(): Promise<FormField[]> {
    const page = this.getPage();
    const fields: FormField[] = [];
    const inputs = page.locator("input, textarea, select");
    const count = await inputs.count();
    for (let i = 0; i < Math.min(count, 40); i++) {
      const el = inputs.nth(i);
      const type = (await el.getAttribute("type").catch(() => null)) || (await el.evaluate((e) => e.tagName.toLowerCase()).catch(() => "text"));
      const name = (await el.getAttribute("name").catch(() => null)) || `field-${i}`;
      const required = (await el.getAttribute("required").catch(() => null)) !== null;
      // label
      let label: string | undefined;
      const id = await el.getAttribute("id").catch(() => null);
      if (id) {
        const lab = page.locator(`label[for="${id}"]`);
        if (await lab.count()) label = (await lab.first().innerText().catch(() => "")).trim().slice(0, 80);
      }
      if (!label) {
        label = (await el.getAttribute("aria-label").catch(() => null)) || undefined;
      }
      const value = await el.inputValue().catch(() => "");
      fields.push({ name, type, label, required, value: value.slice(0, 200) });
    }
    return fields;
  }

  async observe(): Promise<Observation> {
    const page = this.getPage();
    const url = page.url();
    const title = await page.title().catch(() => "");
    const headings = await page.locator("h1,h2,h3").allInnerTexts().catch(() => []);
    const visibleTextRaw = await page.locator("p, li, [role='alert'], [role='status'], .notification, .message, .error, .success").allInnerTexts().catch(() => []);
    const visibleText = Array.from(new Set(visibleTextRaw.map((t) => t.trim().slice(0, 200)).filter(Boolean))).slice(0, 80);
    const interactiveElements = await this.observeInteractive();
    const formFields = await this.observeForms();
    // console errors collected via page listeners (store on instance)
    const consoleErrors = this.consoleErrors.splice(0, this.consoleErrors.length);
    const networkErrors = this.networkErrors.splice(0, this.networkErrors.length);
    // screenshot
    const screenshotPath = await this.captureScreenshot("observe");
    return {
      url,
      title,
      headings: headings.map((h) => h.trim().slice(0, 120)).filter(Boolean).slice(0, 50),
      visibleText,
      interactiveElements,
      formFields,
      consoleErrors,
      networkErrors,
      screenshotPath,
      capturedAt: new Date().toISOString(),
    };
  }

  private consoleErrors: string[] = [];
  private networkErrors: string[] = [];

  attachListeners(): void {
    const page = this.getPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") this.consoleErrors.push(msg.text().slice(0, 300));
    });
    page.on("requestfailed", (req) => {
      this.networkErrors.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || "failed"}`.slice(0, 300));
    });
    page.on("response", (res) => {
      if (res.status() >= 400) {
        this.networkErrors.push(`HTTP ${res.status()} ${res.url()}`.slice(0, 300));
      }
    });
  }

  async captureScreenshot(label: string): Promise<string> {
    const page = this.getPage();
    const dir = `.data/screenshots`;
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
    const file = `${dir}/${Date.now()}-${label.replace(/[^a-z0-9-]/gi, "_")}.png`;
    await page.screenshot({ path: file, fullPage: false }).catch(() => {});
    return file.replace(/^\.data\//, "");
  }

  private resolveLocator(loc: Locator) {
    const page = this.getPage();
    if (loc.testId) return page.getByTestId(loc.testId);
    const role = loc.role as unknown as Parameters<typeof page.getByRole>[0];
    if (loc.role && (loc.name || loc.text)) return page.getByRole(role, { name: loc.name || loc.text });
    if (loc.role) return page.getByRole(role);
    if (loc.label) return page.getByLabel(loc.label);
    if (loc.text) return page.getByText(loc.text, { exact: false });
    if (loc.name) return page.getByText(loc.name, { exact: false });
    throw new Error("Unsupported locator.");
  }

  async execute(action: AgentAction): Promise<ActionResult> {
    const page = this.getPage();
    const start = Date.now();
    const stamp = new Date().toISOString();
    try {
      switch (action.type) {
        case "navigate": {
          const check = validateNavigationUrl(action.url, this.policy.allowedDomain);
          if (!check.ok) throw new Error(check.reason);
          // redirect handling via goto; validate final url after
          const resp = await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: 20000 });
          this.pagesVisited++;
          if (this.pagesVisited > this.policy.maxPages) throw new Error("Max pages visited exceeded.");
          const finalUrl = page.url();
          const fCheck = validateNavigationUrl(finalUrl, this.policy.allowedDomain);
          if (!fCheck.ok) throw new Error(`Redirect target blocked: ${fCheck.reason}`);
          return { action, ok: true, evidence: `Navigated to ${finalUrl} (status ${resp?.status() ?? "n/a"})`, durationMs: Date.now() - start, timestamp: stamp };
        }
        case "click": {
          const loc = this.resolveLocator(action.locator);
          await loc.first().click({ timeout: 10000 });
          await page.waitForLoadState("domcontentloaded").catch(() => {});
          return { action, ok: true, evidence: `Clicked element.`, durationMs: Date.now() - start, timestamp: stamp };
        }
        case "fill": {
          const loc = this.resolveLocator(action.locator);
          await loc.first().fill(action.value, { timeout: 10000 });
          return { action, ok: true, evidence: `Filled field with value.`, durationMs: Date.now() - start, timestamp: stamp };
        }
        case "select": {
          const loc = this.resolveLocator(action.locator);
          await loc.first().selectOption(action.value, { timeout: 10000 });
          return { action, ok: true, evidence: `Selected option ${action.value}.`, durationMs: Date.now() - start, timestamp: stamp };
        }
        case "check": {
          const loc = this.resolveLocator(action.locator);
          await loc.first().check({ timeout: 10000 });
          return { action, ok: true, evidence: `Checked element.`, durationMs: Date.now() - start, timestamp: stamp };
        }
        case "assert_text": {
          // Only visible page content counts; hidden elements must not satisfy.
          const bodyText = await page.locator("body").innerText().catch(() => "");
          let ok = false;
          if (action.locator) {
            // When a locator is provided, the expected text must be present in
            // THAT element's visible text, not merely somewhere on the page.
            try {
              const loc = this.resolveLocator(action.locator);
              const elText = await loc.first().innerText().catch(() => "");
              ok = (await loc.count()) > 0 && elText.toLowerCase().includes(action.text.toLowerCase());
            } catch { ok = false; }
          } else {
            ok = bodyText.toLowerCase().includes(action.text.toLowerCase());
          }
          const shot = await this.captureScreenshot("assert");
          return { action, ok, evidence: ok ? `Text "${action.text}" found on page.` : `Text "${action.text}" NOT found on page.`, durationMs: Date.now() - start, screenshotPath: shot, timestamp: stamp };
        }
        case "assert_url": {
          const ok = page.url().toLowerCase().includes(action.url.toLowerCase().replace("*", ""));
          return { action, ok, evidence: `Current URL: ${page.url()}`, durationMs: Date.now() - start, timestamp: stamp };
        }
        case "assert_visible": {
          const loc = this.resolveLocator(action.locator);
          const ok = await loc.first().isVisible().catch(() => false);
          return { action, ok, evidence: ok ? "Element visible." : "Element not visible.", durationMs: Date.now() - start, timestamp: stamp };
        }
        case "wait": {
          await page.waitForTimeout(Math.min(action.ms, 5000));
          return { action, ok: true, evidence: `Waited ${action.ms}ms.`, durationMs: Date.now() - start, timestamp: stamp };
        }
        case "screenshot": {
          const shot = await this.captureScreenshot(action.label || "manual");
          return { action, ok: true, evidence: `Screenshot captured: ${shot}`, durationMs: Date.now() - start, screenshotPath: shot, timestamp: stamp };
        }
        case "finish": {
          return { action, ok: true, evidence: action.summary, durationMs: Date.now() - start, timestamp: stamp };
        }
        default: {
          throw new Error(`Unsupported action type.`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { action, ok: false, evidence: msg, error: msg, durationMs: Date.now() - start, timestamp: stamp };
    }
  }
}