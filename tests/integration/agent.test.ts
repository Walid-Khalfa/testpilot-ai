import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { executeRun } from "@/lib/agent/runner";
import { projectRepo, runRepo } from "@/lib/storage/file-store";
import { ProjectSchema, RunSchema } from "@/lib/schemas";
import crypto from "node:crypto";

function serveFixture(file: string): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const html = fs.readFileSync(file, "utf8");
    const server = http.createServer((_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(html);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ server, url: `http://127.0.0.1:${addr.port}/` });
    });
  });
}

describe("agent integration (mock adapter)", () => {
  let defectServer: http.Server;
  let defectUrl: string;
  let successServer: http.Server;
  let successUrl: string;

  beforeAll(async () => {
    process.env.ALLOW_LOCAL_DEMO = "true";
    process.env.DATA_DIR = ".data-test";
    delete process.env.MODAL_PROXY_TOKEN;
    const d = await serveFixture(path.resolve(process.cwd(), "public/demo-shop/index.html"));
    defectServer = d.server; defectUrl = d.url;
    const s = await serveFixture(path.resolve(process.cwd(), "public/demo-shop/success.html"));
    successServer = s.server; successUrl = s.url;
  });

  afterAll(async () => {
    defectServer?.close();
    successServer?.close();
    // cleanup data dir
    try { fs.rmSync(path.resolve(process.cwd(), ".data-test"), { recursive: true, force: true }); } catch {}
  });

  async function runAgainst(url: string) {
    const now = new Date().toISOString();
    const project = ProjectSchema.parse({
      id: crypto.randomUUID(),
      name: "Test",
      targetUrl: url,
      authorizedDomain: "127.0.0.1",
      objective: "Verify the checkout form submits and displays an order confirmation.",
      maxDurationSec: 60,
      maxSteps: 12,
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
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      estimatedCostUsd: 0,
      timeline: [],
      cancelled: false,
    });
    await runRepo.save(run);
    return executeRun(run, project, {});
  }

  it("defective scenario produces a confirmed finding", async () => {
    const run = await runAgainst(defectUrl);
    expect(run.status).toBe("completed");
    expect(run.findings.length).toBeGreaterThan(0);
    expect(run.findings.some((f) => f.status === "confirmed")).toBe(true);
  }, 120000);

  it("success scenario has no confirmed findings", async () => {
    const run = await runAgainst(successUrl);
    expect(run.status).toBe("completed");
    expect(run.findings.filter((f) => f.status === "confirmed").length).toBe(0);
  }, 120000);
});