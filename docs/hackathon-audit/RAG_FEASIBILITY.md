# Requirements RAG Feasibility Audit — TestPilot AI

## 1. Functional objective

Allow a user to upload a functional specification (e.g., "After entering valid checkout information and clicking Place order, the application must display Order confirmed.") and have TestPilot AI retrieve the relevant requirement, plan a test, execute it, and determine pass/fail with evidence.

## 2. Document ingestion

### Supported formats (minimal, deterministic)

| Format | Support | Notes |
|---|---|---|
| Markdown (.md) | Yes | Parse headings + paragraphs; extract quoted requirements. |
| Plain text (.txt) | Yes | Line/paragraph based; extract quoted requirements. |
| Structured JSON | Yes | Array of `{id, text, section}` objects. |
| PDF | No (for MVP) | Avoids PDF parsing dependency and security surface. Defer. |

### Pipeline

1. Validate file size (≤ 256 KB) and MIME type.
2. Sanitize content (strip HTML, normalize whitespace).
3. Extract candidate requirements (quoted strings, "must/should" sentences).
4. Store with provenance: `{id, sourceDoc, section, text, score?}`.
5. Persist in file store (new `requirements` collection) or attach to project.

No vector database. No second AI provider.

## 3. Retrieval strategy comparison

| Approach | Complexity | Accuracy (small corpus) | Infra | Recommendation |
|---|---|---|---|---|
| Keyword/full-text (TF-IDF or simple token overlap) | Low | Good for quoted phrases | None | **Recommended for MVP** |
| Hybrid (keyword + BM25) | Medium | Better | None | Optional enhancement |
| Vector embeddings (semantic) | High | Best for paraphrase | Embedding model + vector store | Not needed for demo |

### Recommendation

Use **keyword/full-text retrieval** for the hackathon. The demo corpus is small (1–5 documents). Exact phrases like "Order confirmed" retrieve trivially. Semantic embeddings add cost, infrastructure, and a second model dependency with no measurable benefit at this scale. If embeddings are added later, use the same Modal endpoint (if it supports embeddings) or a local sentence-transformer; document cost and licensing.

## 4. Requirement provenance

Every retrieved requirement retains:

- `requirementId` (deterministic, e.g., `REQ-<doc>-<n>`).
- `sourceDocument` (filename).
- `sourceSection` (heading or page, when available).
- `text` (original requirement text).
- `retrievalScore` (keyword overlap score, 0–1).
- `associatedTestCase` (scenario id).
- `verificationStatus` (not_tested/passed/failed/blocked).

Provenance is stored in the run/report. Do not fabricate IDs or citations.

## 5. Grounded test generation

Distinguish:

- **User-authored requirements** (objective/instructions quoted strings) — trusted oracles.
- **Retrieved source requirements** (from uploaded docs) — trusted only when source is clear; must carry provenance.
- **Model-generated test hypotheses** — never authoritative; treated as suspected.
- **Observed browser facts** — deterministic (Playwright).
- **Assertion results** — deterministic.

A retrieved requirement may establish an expected outcome only when its source and applicability are clear. The model must not invent acceptance criteria and treat them as authoritative (existing invariant preserved).

## 6. Security

- Treat retrieved documents as untrusted content.
- Prevent document instructions from overriding system instructions, tool permissions, URL restrictions, budgets, or finding classification.
- Enforce document size limits (256 KB), access controls, safe parsing (no eval), bounded retrieval (top-k ≤ 10).
- Sanitize extracted text before inclusion in prompts (strip control chars, limit length).
- Never log or report raw document content beyond the retrieved requirement text.

## 7. Complexity & effort

- Ingestion + retrieval (keyword): ~1–2 days.
- Provenance plumbing into run/report: ~1 day.
- UI for upload + display: ~1 day.
- Tests: ~1 day.
- Total: 3–4 days.

## 8. Recommendation

Implement **minimal keyword-based RAG** with provenance. Defer vector embeddings and PDF parsing. This adds genuine value (requirements-grounded testing) with low risk and no new paid infrastructure. Combine with read-only MCP for maximum hackathon impact.