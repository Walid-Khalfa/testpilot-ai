import crypto from "node:crypto";
import { RequirementDocumentSchema, RequirementCoverageSchema } from "../schemas";
import type { RequirementDocument, RequirementCoverage } from "../schemas";

export const MAX_DOC_SIZE = 64 * 1024;
export const ALLOWED_MIME = ["text/plain", "text/markdown"] as const;

export function sanitizeText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
}

export function extractRequirements(filename: string, content: string): RequirementCoverage[] {
  const out: RequirementCoverage[] = [];
  const seen = new Set<string>();
  const slug = filename.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) || "doc";
  // quoted strings
  const quotes = content.match(/["']([^"']{4,120})["']/g) || [];
  let n = 0;
  for (const m of quotes) {
    const text = m.slice(1, -1).trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    n++;
    out.push(RequirementCoverageSchema.parse({
      id: `REQ-${slug.toUpperCase()}-${String(n).padStart(3, "0")}`,
      text,
      source: "retrieved",
      status: "not_tested",
    }));
  }
  // "must/should" sentences
  const sentences = content.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const t = s.trim();
    if (!/\b(must|should|shall)\b/i.test(t)) continue;
    if (t.length < 10 || t.length > 200) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    n++;
    out.push(RequirementCoverageSchema.parse({
      id: `REQ-${slug.toUpperCase()}-${String(n).padStart(3, "0")}`,
      text: t,
      source: "retrieved",
      status: "not_tested",
    }));
  }
  return out.slice(0, 50);
}

export function validateDocument(filename: string, mimeType: string, content: string): string | null {
  if (!filename || filename.length > 120) return "Invalid filename.";
  if (!ALLOWED_MIME.includes(mimeType as (typeof ALLOWED_MIME)[number])) return "Unsupported content type. Use text/plain or text/markdown.";
  if (!content || !content.trim()) return "Document is empty.";
  if (content.length > MAX_DOC_SIZE) return `Document exceeds ${MAX_DOC_SIZE} bytes.`;
  return null;
}

export function ingestDocument(projectId: string, filename: string, mimeType: string, rawContent: string): RequirementDocument {
  const content = sanitizeText(rawContent);
  const err = validateDocument(filename, mimeType, content);
  if (err) throw new Error(err);
  const requirements = extractRequirements(filename, content);
  return RequirementDocumentSchema.parse({
    id: crypto.randomUUID(),
    projectId,
    filename,
    mimeType,
    size: content.length,
    uploadedAt: new Date().toISOString(),
    content,
    requirements,
  });
}