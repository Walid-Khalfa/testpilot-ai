import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Observation } from "@/lib/schemas";
import { extractJson, pingModal, ModalModelAdapter } from "@/lib/ai/modal";

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