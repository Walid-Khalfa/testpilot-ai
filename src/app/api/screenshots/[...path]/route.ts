import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const joined = parts.join("/");
  // safety: only allow simple filenames under screenshots
  if (!/^screenshots\/[A-Za-z0-9_.-]+\.png$/.test(joined)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const file = path.resolve(process.cwd(), ".data", joined);
  try {
    const buf = await fs.readFile(file);
    return new NextResponse(buf, { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}