import { NextResponse } from "next/server";
import { runRepo, projectRepo } from "@/lib/storage/file-store";
import { RunSchema } from "@/lib/schemas";
import crypto from "node:crypto";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const runs = await runRepo.list();
  const filtered = projectId ? runs.filter((r) => r.projectId === projectId) : runs;
  return NextResponse.json({ runs: filtered });
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const projectId = (body as { projectId?: string })?.projectId;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  const project = await projectRepo.get(projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // concurrency guard
  const running = (await runRepo.list()).filter((r) => r.status === "running");
  const maxConcurrent = Number(process.env.MAX_CONCURRENT_RUNS || "2");
  if (running.length >= maxConcurrent) {
    return NextResponse.json({ error: "Too many concurrent runs" }, { status: 429 });
  }

  const now = new Date().toISOString();
  const run = RunSchema.parse({
    id: crypto.randomUUID(),
    projectId,
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
  return NextResponse.json({ run }, { status: 201 });
}