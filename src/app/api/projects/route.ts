import { NextResponse } from "next/server";
import { projectRepo } from "@/lib/storage/file-store";
import { CreateProjectInputSchema } from "@/lib/schemas";
import { validateTargetUrl } from "@/lib/security/url-safety";
import { ProjectSchema } from "@/lib/schemas";
import crypto from "node:crypto";

export async function GET() {
  const projects = await projectRepo.list();
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = CreateProjectInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;
  const check = await validateTargetUrl(input.targetUrl, input.authorizedDomain);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }
  const now = new Date().toISOString();
  const project = ProjectSchema.parse({
    id: crypto.randomUUID(),
    name: input.name,
    targetUrl: check.url.toString(),
    authorizedDomain: input.authorizedDomain,
    objective: input.objective,
    maxDurationSec: input.maxDurationSec,
    maxSteps: input.maxSteps,
    maxPages: input.maxPages,
    maxTokens: input.maxTokens,
    instructions: input.instructions,
    createdAt: now,
    updatedAt: now,
  });
  await projectRepo.save(project);
  return NextResponse.json({ project }, { status: 201 });
}