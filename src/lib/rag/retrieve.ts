import type { RequirementCoverage } from "../schemas";

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
}

export interface RetrievedRequirement extends RequirementCoverage {
  documentId: string;
  section?: string;
  score: number;
}

export function scoreRequirement(query: string, text: string): number {
  const q = tokens(query);
  const t = tokens(text);
  if (q.size === 0 || t.size === 0) return 0;
  let overlap = 0;
  for (const w of q) if (t.has(w)) overlap++;
  // Jaccard-ish: overlap / union
  const union = new Set([...q, ...t]).size;
  return union === 0 ? 0 : overlap / union;
}

export const RELEVANCE_THRESHOLD = 0.05;

export function retrieveRequirements(
  query: string,
  candidates: Array<{ id: string; text: string; documentId: string; section?: string }>,
  topK = 3,
  threshold = RELEVANCE_THRESHOLD,
): RetrievedRequirement[] {
  const scored = candidates
    .map((c) => ({ ...c, score: scoreRequirement(query, c.text) }))
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return scored.map((c) => ({
    id: c.id,
    text: c.text,
    source: "retrieved" as const,
    status: "not_tested" as const,
    documentId: c.documentId,
    section: c.section,
    score: Number(c.score.toFixed(4)),
  }));
}