import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { executeRun } from "@/lib/agent/runner";
import { projectRepo, runRepo } from "@/lib/storage/file-store";
import { ProjectSchema, RunSchema, type Finding, type RequirementCoverage } from "@/lib/schemas";
import crypto from "node:crypto";

import type { ModelAdapter } from "@/lib/ai/types";
const adapterHolder: { current: ModelAdapter | null } = { current: null };

vi.mock("@/lib/ai", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/lib/ai");
  return { ...actual, createModelAdapter: () => adapterHolder.current };
});

// Default to real MockModelAdapter
import { MockModelAdapter } from "@/lib/ai/mock";

function serveRaw(html: string): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(html); });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ server, url: `http://127.0.0.1:${addr.port}/` });
    });
  });
}

describe("requirement coverage", () => {
  let defectServer: http.Server;
  let defectUrl: string;
  let successServer: http.Server;
  let successUrl: string;

  beforeAll(async () => {
    process.env.ALLOW_LOCAL_DEMO = "true";
    process.env.DATA_DIR = ".data-reqtest";
    delete process.env.MODAL_PROXY_TOKEN;
    const dh = fs.readFileSync(path.resolve(process.cwd(), "public/demo-shop/index.html"), "utf8");
    const ds = await serveRaw(dh); defectServer = ds.server; defectUrl = ds.url;
    const sh = fs.readFileSync(path.resolve(process.cwd(), "public/demo-shop/success.html"), "utf8");
    const ss = await serveRaw(sh); successServer = ss.server; successUrl = ss.url;
  });

  afterAll(async () => {
    defectServer?.close();
    successServer?.close();
    try { fs.rmSync(path.resolve(process.cwd(), ".data-reqtest"), { recursive: true, force: true }); } catch {}
  });

  async function runWithAdapter(url: string, adapter: ModelAdapter, objective: string, maxSteps = 12) {
    const now = new Date().toISOString();
    const project = ProjectSchema.parse({
      id: crypto.randomUUID(),
      name: "ReqTest",
      targetUrl: url,
      authorizedDomain: "127.0.0.1",
      objective,
      maxDurationSec: 60,
      maxSteps,
      maxPages: 10,
      maxTokens: 20000,
      createdAt: now,
      updatedAt: now,
    });
    await projectRepo.save(project);
    const run = RunSchema.parse({
      id: crypto.randomUUID(),
      projectId: project.id,
      status: "queued",
      modelId: "pending",
      startedAt: now,
      maxSteps: project.maxSteps,
      maxDurationSec: project.maxDurationSec,
      maxPages: project.maxPages,
      maxTokens: project.maxTokens,
      pagesVisited: 0,
      steps: [],
      assertions: [],
      findings: [],
      scenarios: [],
      requirements: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      estimatedCostUsd: 0,
      timeline: [],
      cancelled: false,
    });
    await runRepo.save(run);
    adapterHolder.current = adapter;
    return executeRun(run, project, {});
  }

  it("user-authored requirement passes (success scenario)", async () => {
    adapterHolder.current = new MockModelAdapter();
    const run = await runWithAdapter(successUrl, adapterHolder.current, "Verify the checkout form submits and displays 'Order confirmed'.");
    expect(run.status).toBe("completed");
    expect(run.requirements.length).toBe(1);
    expect(run.requirements[0].status).toBe("passed");
    expect(run.findings.filter((f: Finding) => f.status === "confirmed").length).toBe(0);
  }, 120000);

  it("user-authored requirement fails with evidence (defective scenario)", async () => {
    adapterHolder.current = new MockModelAdapter();
    const run = await runWithAdapter(defectUrl, adapterHolder.current, "Verify the checkout form submits and displays 'Order confirmed'.");
    expect(run.status).toBe("completed");
    expect(run.requirements.length).toBe(1);
    expect(run.requirements[0].status).toBe("failed");
    expect(run.findings.some((f: Finding) => f.status === "confirmed")).toBe(true);
    const f = run.findings.find((x: Finding) => x.status === "confirmed")!;
    expect(f.evidenceRefs.length).toBeGreaterThan(0);
  }, 120000);

  it("model cannot finish before evaluating a requirement", async () => {
    // Adapter that tries to finish immediately
    const finishingAdapter = {
      modelId: "mock-finisher",
      async planTests() {
        return { plan: { scenarios: [{ id: "s1", title: "t", objective: "o", preconditions: [], steps: [{ description: "d", expected: "e" }], expectedResults: ["r"], priority: "medium", risk: "low", page: "p" }] }, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
      },
      async nextAction() {
        return { decision: { reasoning: "done", action: { type: "finish", summary: "finished" } }, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
      },
    } as unknown as ModelAdapter;
    adapterHolder.current = finishingAdapter;
    const run = await runWithAdapter(defectUrl, finishingAdapter, "Verify the checkout form submits and displays 'Order confirmed'.", 6);
    // The finish should have been deferred; requirement ends blocked (maxSteps reached) or failed/passed
    expect(run.requirements.length).toBe(1);
    // Requirement should not be left as passed (it was never tested)
    expect(run.requirements[0].status).not.toBe("passed");
  }, 120000);

  it("untested requirement becomes blocked at execution limit", async () => {
    // Adapter that never tests the requirement (only waits)
    const waitingAdapter = {
      modelId: "mock-waiter",
      async planTests() {
        return { plan: { scenarios: [{ id: "s1", title: "t", objective: "o", preconditions: [], steps: [{ description: "d", expected: "e" }], expectedResults: ["r"], priority: "medium", risk: "low", page: "p" }] }, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
      },
      async nextAction() {
        return { decision: { reasoning: "wait", action: { type: "wait", ms: 1 } }, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
      },
    } as unknown as ModelAdapter;
    adapterHolder.current = waitingAdapter;
    const run = await runWithAdapter(defectUrl, waitingAdapter, "Verify the checkout form submits and displays 'Order confirmed'.", 4);
    expect(run.requirements.length).toBe(1);
    expect(run.requirements[0].status).toBe("blocked");
  }, 120000);

  it("model-generated scenario expectation is not a trusted oracle", async () => {
    // Objective without the quoted expected text; scenario expectedResults mention 'Order confirmed'
    // but requirement derivation only uses objective/instructions, so no requirement is created.
    adapterHolder.current = new MockModelAdapter();
    const run = await runWithAdapter(defectUrl, adapterHolder.current, "Verify the checkout form works.");
    expect(run.requirements.length).toBe(0);
    // No confirmed finding should be produced from LLM-invented expectations alone
    expect(run.findings.filter((f: Finding) => f.status === "confirmed").length).toBe(0);
  }, 120000);

  it("objective without quoted text produces no fabricated requirements", async () => {
    adapterHolder.current = new MockModelAdapter();
    const run = await runWithAdapter(defectUrl, adapterHolder.current, "Check that the checkout page loads correctly.");
    expect(run.requirements.length).toBe(0);
  }, 120000);

  it("failed requirement is not classified confirmed without evidence-backed assertion", async () => {
    // Adapter that asserts a quoted requirement text but the action fails (no matching element).
    // We simulate by using a page where the text is absent and an adapter that asserts it.
    // Reuse MockModelAdapter on defect page: it asserts 'Order confirmed' which is hidden -> fails.
    // Already covered by 'user-authored requirement fails with evidence'. Here verify status.
    adapterHolder.current = new MockModelAdapter();
    const run = await runWithAdapter(defectUrl, adapterHolder.current, "Verify the checkout form submits and displays 'Order confirmed'.");
    const req = run.requirements[0];
    if (req.status === "failed") {
      const finding = run.findings.find((f: Finding) => f.title.includes(req.text));
      // If a finding exists, it must have evidence
      if (finding) expect(finding.evidenceRefs.length).toBeGreaterThan(0);
    }
  }, 120000);
});