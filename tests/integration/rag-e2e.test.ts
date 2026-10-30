import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { executeRun } from "@/lib/agent/runner";
import { projectRepo, runRepo, requirementDocRepo } from "@/lib/storage/file-store";
import { ProjectSchema, RunSchema } from "@/lib/schemas";
import { ingestDocument } from "@/lib/rag/ingest";
import crypto from "node:crypto";

describe("RAG end-to-end (mock adapter)", () => {
  let server: http.Server;
  let url: string;

  beforeAll(async () => {
    process.env.ALLOW_LOCAL_DEMO = "true";
    process.env.DATA_DIR = ".data-rage2e";
    delete process.env.MODAL_PROXY_TOKEN;
    const html = fs.readFileSync(path.resolve(process.cwd(), "public/demo-shop/success.html"), "utf8");
    server = http.createServer((_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(html); });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address() as { port: number };
    url = `http://127.0.0.1:${addr.port}/`;
  });

  afterAll(async () => {
    server?.close();
    try { fs.rmSync(path.resolve(process.cwd(), ".data-rage2e"), { recursive: true, force: true }); } catch {}
  });

  it("ingests spec, retrieves requirement, verifies outcome, reports provenance", async () => {
    const now = new Date().toISOString();
    const project = ProjectSchema.parse({
      id: crypto.randomUUID(),
      name: "RAGE2E",
      targetUrl: url,
      authorizedDomain: "127.0.0.1",
      objective: "Verify the checkout form submits and displays 'Order confirmed'.",
      maxDurationSec: 60,
      maxSteps: 12,
      maxPages: 10,
      maxTokens: 20000,
      createdAt: now,
      updatedAt: now,
    });
    await projectRepo.save(project);

    // Ingest a spec
    const doc = ingestDocument(project.id, "spec.md", "text/markdown", 'After submitting valid checkout information, the application must display "Order confirmed".');
    await requirementDocRepo.save(doc);
    expect(doc.requirements.length).toBeGreaterThan(0);

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

    const result = await executeRun(run, project, {});

    // Retrieved requirement should be in run.requirements with provenance
    const retrieved = result.requirements.find((r) => r.source === "retrieved");
    expect(retrieved).toBeDefined();
    expect(retrieved!.documentId).toBe(doc.id);
    expect(typeof retrieved!.score).toBe("number");
    // provenance: section may be undefined; documentId is set

    // Outcome verified (success page shows Order confirmed)
    expect(result.status).toBe("completed");
    const req = result.requirements.find((r) => r.text === "Order confirmed");
    expect(req).toBeDefined();
    expect(req!.status).toBe("passed");
    expect(result.findings.filter((f) => f.status === "confirmed").length).toBe(0);
  }, 120000);
});