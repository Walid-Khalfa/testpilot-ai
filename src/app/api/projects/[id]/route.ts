import { NextResponse } from "next/server";
import { projectRepo } from "@/lib/storage/file-store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await projectRepo.get(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await projectRepo.delete(id);
  return NextResponse.json({ ok: true });
}