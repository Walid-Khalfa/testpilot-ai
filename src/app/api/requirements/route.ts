import { NextResponse } from "next/server";
import { requirementDocRepo } from "@/lib/storage/file-store";
import { ingestDocument } from "@/lib/rag/ingest";
import { retrieveRequirements } from "@/lib/rag/retrieve";

function isLocalRequest(req: Request): boolean {
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  if (!(host === "localhost" || host === "127.0.0.1" || host === "::1")) return false;
  // Defense in depth: reject cross-origin browser requests.
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const o = new URL(origin);
      const oh = o.hostname.toLowerCase();
      if (!(oh === "localhost" || oh === "127.0.0.1" || oh === "::1")) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export async function GET(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: "Requirements API is restricted to local development." }, { status: 403 });
  }
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const query = url.searchParams.get("query");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  const docs = await requirementDocRepo.list(projectId);
  const candidates = docs.flatMap((d) => d.requirements.map((r) => ({ id: r.id, text: r.text, documentId: d.id, section: r.section })));
  const retrieved = query ? retrieveRequirements(query, candidates) : [];
  return NextResponse.json({ documents: docs, retrieved });
}

export async function POST(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: "Requirements API is restricted to local development." }, { status: 403 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const b = body as { projectId?: string; filename?: string; mimeType?: string; content?: string };
  if (!b.projectId || !b.filename || !b.mimeType || typeof b.content !== "string") {
    return NextResponse.json({ error: "projectId, filename, mimeType, content required" }, { status: 400 });
  }
  try {
    const doc = ingestDocument(b.projectId, b.filename, b.mimeType, b.content);
    await requirementDocRepo.save(doc);
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: "Requirements API is restricted to local development." }, { status: 403 });
  }
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const id = url.searchParams.get("id");
  if (!projectId || !id) return NextResponse.json({ error: "projectId and id required" }, { status: 400 });
  await requirementDocRepo.delete(projectId, id);
  return NextResponse.json({ ok: true });
}