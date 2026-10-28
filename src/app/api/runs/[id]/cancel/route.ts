import { NextResponse } from "next/server";
import { cancelRun } from "@/lib/agent/cancel";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  cancelRun(id);
  return NextResponse.json({ ok: true });
}