import { NextResponse } from "next/server";
import { runRepo } from "@/lib/storage/file-store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await runRepo.get(id);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ run });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await runRepo.delete(id);
  return NextResponse.json({ ok: true });
}