import { NextResponse } from "next/server";
import { runRepo, projectRepo } from "@/lib/storage/file-store";
import { renderReportHtml } from "@/lib/reporting/html";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await runRepo.get(id);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const project = await projectRepo.get(run.projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const html = renderReportHtml(run, project);
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="testpilot-report-${id}.html"`,
    },
  });
}