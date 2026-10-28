# TestPilot AI

Autonomous, verifiable AI-powered QA testing agent. Built for the Meta Global AI Developer Hackathon 2026 (Indie Developer track, "Push the Frontier").

TestPilot AI explores an authorized web application, generates test scenarios using a Meta model, executes real browser actions with Playwright, captures evidence, and produces a QA report with findings and reproduction steps.

## Status

- Phase 1 (foundation) — complete
- Phase 2 (browser engine) — complete
- Phase 3 (AI layer) - complete; live Meta Muse Spark Open inference verified via Modal dedicated endpoint
- Phase 4 (agent loop) — complete (end-to-end verified against demo fixture)
- Phase 5 (reporting) — complete (HTML report download)
- Phase 6 (demo & polish) — complete (live Meta integration verified, screenshots, billing docs, tests)

## Stack

- Next.js 16 (App Router), TypeScript strict, Tailwind CSS
- Zod for schemas and model-output validation
- Playwright for browser automation
- File-based storage adapter (repository interfaces; Supabase-ready)
- Modal dedicated endpoint for Meta Muse Spark Open (OpenAI-compatible)

## Quick start

```bash
npm install
cp .env.example .env.local
# edit .env.local: set ALLOW_LOCAL_DEMO=true for the demo fixture
npm run dev
```

Open http://localhost:3000.

Demo flow:
1. Click "New project".
2. Use defaults (target URL `http://localhost:3000/demo-shop/index.html`, authorized domain `localhost`).
3. Confirm authorization and create.
4. Click "Run test".
5. View the run: the agent fills the form, submits, asserts "Order confirmed", fails, records a confirmed finding.
6. Download the HTML report.

## Validation

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest
npm run build       # next build
```

## Security

- Explicit target authorization confirmation and domain allowlisting.
- URL normalization, DNS resolution, blocking of private/loopback/link-local/metadata IPs (SSRF protection).
- Redirect validation.
- Browser network egress restricted to the authorized origin.
- Bounded runs: max steps, duration, pages, token budget, concurrency.
- No arbitrary JavaScript execution; LLM output validated with Zod before any action.
- No secrets in the repository; `.env*` ignored.

See `docs/security.md`.

## Model integration

Meta **Muse Spark Open** via a Modal **Dedicated Endpoint** (OpenAI-compatible). The adapter lives in `src/lib/ai/modal.ts`. When `MODAL_PROXY_TOKEN` and `MODAL_MODEL_ID` are set, it is used; otherwise the app falls back to a deterministic `MockModelAdapter` and labels runs accordingly. Live Meta inference has been verified (`/api/ai/ping` returns ok:true; an end-to-end run recorded non-zero tokens).

Billing: this is a dedicated endpoint (compute/GPU time), not per-token. See `docs/modal-billing.md`. The `estimatedCostUsd` field is a per-token approximation for observability only.

## Demo defect

`public/demo-shop/index.html` contains an intentionally introduced defect: the submit handler prevents default and never displays the expected "Order confirmed" confirmation. The agent detects this through a real Playwright assertion and records a confirmed finding with a screenshot and reproduction steps.

## Known limitations

- Storage is file-based (`.data/`); not durable across deployments. Swap the repository implementation for Supabase for production.
- Live Meta inference was verified against a provisioned Modal dedicated endpoint. Reproducing it requires your own Modal proxy token and endpoint (see `.env.example` and `docs/modal-billing.md`).
- The dedicated endpoint's GPU type, scale-to-zero, and compute cost are configured in the Modal dashboard and are not verified by this repository.
- No PDF export yet (HTML report only).
- No authentication/multi-user support in MVP.