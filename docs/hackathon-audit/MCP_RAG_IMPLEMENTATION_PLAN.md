# MCP + RAG Implementation Plan — TestPilot AI

## Gate 6K-A: Read-only architecture & feasibility audit

- **Files:** (none — documentation only)
- **Effort:** 0.5 day
- **Acceptance:** This audit document set.
- **Tests:** N/A
- **Rollback:** N/A
- **Decision:** GO (complete)

## Gate 6K-B: Minimal MCP (read-only tools)

- **Files expected to change:**
  - `src/lib/mcp/server.ts` (new) — MCP server with stdio/HTTP transport
  - `src/lib/mcp/tools.ts` (new) — tool definitions + handlers
  - `src/app/api/mcp/route.ts` (new) — HTTP transport endpoint
  - `src/lib/mcp/auth.ts` (new) — API key validation
  - `package.json` — add `@modelcontextprotocol/sdk`
- **Effort:** 1–2 days
- **Acceptance:** MCP Inspector discovers 4 read-only tools; schemas validate; unauthorized calls rejected.
- **Tests:** `tests/integration/mcp.test.ts` — tool discovery, schema validation, auth rejection.
- **Rollback:** Remove `src/lib/mcp/` and route; no data changes.
- **Decision:** GO (recommended first)

## Gate 6K-C: Minimal requirements retrieval (keyword RAG)

- **Files expected to change:**
  - `src/lib/rag/ingest.ts` (new) — parse/sanitize/extract
  - `src/lib/rag/retrieve.ts` (new) — keyword search
  - `src/lib/storage/file-store.ts` — add `requirementDocRepo` / `requirementRepo`
  - `src/lib/schemas/index.ts` — add `RequirementDocumentSchema`, `RetrievedRequirementSchema`
  - `src/lib/agent/runner.ts` — consume retrieved requirements as trusted context
  - `src/app/api/requirements/route.ts` (new) — upload/list
  - `src/app/projects/[id]/page.tsx` — upload UI
  - `src/lib/reporting/html.ts` — provenance section
- **Effort:** 2–3 days
- **Acceptance:** Upload a spec; retrieve correct requirement for "Order confirmed"; report shows provenance.
- **Tests:** `tests/unit/rag.test.ts` (ingestion, retrieval, provenance); `tests/integration/rag.test.ts` (end-to-end).
- **Rollback:** Remove RAG modules; runs/reports revert to user-authored requirements only.
- **Decision:** GO if time permits after Gate 6K-B

## Gate 6K-D: Integration testing, security validation, demo

- **Files expected to change:**
  - `tests/integration/mcp-rag.test.ts` (new)
  - `docs/demo-script.md` — update for RAG/MCP demo
  - `docs/security.md` — document new surfaces
- **Effort:** 1 day
- **Acceptance:** Negative tests pass (irrelevant retrieval, malicious doc instructions, unauthorized MCP, missing provenance).
- **Tests:** as listed.
- **Rollback:** Revert test files only.
- **Decision:** GO/NO-GO based on remaining time before deadline.

## Overall recommendation

Implement **Option C (Minimal MCP + RAG)** but only if Gate 6K-B (read-only MCP) completes with time to spare. If time is short, implement **RAG only** (Option B) — it has higher demo value and lower security risk than MCP. MCP adds interoperability but requires auth hardening that may exceed the hackathon timeline.<|end|><|start|>write to=assistant<|channel|>analysis<|message|>Created file successfully: docs/hackathon-audit/MCP_RAG_IMPLEMENTATION_PLAN.md