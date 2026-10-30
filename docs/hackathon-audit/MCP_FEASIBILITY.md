# MCP Feasibility Audit — TestPilot AI

## 1. Is MCP technically feasible with the current architecture?

**YES — with a thin adapter layer.**

TestPilot AI already exposes a clean, reusable service surface:

- `executeRun(run, project, cb)` in `src/lib/agent/runner.ts` — full orchestration entry point.
- `projectRepo` / `runRepo` in `src/lib/storage/file-store.ts` — persistence with repository interfaces.
- `createModelAdapter()` in `src/lib/ai/index.ts` — model selection.
- `validateTargetUrl` / `validateNavigationUrl` in `src/lib/security/url-safety.ts` — URL policy.
- `renderReportHtml` in `src/lib/reporting/html.ts` — report generation.
- `BrowserExecutor` in `src/lib/browser/executor.ts` — isolated browser execution.

The orchestration is synchronous-per-run and stateful (file-backed). MCP integration is feasible by exposing these services as MCP tools behind an authorization boundary. No core rewrite is required.

## 2. Current API surface (reusable)

| Route | Method | Reusable for MCP? |
|---|---|---|
| `/api/projects` | POST | Yes — create project (needs auth) |
| `/api/projects/[id]` | GET | Yes — read project |
| `/api/runs` | POST | Yes — create run (needs auth + budget) |
| `/api/runs/[id]` | GET | Yes — read run status |
| `/api/runs/[id]/execute` | POST | Yes — but high-risk; gate behind auth + allowlist |
| `/api/runs/[id]/report` | GET | Yes — report reference |
| `/api/ai/ping` | GET | Yes — health check |
| `/api/screenshots/[...path]` | GET | Yes — bounded path |

## 3. Recommended MCP tools (initial set)

### Read-only first (safe, low risk)

1. `testpilot_get_run_status` — run status, progress, requirement coverage, metadata.
2. `testpilot_get_findings` — confirmed/suspected findings with evidence refs.
3. `testpilot_get_report` — report URL/reference (not raw content by default).
4. `testpilot_list_requirements` — requirements for a project/run.

### Deferred (high risk, requires auth + policy)

5. `testpilot_start_run` — create + execute a run. Defer until authentication and authorization are demonstrably safe. When implemented, enforce URL allowlists, budgets, concurrency, and domain ownership confirmation.

## 4. MCP protocol requirements

- Use the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`).
- Transport: stdio for local development; Streamable HTTP for deployment.
- Tool discovery via `tools/list`; invocation via `tools/call`.
- Input/output schemas via Zod (already in use) mapped to JSON Schema.
- Error handling: structured errors with codes; never leak stack traces or secrets.

## 5. Authentication & authorization design

- MCP server must run server-side only (never in browser).
- Each tool call carries a caller identity (API key or OAuth token).
- Resource ownership: projects/runs are scoped to the owning user/workspace.
- `testpilot_start_run` requires explicit target authorization confirmation (reuse existing `confirmAuthorization`).
- Rate limiting per caller (reuse `MAX_CONCURRENT_RUNS`).

## 6. Security controls

- No raw secrets, filesystem paths, or unrestricted network access exposed.
- Screenshots served only via bounded `/api/screenshots` path validation (already implemented).
- Reports returned as references, not inline blobs, unless explicitly requested and authorized.
- Domain allowlist enforced server-side (already implemented).
- No arbitrary code execution (Playwright actions are typed and validated).

## 7. Compatibility testing

- MCP Inspector for tool discovery and schema validation.
- Integration tests using the MCP SDK client against a local server.
- Negative tests: unauthorized caller, invalid URL, missing project, oversized input.

## 8. Complexity & effort

- Read-only MCP tools: ~1–2 days (thin adapter over existing routes).
- `testpilot_start_run`: +1 day (auth + policy gating).
- Transport + auth hardening: +1 day.
- Total estimated: 3–4 days for a safe, minimal implementation.

## 9. Recommendation

Implement **read-only MCP tools first** (status, findings, report, requirements). Defer `testpilot_start_run` until authentication is production-grade. This delivers interoperability value without exposing browser execution to unauthorized callers.