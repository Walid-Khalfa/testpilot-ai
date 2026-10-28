import { NextResponse } from "next/server";
import { runRepo, projectRepo } from "@/lib/storage/file-store";
import { executeRun } from "@/lib/agent/runner";
import { isCancelled, clearCancelled } from "@/lib/agent/cancel";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await runRepo.get(id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (run.status === "running") return NextResponse.json({ error: "Already running" }, { status: 409 });
  const project = await projectRepo.get(run.projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  clearCancelled(id);
  const updated = await executeRun(run, project, { isCancelled: () => isCancelled(id) });
  return NextResponse.json({ run: updated });
}