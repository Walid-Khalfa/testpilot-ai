import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Observation, TestPlan, Run, Project } from "@/lib/schemas";
import { AgentDecisionSchema } from "@/lib/schemas";
import {
  extractJson,
  pingModal,
  ModalModelAdapter,
  shouldAttachScreenshot,
  buildUserContent,
  loadScreenshotDataUrl,
} from "@/lib/ai/modal";
import { renderReportHtml } from "@/lib/reporting/html";

describe("extractJson", () => {
  it("parses fenced json", () => {
    const v = extractJson("```json\n{\"a\":1}\n```") as { a: number };
    expect(v.a).toBe(1);
  });
  it("throws when no json", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("ModalModelAdapter", () => {
  const originalToken = process.env.MODAL_PROXY_TOKEN;
  const originalModel = process.env.MODAL_MODEL_ID;
  const originalBase = process.env.MODAL_ENDPOINT_BASE_URL;

  beforeEach(() => {
    process.env.MODAL_PROXY_TOKEN = "wk-test.ws-secret";
    process.env.MODAL_MODEL_ID = "test-model.us-west.modal.direct";
    process.env.MODAL_ENDPOINT_BASE_URL = "https://example.test/v1";
  });
  afterEach(() => {
    process.env.MODAL_PROXY_TOKEN = originalToken;
    process.env.MODAL_MODEL_ID = originalModel;
    process.env.MODAL_ENDPOINT_BASE_URL = originalBase;
    vi.restoreAllMocks();
  });

  it("rejects invalid JSON output", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "not json" } }], usage: {} }),
    }));
    const adapter = new ModalModelAdapter();
    const obs = {
      url: "http://localhost/x", title: "t", headings: [], interactiveElements: [], formFields: [],
      consoleErrors: [], networkErrors: [], capturedAt: new Date().toISOString(),
    } as unknown as Observation;
    await expect(adapter.planTests(obs, "obj")).rejects.toThrow();
  });

  it("handles HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    }));
    const adapter = new ModalModelAdapter();
    const obs = {
      url: "http://localhost/x", title: "t", headings: [], interactiveElements: [], formFields: [],
      consoleErrors: [], networkErrors: [], capturedAt: new Date().toISOString(),
    } as unknown as Observation;
    await expect(adapter.planTests(obs, "obj")).rejects.toThrow(/401/);
  });
});

describe("pingModal", () => {
  const originalToken = process.env.MODAL_PROXY_TOKEN;
  const originalModel = process.env.MODAL_MODEL_ID;
  const originalBase = process.env.MODAL_ENDPOINT_BASE_URL;

  beforeEach(() => {
    process.env.MODAL_PROXY_TOKEN = "";
    process.env.MODAL_MODEL_ID = "auto";
    process.env.MODAL_ENDPOINT_BASE_URL = "https://example.test/v1";
  });
  afterEach(() => {
    process.env.MODAL_PROXY_TOKEN = originalToken;
    process.env.MODAL_MODEL_ID = originalModel;
    process.env.MODAL_ENDPOINT_BASE_URL = originalBase;
    vi.restoreAllMocks();
  });

  it("returns not configured when token missing", async () => {
    const r = await pingModal();
    expect(r.configured).toBe(false);
  });
});

describe("multimodal helpers & fallback", () => {
  const tmpDir = ".data-mmtest";
  const shotDir = path.resolve(process.cwd(), tmpDir, "screenshots");
  const shotFile = path.join(shotDir, "100-observe.png");
  const originalDataDir = process.env.DATA_DIR;
  const originalToken = process.env.MODAL_PROXY_TOKEN;
  const originalModel = process.env.MODAL_MODEL_ID;
  const originalBase = process.env.MODAL_ENDPOINT_BASE_URL;

  beforeEach(() => {
    process.env.DATA_DIR = tmpDir;
    process.env.MODAL_PROXY_TOKEN = "wk-test.ws-secret";
    process.env.MODAL_MODEL_ID = "meta-models/Muse-Spark-Open-816B-A42B";
    process.env.MODAL_ENDPOINT_BASE_URL = "https://example.test/v1";
    fs.mkdirSync(shotDir, { recursive: true });
    fs.writeFileSync(shotFile, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  afterEach(() => {
    process.env.DATA_DIR = originalDataDir;
    process.env.MODAL_PROXY_TOKEN = originalToken;
    process.env.MODAL_MODEL_ID = originalModel;
    process.env.MODAL_ENDPOINT_BASE_URL = originalBase;
    try { fs.rmSync(path.resolve(process.cwd(), tmpDir), { recursive: true, force: true }); } catch {}
    vi.restoreAllMocks();
  });

  it("constructs multimodal content array when dataUrl is provided", () => {
    const dataUrl = loadScreenshotDataUrl("screenshots/100-observe.png");
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    const content = buildUserContent("Hello prompt", dataUrl);
    expect(Array.isArray(content)).toBe(true);
    if (Array.isArray(content)) {
      expect(content[0]).toEqual({ type: "text", text: "Hello prompt" });
      expect(content[1]).toEqual({ type: "image_url", image_url: { url: dataUrl } });
    }
  });

  it("selectively attaches screenshots based on history", () => {
    expect(shouldAttachScreenshot("")).toBe(true);
    expect(shouldAttachScreenshot('{"action":{"type":"fill"},"result":"ok"}')).toBe(false);
    expect(shouldAttachScreenshot('{"action":{"type":"click"},"result":"ok"}')).toBe(true);
    expect(shouldAttachScreenshot('{"action":{"type":"assert_text"},"result":"fail"}')).toBe(true);
    expect(shouldAttachScreenshot('{"action":{"type":"assert_text"},"result":"ok"}')).toBe(false);
  });

  it("validates visualObservation and visionMode in AgentDecisionSchema", () => {
    const parsed = AgentDecisionSchema.parse({
      reasoning: "Checking confirmation banner",
      visualObservation: "Green banner is visible below button",
      visionMode: "multimodal",
      action: { type: "finish", summary: "Done" },
    });
    expect(parsed.visualObservation).toBe("Green banner is visible below button");
    expect(parsed.visionMode).toBe("multimodal");
  });

  it("falls back to text-only when multimodal request fails and marks visionMode=text_fallback", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("HTTP 400 multimodal unsupported"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ reasoning: "Recovered via text", action: { type: "wait", ms: 500 } }) } }],
          usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new ModalModelAdapter();
    const obs: Observation = {
      url: "http://localhost/x",
      title: "t",
      headings: [],
      interactiveElements: [],
      formFields: [],
      consoleErrors: [],
      networkErrors: [],
      screenshotPath: "screenshots/100-observe.png",
      capturedAt: new Date().toISOString(),
    };
    const plan: TestPlan = {
      scenarios: [{ id: "s1", title: "t", objective: "o", preconditions: [], steps: [{ description: "d", expected: "e" }], expectedResults: ["r"], priority: "medium", risk: "low", page: "p" }],
    };
    const { decision } = await adapter.nextAction({ observation: obs, plan, history: "", objective: "obj" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(decision.visionMode).toBe("text_fallback");
    expect(decision.action.type).toBe("wait");
  });

  it("renders visual observation telemetry in HTML report", () => {
    const now = new Date().toISOString();
    const project: Project = {
      id: "00000000-0000-0000-0000-000000000001",
      name: "VisualProj",
      targetUrl: "http://localhost:3000/demo-shop/index.html",
      authorizedDomain: "localhost",
      objective: "Verify 'Order confirmed'",
      maxDurationSec: 60,
      maxSteps: 10,
      maxPages: 5,
      maxTokens: 10000,
      createdAt: now,
      updatedAt: now,
    };
    const run: Run = {
      id: "00000000-0000-0000-0000-000000000002",
      projectId: project.id,
      status: "completed",
      modelId: "meta-models/Muse-Spark-Open-816B-A42B",
      startedAt: now,
      finishedAt: now,
      maxSteps: 10,
      maxDurationSec: 60,
      maxPages: 5,
      maxTokens: 10000,
      pagesVisited: 1,
      steps: [],
      assertions: [],
      findings: [],
      scenarios: [],
      requirements: [],
      tokenUsage: { promptTokens: 1500, completionTokens: 200, totalTokens: 1700 },
      estimatedCostUsd: 0.002,
      timeline: [
        {
          id: "ev-1",
          timestamp: now,
          kind: "reason",
          message: "Model chose: assert_text",
          data: {
            reasoning: "Checking confirmation after click",
            visualObservation: "Blue button visible, no green confirmation banner below it",
            visionMode: "multimodal",
          },
        },
      ],
      cancelled: false,
    };
    const html = renderReportHtml(run, project);
    expect(html).toContain("Visual observation (multimodal): Blue button visible, no green confirmation banner below it");
  });
});