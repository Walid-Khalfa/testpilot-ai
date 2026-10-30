# Demo Script — TestPilot AI (4 minutes)

**Setup:** dev server on 127.0.0.1:3000, `.env.local` configured with Modal dedicated endpoint, browser open on dashboard. Synthetic data only.

## 0:00–0:30 — Problem & solution
- "TestPilot AI is an autonomous, verifiable QA agent — not just a test-case generator."
- Show dashboard; explain OBSERVE → REASON → PLAN → ACT → VERIFY → ADAPT → REPORT.

## 0:30–1:00 — Create project + upload spec (RAG)
- Click "New project"; use defaults (defective demo fixture, localhost, authorization confirmed).
- Point out scope limits: max steps/duration/pages/tokens, domain allowlist.
- Upload `checkout-spec.md` containing: `After submitting valid checkout information, the application must display "Order confirmed".`
- Show extracted requirement with provenance (REQ-..., source document, section, score).

## 1:00–1:30 — Live Meta AI planning
- Click "Run test". Timeline: "Browser started. Model: Meta Muse Spark Open".
- Observe → Plan: generated scenario(s) (real Modal inference).
- Show token count updating; requirement coverage tracking "Order confirmed".

## 1:30–2:10 — Autonomous execution
- Timeline: fill fields → click submit → assert "Order confirmed" → FAIL.
- Highlight: agent adapts, records confirmed defect with screenshot.
- Show pagesVisited, assertions, findings.

## 2:10–2:40 — Findings & evidence
- Findings: confirmed defect with severity, repro steps, screenshot thumbnail.
- Requirement coverage: "Order confirmed" → failed; retrieved requirement → blocked (untested).
- Show Actions table and Assertions.

## 2:40–3:10 — Report
- Click "Download report"; open HTML report.
- Show embedded screenshots, requirement provenance, timeline, tokens/cost, model identification.

## 3:10–3:40 — Success scenario (optional second run)
- Run against `success.html`: requirement passes, 0 findings. Demonstrates no false positives.

## 3:40–4:00 — Architecture & safety
- Show README architecture + security (SSRF, no eval, bounded runs, local-only API).
- Closing: "Real Meta model, real Playwright, real evidence, requirements-grounded."

## Launch & reset

- Launch: `npm run dev:local` (binds to 127.0.0.1:3000).
- Reset: delete `.data/` directory; restart dev server; clear browser cache. Use synthetic data only.